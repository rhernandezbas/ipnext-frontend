import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';

describe('FilterBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders search input with default placeholder', () => {
    render(<FilterBar onSearch={vi.fn()} />);
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<FilterBar onSearch={vi.fn()} searchPlaceholder="Buscar clientes..." />);
    expect(screen.getByPlaceholderText('Buscar clientes...')).toBeInTheDocument();
  });

  it('calls onSearch with debounce after typing', async () => {
    const onSearch = vi.fn();
    render(<FilterBar onSearch={onSearch} />);

    // Use fireEvent to avoid userEvent + fake timer conflicts
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), {
      target: { value: 'test' },
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('does NOT re-trigger the debounce when only the onSearch reference changes (no input change)', () => {
    // Regression: if FilterBar's debounce depends on onSearch, every parent
    // re-render that passes a fresh inline callback re-fires search and any
    // setPage(1) inside onSearch hijacks pagination. The debounce must depend
    // only on what the user typed.
    const onSearchA = vi.fn();
    const onSearchB = vi.fn();
    const { rerender } = render(<FilterBar onSearch={onSearchA} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'foo' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSearchA).toHaveBeenCalledTimes(1);
    expect(onSearchA).toHaveBeenCalledWith('foo');

    // Parent re-renders with a fresh callback (simulating a pagination click).
    rerender(<FilterBar onSearch={onSearchB} />);
    act(() => { vi.advanceTimersByTime(300); });

    // Neither callback should fire — searchValue did not change.
    expect(onSearchB).not.toHaveBeenCalled();
    expect(onSearchA).toHaveBeenCalledTimes(1);
  });

  it('uses the latest onSearch reference when the input later changes', () => {
    const onSearchA = vi.fn();
    const onSearchB = vi.fn();
    const { rerender } = render(<FilterBar onSearch={onSearchA} />);

    rerender(<FilterBar onSearch={onSearchB} />);
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'bar' } });
    act(() => { vi.advanceTimersByTime(300); });

    expect(onSearchB).toHaveBeenCalledWith('bar');
    expect(onSearchA).not.toHaveBeenCalled();
  });

  it('renders filter selects', () => {
    const filters = [
      {
        key: 'status',
        label: 'Estado',
        options: [
          { value: 'active', label: 'Activo' },
          { value: 'inactive', label: 'Inactivo' },
        ],
      },
    ];
    render(<FilterBar onSearch={vi.fn()} filters={filters} />);
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('calls onFilterChange when filter select changes', () => {
    const onFilterChange = vi.fn();
    const filters = [
      {
        key: 'status',
        label: 'Estado',
        options: [
          { value: 'active', label: 'Activo' },
          { value: 'inactive', label: 'Inactivo' },
        ],
      },
    ];
    render(<FilterBar onSearch={vi.fn()} filters={filters} onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), {
      target: { value: 'inactive' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('status', 'inactive');
  });
});
