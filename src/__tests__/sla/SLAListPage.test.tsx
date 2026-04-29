import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SLAListPage from '@/pages/sla/SLAListPage';

vi.mock('@/hooks/useSla', () => ({
  useSlaContracts: vi.fn(),
}));

import { useSlaContracts } from '@/hooks/useSla';

const mockContracts = [
  { id: '1', clientName: 'Empresa Alpha', level: 'premium', committedUptime: 99.9, actualUptime: 99.7, status: 'en_riesgo' },
  { id: '2', clientName: 'Empresa Beta', level: 'estandar', committedUptime: 99.5, actualUptime: 99.8, status: 'activo' },
];

describe('SLAListPage', () => {
  beforeEach(() => {
    vi.mocked(useSlaContracts).mockReturnValue({
      data: mockContracts,
      isLoading: false,
    } as ReturnType<typeof useSlaContracts>);
  });

  it('renders heading "Contratos SLA"', () => {
    render(<MemoryRouter><SLAListPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Contratos SLA/i })).toBeInTheDocument();
  });

  it('renders client names in the table', () => {
    render(<MemoryRouter><SLAListPage /></MemoryRouter>);
    expect(screen.getByText('Empresa Alpha')).toBeInTheDocument();
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<MemoryRouter><SLAListPage /></MemoryRouter>);
    expect(screen.getByText(/cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/nivel/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
