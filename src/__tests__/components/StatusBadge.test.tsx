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

  it('renders Bajas for baja status', () => {
    render(<StatusBadge status="baja" />);
    expect(screen.getByText('Bajas')).toBeInTheDocument();
  });

  it('renders the label override instead of the default label', () => {
    // Finance pages reuse the blocked variant by color but supply their own copy.
    render(<StatusBadge status="blocked" label="Incobrable" />);
    expect(screen.getByText('Incobrable')).toBeInTheDocument();
    expect(screen.queryByText('Bloqueado')).not.toBeInTheDocument();
  });

  it('keeps NEUTRAL defaults so finance pages (no label) are unaffected', () => {
    // Finance pages render <StatusBadge status={...} /> WITHOUT a label.
    // A cancelled/voided invoice mapped to `blocked` must read "Bloqueado", NOT "Incobrable".
    const { rerender } = render(<StatusBadge status="blocked" />);
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
    expect(screen.queryByText('Incobrable')).not.toBeInTheDocument();
    rerender(<StatusBadge status="late" />);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('falls back to the raw status string for an unknown status', () => {
    // Defensive: an unexpected backend value must not render a blank badge.
    render(<StatusBadge status={'mystery' as never} />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});
