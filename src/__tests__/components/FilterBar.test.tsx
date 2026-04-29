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
