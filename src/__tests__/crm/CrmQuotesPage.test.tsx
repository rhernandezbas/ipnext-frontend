import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CrmQuotesPage from '@/pages/crm/CrmQuotesPage';
import * as useCrmQuotesModule from '@/hooks/useCrmQuotes';
import type { CrmQuote } from '@/types/crmQuote';

vi.mock('@/hooks/useCrmQuotes');

const mockQuotes: CrmQuote[] = [
  { id: '1', cliente: 'Empresa Test A', servicio: 'Internet 200 Mbps', monto: 25000, estado: 'Pendiente' },
  { id: '2', cliente: 'Comercio Test B', servicio: 'Internet + Telefonía', monto: 18500, estado: 'Aprobada' },
];

describe('CrmQuotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCrmQuotesModule.useCrmQuotes).mockReturnValue({
      data: mockQuotes,
      isLoading: false,
    } as ReturnType<typeof useCrmQuotesModule.useCrmQuotes>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><CrmQuotesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Presupuestos/i })).toBeInTheDocument();
  });

  it('renders quote rows from hook data', () => {
    render(<MemoryRouter><CrmQuotesPage /></MemoryRouter>);
    expect(screen.getByText('Empresa Test A')).toBeInTheDocument();
    expect(screen.getByText('Comercio Test B')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useCrmQuotesModule.useCrmQuotes).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useCrmQuotesModule.useCrmQuotes>);
    render(<MemoryRouter><CrmQuotesPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
