import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResolutionsChart } from './ResolutionsChart';
import type { ReportsResolutions } from '@/types/messagingReports';

// 7d: AR days 07-12 .. 07-18 inclusive
const RANGE = { from: '2026-07-12T03:00:00.000Z', to: '2026-07-19T03:00:00.000Z' };

const RESOLUTIONS: ReportsResolutions = {
  timezone: 'America/Argentina/Buenos_Aires',
  days: [
    { date: '2026-07-14', count: 3 },
    { date: '2026-07-18', count: 5 },
  ],
};

describe('ResolutionsChart', () => {
  it('renderiza una barra por cada día del rango (eje continuo, huecos con 0)', () => {
    render(<ResolutionsChart range={RANGE} resolutions={RESOLUTIONS} />);
    // 7 barras (una por día del rango 07-12..07-18)
    expect(screen.getAllByTestId('resolution-bar')).toHaveLength(7);
  });

  it('cada barra expone su fecha y count via aria-label (incl. días en 0)', () => {
    render(<ResolutionsChart range={RANGE} resolutions={RESOLUTIONS} />);
    // día con dato
    expect(screen.getByLabelText(/2026-07-14.*3/)).toBeInTheDocument();
    // día sin dato → 0
    expect(screen.getByLabelText(/2026-07-13.*0/)).toBeInTheDocument();
  });

  it('incluye una tabla accesible alternativa con todos los días', () => {
    render(<ResolutionsChart range={RANGE} resolutions={RESOLUTIONS} />);
    const table = screen.getByRole('table', { name: /resoluciones/i });
    // 7 filas de datos (una por día)
    const rows = within(table).getAllByRole('row');
    // 1 header + 7 data rows
    expect(rows).toHaveLength(8);
  });

  it('estado vacío cuando el rango no tiene ninguna resolución', () => {
    render(
      <ResolutionsChart
        range={RANGE}
        resolutions={{ timezone: 'America/Argentina/Buenos_Aires', days: [] }}
      />,
    );
    expect(screen.getByText(/sin resoluciones en el rango/i)).toBeInTheDocument();
  });
});
