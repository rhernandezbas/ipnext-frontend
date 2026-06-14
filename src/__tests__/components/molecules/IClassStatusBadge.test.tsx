import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { IClassStatusBadge } from '@/components/molecules/IClassStatusBadge/IClassStatusBadge';

describe('IClassStatusBadge', () => {
  it('renders the label when tracked=true', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'INSTALADO', label: 'Instalación OK', color: '#22c55e', tracked: true }}
      />
    );
    expect(screen.getByTestId('iclass-status-badge')).toBeInTheDocument();
    expect(screen.getByText('Instalación OK')).toBeInTheDocument();
  });

  it('does NOT render when tracked=false', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'PENDIENTE', label: 'Pendiente', color: null, tracked: false }}
      />
    );
    expect(screen.queryByTestId('iclass-status-badge')).not.toBeInTheDocument();
  });

  it('does NOT render when iclassStatus is null', () => {
    render(<IClassStatusBadge iclassStatus={null} />);
    expect(screen.queryByTestId('iclass-status-badge')).not.toBeInTheDocument();
  });

  it('does NOT render when iclassStatus is null (no status captured)', () => {
    render(<IClassStatusBadge iclassStatus={null} />);
    expect(screen.queryByTestId('iclass-status-badge')).not.toBeInTheDocument();
  });

  it('applies inline color style when color is provided', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'INSTALADO', label: 'Instalación OK', color: '#22c55e', tracked: true }}
      />
    );
    const badge = screen.getByTestId('iclass-status-badge');
    // El color se aplica inline via style (background con transparencia y color de texto)
    expect(badge).toHaveStyle({ color: '#22c55e' });
  });

  it('renders the color dot when color is provided', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'INSTALADO', label: 'OK', color: '#22c55e', tracked: true }}
      />
    );
    // El dot es aria-hidden="true", existe en el DOM
    const badge = screen.getByTestId('iclass-status-badge');
    // eslint-disable-next-line testing-library/no-node-access
    const dot = badge.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('renders without dot when color is null', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'ACTIVO', label: 'Activo', color: null, tracked: true }}
      />
    );
    const badge = screen.getByTestId('iclass-status-badge');
    // eslint-disable-next-line testing-library/no-node-access
    const dot = badge.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('has accessible aria-label with the status label', () => {
    render(
      <IClassStatusBadge
        iclassStatus={{ code: 'INSTALADO', label: 'Instalación OK', color: null, tracked: true }}
      />
    );
    expect(screen.getByLabelText(/estado iclass: instalación ok/i)).toBeInTheDocument();
  });
});
