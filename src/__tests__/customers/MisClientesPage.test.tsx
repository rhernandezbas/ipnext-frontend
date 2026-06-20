import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MisClientesPage from '@/pages/customers/MisClientesPage';
import * as usePortfolioModule from '@/hooks/usePortfolio';
import type { Portfolio, PortfolioItem } from '@/types/portfolio';

vi.mock('@/hooks/usePortfolio');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <MisClientesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Build a useQuery-shaped return value for the mocked hook. */
function mockQuery(overrides: Partial<ReturnType<typeof usePortfolioModule.useMyPortfolio>>) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof usePortfolioModule.useMyPortfolio>;
}

const item = (over: Partial<PortfolioItem>): PortfolioItem => ({
  clientId: 'c-1',
  clientName: 'Cliente Uno',
  status: 'active',
  ageBucket: '0-3',
  oldestStartDate: '2026-04-01T00:00:00.000Z',
  contractsCount: 1,
  hasDebt: false,
  debtAmount: null,
  debtCurrency: null,
  openClaims: 0,
  ...over,
});

const fullPortfolio: Portfolio = {
  unmapped: false,
  items: [
    item({ clientId: 'c-1', clientName: 'Ana Nueva', ageBucket: '0-3', status: 'active' }),
    item({
      clientId: 'c-2',
      clientName: 'Beto Deudor',
      ageBucket: '12+',
      status: 'late',
      hasDebt: true,
      debtAmount: 15000,
      debtCurrency: 'ARS',
      openClaims: 2,
    }),
  ],
  summary: {
    total: 2,
    byBucket: { '0-3': 1, '3-6': 0, '6-12': 0, '12+': 1 },
    active: 1,
    withDebt: 1,
    withClaims: 1,
  },
};

describe('MisClientesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Mis clientes" heading', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Mis clientes', level: 1 })).toBeInTheDocument();
  });

  it('renders the summary cards from the summary payload', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('Con deuda')).toBeInTheDocument();
    expect(screen.getByText('Con reclamos')).toBeInTheDocument();
  });

  it('groups clients by age bucket and hides empty buckets', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();
    // Populated buckets render their section headers...
    expect(screen.getByRole('heading', { name: '0 a 3 meses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Más de 12 meses' })).toBeInTheDocument();
    // ...empty ones do not.
    expect(screen.queryByRole('heading', { name: '3 a 6 meses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '6 a 12 meses' })).not.toBeInTheDocument();
  });

  it('renders client names, status badge, debt chip and claims chip', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();
    expect(screen.getByText('Ana Nueva')).toBeInTheDocument();
    expect(screen.getByText('Beto Deudor')).toBeInTheDocument();
    // GR status label (late → "Deudor") via CLIENT_STATUS_LABELS override
    expect(screen.getByText('Deudor')).toBeInTheDocument();
    // Debt chip shows the amount + currency
    expect(screen.getByText(/ARS\s*15\.000,00/)).toBeInTheDocument();
    // Claims chip
    expect(screen.getByText('2 reclamos')).toBeInTheDocument();
  });

  it('makes each client row link to the client detail route', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();
    const link = screen.getByText('Ana Nueva').closest('a');
    expect(link).toHaveAttribute('href', '/admin/customers/view/c-1');
  });

  it('shows the unmapped state when the agent has no vendedor', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(
      mockQuery({
        data: {
          unmapped: true,
          items: [],
          summary: { total: 0, byBucket: { '0-3': 0, '3-6': 0, '6-12': 0, '12+': 0 }, active: 0, withDebt: 0, withClaims: 0 },
        },
      }),
    );
    renderPage();
    expect(screen.getByText(/no estás mapeado a un vendedor/i)).toBeInTheDocument();
    // No summary cards in the unmapped state
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('shows the empty state when mapped but with no clients', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(
      mockQuery({
        data: {
          unmapped: false,
          items: [],
          summary: { total: 0, byBucket: { '0-3': 0, '3-6': 0, '6-12': 0, '12+': 0 }, active: 0, withDebt: 0, withClaims: 0 },
        },
      }),
    );
    renderPage();
    expect(screen.getByText(/todavía no tenés clientes en tu cartera/i)).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ isLoading: true }));
    renderPage();
    expect(screen.getByLabelText('Cargando cartera')).toBeInTheDocument();
  });

  it('shows an error state with a retry button', () => {
    const refetch = vi.fn();
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ isError: true, refetch }));
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
