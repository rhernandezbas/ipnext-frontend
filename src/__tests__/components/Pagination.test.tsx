import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { Pagination } from '@/components/molecules/Pagination/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nav with page buttons', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
  });

  it('disables Anterior on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('disables Siguiente on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('calls onPageChange with next page when Siguiente clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with prev page when Anterior clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('marks current page with aria-current="page"', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);
    const pageBtn = screen.getByRole('button', { name: '3' });
    expect(pageBtn).toHaveAttribute('aria-current', 'page');
  });
});
