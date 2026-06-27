import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CustomerSearchPage from '@/pages/customers/CustomerSearchPage';

vi.mock('@/hooks/useCustomers', () => ({
  useClientList: vi.fn(),
}));

import { useClientList } from '@/hooks/useCustomers';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

const mockCustomers = [
  { id: 1, name: 'Juan Pérez', login: 'jperez', email: 'juan@example.com', phone: '1234567890', status: 'active' as const, category: 'residencial', tariffPlan: null, ipRanges: null, accessDevices: 0, createdAt: '2026-01-01' },
];

describe('CustomerSearchPage', () => {
  beforeEach(() => {
    vi.mocked(useClientList).mockReturnValue(mockQuery({
      data: { data: mockCustomers, total: 1, page: 1, pageSize: 20, totalPages: 1 },
      isLoading: false,
    }));
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
