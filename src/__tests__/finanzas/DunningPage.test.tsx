import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import DunningPage from '@/pages/finanzas/DunningPage';

vi.mock('@/hooks/useDunning', () => ({
  useDunningEntries: vi.fn(),
}));

import { useDunningEntries } from '@/hooks/useDunning';

const mockEntries = [
  { id: '1', clientName: 'Juan Pérez', amount: 3500, dueDate: '2026-03-15', stage: '1er_aviso', status: 'pendiente' },
  { id: '2', clientName: 'María García', amount: 7200, dueDate: '2026-02-28', stage: '2do_aviso', status: 'pendiente' },
];

describe('DunningPage', () => {
  beforeEach(() => {
    vi.mocked(useDunningEntries).mockReturnValue({
      data: mockEntries,
      isLoading: false,
    } as ReturnType<typeof useDunningEntries>);
  });

  it('renders heading "Dunning"', () => {
    render(<MemoryRouter><DunningPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /^dunning$/i })).toBeInTheDocument();
  });

  it('renders client names in the table', () => {
    render(<MemoryRouter><DunningPage /></MemoryRouter>);
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<MemoryRouter><DunningPage /></MemoryRouter>);
    expect(screen.getByText(/cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/monto/i)).toBeInTheDocument();
    expect(screen.getByText(/vencimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/etapa/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
