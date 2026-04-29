import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input } from '@/components/atoms/Input/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Search" />);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('does not show error message by default', () => {
    render(<Input />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<Input error="Campo requerido" />);
    expect(screen.getByText('Campo requerido')).toBeInTheDocument();
  });

  it('passes additional props to the input element', () => {
    render(<Input type="email" id="email" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('id', 'email');
  });
});
