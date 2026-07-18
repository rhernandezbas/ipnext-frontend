import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrafficHeatmap } from './TrafficHeatmap';
import type { ReportsTraffic } from '@/types/messagingReports';

const TRAFFIC: ReportsTraffic = {
  timezone: 'America/Argentina/Buenos_Aires',
  cells: [
    { dow: 1, hour: 14, count: 10 }, // lunes 14h — máximo → nivel tope
    { dow: 1, hour: 9, count: 2 }, // lunes 09h — bajo → nivel 1
    { dow: 0, hour: 0, count: 5 }, // domingo 00h
  ],
};

describe('TrafficHeatmap', () => {
  it('renderiza una tabla accesible con nombre', () => {
    render(<TrafficHeatmap traffic={TRAFFIC} />);
    expect(screen.getByRole('table', { name: /tráfico/i })).toBeInTheDocument();
  });

  it('colorea las celdas por count (nivel proporcional al máximo)', () => {
    render(<TrafficHeatmap traffic={TRAFFIC} />);
    // max=10 → lunes 14h (count 10) cae en el nivel tope 5
    const peak = screen.getByLabelText(/lunes 14:00/i);
    expect(peak.dataset.level).toBe('5');
    // lunes 09h (count 2) → nivel 1 (bajo)
    const low = screen.getByLabelText(/lunes 09:00/i);
    expect(low.dataset.level).toBe('1');
  });

  it('las celdas sin dato quedan neutras (nivel 0)', () => {
    render(<TrafficHeatmap traffic={TRAFFIC} />);
    const empty = screen.getByLabelText(/lunes 13:00/i);
    expect(empty.dataset.level).toBe('0');
    expect(empty).toHaveAccessibleName(/sin datos/i);
  });

  it('rotula los 7 días (Dom..Sáb) como encabezados de fila', () => {
    render(<TrafficHeatmap traffic={TRAFFIC} />);
    for (const day of ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']) {
      expect(screen.getByRole('rowheader', { name: new RegExp(day, 'i') })).toBeInTheDocument();
    }
  });

  it('muestra un estado vacío cuando no hay tráfico', () => {
    render(<TrafficHeatmap traffic={{ timezone: 'America/Argentina/Buenos_Aires', cells: [] }} />);
    expect(screen.getByText(/sin tráfico en el rango/i)).toBeInTheDocument();
  });
});
