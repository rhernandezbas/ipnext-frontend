import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';

describe('StatusBadge', () => {
  it('renders Activo for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders Atrasado for late status', () => {
    render(<StatusBadge status="late" />);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('renders Bloqueado for blocked status', () => {
    render(<StatusBadge status="blocked" />);
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
  });

  it('renders Inactivo for inactive status', () => {
    render(<StatusBadge status="inactive" />);
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });
});
