import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CustomerSearchPage from '@/pages/clientes/CustomerSearchPage';

vi.mock('@/hooks/useClients', () => ({
  useClientList: vi.fn(),
}));

import { useClientList } from '@/hooks/useClients';

const mockCustomers = [
  { id: 1, name: 'Juan Pérez', login: 'jperez', email: 'juan@example.com', phone: '1234567890', status: 'active' as const, balance: 0, category: 'residencial', tariffPlan: null, ipRanges: null, accessDevices: 0, createdAt: '2026-01-01' },
];

describe('CustomerSearchPage', () => {
  beforeEach(() => {
    vi.mocked(useClientList).mockReturnValue({
      data: { data: mockCustomers, total: 1 },
      isLoading: false,
    } as ReturnType<typeof useClientList>);
  });

  it('renders heading "Búsqueda de clientes"', () => {
    render(<MemoryRouter><CustomerSearchPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Búsqueda de clientes/i })).toBeInTheDocument();
  });

  it('has search input', () => {
    render(<MemoryRouter><CustomerSearchPage /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: /Buscar cliente/i })).toBeInTheDocument();
  });

  it('has search button', () => {
    render(<MemoryRouter><CustomerSearchPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument();
  });
});
