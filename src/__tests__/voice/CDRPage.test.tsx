import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CDRPage from '@/pages/voice/CDRPage';

vi.mock('@/hooks/useCdr', () => ({
  useCdrRecords: vi.fn(),
}));

import { useCdrRecords } from '@/hooks/useCdr';

const mockRecords = [
  { id: '1', date: '2026-04-28 10:30:00', origin: '+54 11 4000-0001', destination: '+54 11 5000-0001', duration: 222, rate: 0.02, cost: 4.44, status: 'completada' },
  { id: '2', date: '2026-04-28 11:15:00', origin: '+54 11 4000-0002', destination: '+54 351 400-0002', duration: 0, rate: 0.05, cost: 0, status: 'fallida' },
];

describe('CDRPage', () => {
  beforeEach(() => {
    vi.mocked(useCdrRecords).mockReturnValue({
      data: mockRecords,
      isLoading: false,
    } as ReturnType<typeof useCdrRecords>);
  });

  it('renders heading "CDR — Registros de Llamadas"', () => {
    render(<MemoryRouter><CDRPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /CDR.*Registros de Llamadas/i })).toBeInTheDocument();
  });

  it('renders origin numbers in the table', () => {
    render(<MemoryRouter><CDRPage /></MemoryRouter>);
    expect(screen.getByText('+54 11 4000-0001')).toBeInTheDocument();
    expect(screen.getByText('+54 11 4000-0002')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<MemoryRouter><CDRPage /></MemoryRouter>);
    expect(screen.getByText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByText(/origen/i)).toBeInTheDocument();
    expect(screen.getByText(/destino/i)).toBeInTheDocument();
    expect(screen.getByText(/duración/i)).toBeInTheDocument();
    expect(screen.getByText(/tarifa/i)).toBeInTheDocument();
    expect(screen.getByText(/costo/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
