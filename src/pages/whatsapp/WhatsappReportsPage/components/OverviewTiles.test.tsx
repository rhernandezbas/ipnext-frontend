import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OverviewTiles } from './OverviewTiles';
import type { ReportsOverview } from '@/types/messagingReports';

const OVERVIEW: ReportsOverview = {
  resolvedInRange: 42,
  createdInRange: 55,
  currentOpen: 7,
  currentUnattended: 3,
  currentUnassigned: 4,
  currentPending: 2,
};

describe('OverviewTiles', () => {
  it('muestra los current* de conversaciones abiertas', () => {
    render(<OverviewTiles overview={OVERVIEW} />);
    expect(screen.getByTestId('tile-currentOpen')).toHaveTextContent('7');
    expect(screen.getByTestId('tile-currentUnattended')).toHaveTextContent('3');
    expect(screen.getByTestId('tile-currentUnassigned')).toHaveTextContent('4');
    expect(screen.getByTestId('tile-currentPending')).toHaveTextContent('2');
  });

  it('muestra resueltas/creadas del rango', () => {
    render(<OverviewTiles overview={OVERVIEW} />);
    expect(screen.getByTestId('tile-resolvedInRange')).toHaveTextContent('42');
    expect(screen.getByTestId('tile-createdInRange')).toHaveTextContent('55');
  });

  it('etiqueta cada tile de forma legible', () => {
    render(<OverviewTiles overview={OVERVIEW} />);
    expect(screen.getByText(/sin atender/i)).toBeInTheDocument();
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument();
    expect(screen.getByText(/pendientes/i)).toBeInTheDocument();
  });
});
