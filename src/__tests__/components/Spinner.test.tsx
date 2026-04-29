import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

describe('Spinner', () => {
  it('renders with role="status" and accessible label', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Cargando...');
  });

  it('does not render overlay by default', () => {
    const { container } = render(<Spinner />);
    // fullPage=false → no wrapping div overlay, direct span
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('renders overlay when fullPage is true', () => {
    const { container } = render(<Spinner fullPage />);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });
});
