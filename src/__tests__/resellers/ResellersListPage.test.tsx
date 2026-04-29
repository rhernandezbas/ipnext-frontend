import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ResellersListPage from '@/pages/resellers/ResellersListPage';

vi.mock('@/hooks/useResellers', () => ({
  useResellers: vi.fn(),
}));

import { useResellers } from '@/hooks/useResellers';

const mockResellers = [
  { id: '1', name: 'ISP Norte', clientCount: 150, revenue: 45000, status: 'activo', contactEmail: 'norte@isp.com' },
  { id: '2', name: 'ISP Sur', clientCount: 89, revenue: 27000, status: 'inactivo', contactEmail: 'sur@isp.com' },
];

describe('ResellersListPage', () => {
  beforeEach(() => {
    vi.mocked(useResellers).mockReturnValue({
      data: mockResellers,
      isLoading: false,
    } as ReturnType<typeof useResellers>);
  });

  it('renders heading "Resellers"', () => {
    render(<MemoryRouter><ResellersListPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /^resellers$/i })).toBeInTheDocument();
  });

  it('renders reseller names in the table', () => {
    render(<MemoryRouter><ResellersListPage /></MemoryRouter>);
    expect(screen.getByText('ISP Norte')).toBeInTheDocument();
    expect(screen.getByText('ISP Sur')).toBeInTheDocument();
  });

  it('renders column headers for Reseller, Clientes, Revenue, Estado', () => {
    render(<MemoryRouter><ResellersListPage /></MemoryRouter>);
    expect(screen.getAllByText(/reseller/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/clientes/i)).toBeInTheDocument();
    expect(screen.getByText(/revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
