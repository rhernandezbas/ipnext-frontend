import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MisClientesPage from '@/pages/customers/MisClientesPage';
import * as usePortfolioModule from '@/hooks/usePortfolio';
import * as usePermissionsModule from '@/hooks/useMyPermissions';
import * as useVendedoresModule from '@/hooks/useGrVendedorMappings';
import type { Portfolio, PortfolioItem, AllPortfolios, PortfolioItemWithVendedor } from '@/types/portfolio';

vi.mock('@/hooks/usePortfolio');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useGrVendedorMappings');

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
function mockQuery<T>(overrides: Partial<{ data: T } & Record<string, unknown>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  } as never;
}

/** Default permissions stub — NO recapture.manage (plain agent). */
function mockPermissions(can: (p: string | string[]) => boolean) {
  vi.mocked(usePermissionsModule.useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: can as never,
  });
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

const allPortfolios: AllPortfolios = {
  items: [
    { ...item({ clientId: 'c-1', clientName: 'Ana Nueva', ageBucket: '0-3' }), vendedor: 'Juan Vendedor' },
    { ...item({ clientId: 'c-9', clientName: 'Carlos Otro', ageBucket: '3-6' }), vendedor: 'Maria Vendedora' },
  ] as PortfolioItemWithVendedor[],
  summary: {
    total: 2,
    byBucket: { '0-3': 1, '3-6': 1, '6-12': 0, '12+': 0 },
    active: 2,
    withDebt: 0,
    withClaims: 0,
  },
};

describe('MisClientesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default: plain agent (no manage), mine returns data, admin hooks idle.
    mockPermissions(() => false);
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: fullPortfolio }));
    vi.mocked(usePortfolioModule.usePortfolioByVendedor).mockReturnValue(mockQuery());
    vi.mocked(usePortfolioModule.useAllPortfolios).mockReturnValue(mockQuery());
    vi.mocked(useVendedoresModule.useGrVendedores).mockReturnValue(
      mockQuery({ data: ['Juan Vendedor', 'Maria Vendedora'] }),
    );
  });

  // ── Existing behavior (mi cartera) ──────────────────────────────────────────

  it('renders the "Mis clientes" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /mis clientes/i, level: 1 })).toBeInTheDocument();
  });

  it('renders the summary cards from the summary payload', () => {
    renderPage();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('Con deuda')).toBeInTheDocument();
    expect(screen.getByText('Con reclamos')).toBeInTheDocument();
  });

  it('groups clients by age bucket and hides empty buckets', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: '0 a 3 meses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Más de 12 meses' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '3 a 6 meses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '6 a 12 meses' })).not.toBeInTheDocument();
  });

  it('renders client names, status badge, debt chip and claims chip', () => {
    renderPage();
    expect(screen.getByText('Ana Nueva')).toBeInTheDocument();
    expect(screen.getByText('Beto Deudor')).toBeInTheDocument();
    expect(screen.getByText('Deudor')).toBeInTheDocument();
    expect(screen.getByText(/ARS\s*15\.000,00/)).toBeInTheDocument();
    expect(screen.getByText('2 reclamos')).toBeInTheDocument();
  });

  it('makes each client row link to the client detail route', () => {
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

  // ── Super admin: selector gating ────────────────────────────────────────────

  it('does NOT render the cartera selector without recapture.manage', () => {
    mockPermissions(() => false);
    renderPage();
    expect(screen.queryByLabelText(/ver cartera/i)).not.toBeInTheDocument();
  });

  it('renders the cartera selector with recapture.manage', () => {
    mockPermissions((p) => p === 'recapture.manage');
    renderPage();
    const selector = screen.getByLabelText(/ver cartera/i);
    expect(selector).toBeInTheDocument();
    // Default option = "Mi cartera"
    expect((selector as HTMLSelectElement).value).toBe('__mine__');
    // "Todos los agentes" + each vendedor are options.
    expect(screen.getByRole('option', { name: 'Mi cartera' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Todos los agentes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Juan Vendedor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Maria Vendedora' })).toBeInTheDocument();
  });

  it('defaults an admin to "mi cartera" (uses useMyPortfolio, not the admin hooks)', () => {
    mockPermissions((p) => p === 'recapture.manage');
    renderPage();
    expect(usePortfolioModule.useMyPortfolio).toHaveBeenCalled();
    // Admin hooks are present but DISABLED in mi-cartera mode.
    expect(usePortfolioModule.usePortfolioByVendedor).toHaveBeenCalledWith(expect.any(String), false);
    expect(usePortfolioModule.useAllPortfolios).toHaveBeenCalledWith(false);
  });

  // ── Super admin: by-vendedor mode ───────────────────────────────────────────

  it('switching to a vendedor consumes the by-vendedor portfolio', async () => {
    const user = userEvent.setup();
    mockPermissions((p) => p === 'recapture.manage');
    vi.mocked(usePortfolioModule.usePortfolioByVendedor).mockReturnValue(mockQuery({ data: fullPortfolio }));
    renderPage();

    await user.selectOptions(screen.getByLabelText(/ver cartera/i), 'Juan Vendedor');

    // by-vendedor hook is now enabled for the chosen vendedor.
    expect(usePortfolioModule.usePortfolioByVendedor).toHaveBeenLastCalledWith('Juan Vendedor', true);
    // Title reflects the vendedor.
    expect(screen.getByRole('heading', { name: /cartera de juan vendedor/i, level: 1 })).toBeInTheDocument();
    // Clients still render (reused body).
    expect(screen.getByText('Ana Nueva')).toBeInTheDocument();
  });

  // ── Super admin: todos mode ─────────────────────────────────────────────────

  it('"Todos los agentes" consumes the all-portfolios hook and shows the Agente column', async () => {
    const user = userEvent.setup();
    mockPermissions((p) => p === 'recapture.manage');
    vi.mocked(usePortfolioModule.useAllPortfolios).mockReturnValue(mockQuery({ data: allPortfolios }));
    renderPage();

    await user.selectOptions(screen.getByLabelText(/ver cartera/i), '__all__');

    expect(usePortfolioModule.useAllPortfolios).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('heading', { name: /todas las carteras/i, level: 1 })).toBeInTheDocument();
    // Each client shows its owning agente/vendedor as a row badge. The vendedor
    // names ALSO appear as <select> options, so scope to the Agente badge.
    expect(screen.getByText('Ana Nueva')).toBeInTheDocument();
    expect(screen.getByText('Carlos Otro')).toBeInTheDocument();
    expect(screen.getByLabelText('Agente: Juan Vendedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Agente: Maria Vendedora')).toBeInTheDocument();
  });

  it('does not show the Agente badge in mi-cartera mode', () => {
    mockPermissions((p) => p === 'recapture.manage');
    renderPage();
    // Vendedor names appear only as <select> options here, never as Agente badges.
    expect(screen.queryByLabelText('Agente: Juan Vendedor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agente: Maria Vendedora')).not.toBeInTheDocument();
  });
});
