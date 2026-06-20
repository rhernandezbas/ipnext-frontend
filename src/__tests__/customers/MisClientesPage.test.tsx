import { render, screen, within } from '@testing-library/react';
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

/** Build N synthetic clients to exercise pagination (25 per page). */
function bigPortfolio(count: number): Portfolio {
  const items: PortfolioItem[] = Array.from({ length: count }, (_, i) =>
    item({ clientId: `c-${i}`, clientName: `Cliente ${String(i).padStart(3, '0')}`, ageBucket: '0-3' }),
  );
  return {
    unmapped: false,
    items,
    summary: {
      total: count,
      byBucket: { '0-3': count, '3-6': 0, '6-12': 0, '12+': 0 },
      active: count,
      withDebt: 0,
      withClaims: 0,
    },
  };
}

/** The rendered data table (excludes the selector/options, focuses on rows). */
function getTable() {
  return screen.getByRole('table');
}

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

  it('renders the summary KPI cards from the summary payload', () => {
    renderPage();
    // "Con deuda" / "Con reclamos" also exist as filter toggle buttons, so scope
    // the KPI assertions to the summary region.
    const summary = screen.getByLabelText('Resumen de la cartera');
    expect(within(summary).getByText('Total')).toBeInTheDocument();
    expect(within(summary).getByText('Activos')).toBeInTheDocument();
    expect(within(summary).getByText('Con deuda')).toBeInTheDocument();
    expect(within(summary).getByText('Con reclamos')).toBeInTheDocument();
  });

  it('renders the clickable age breakdown with every bucket count', () => {
    renderPage();
    const breakdown = screen.getByLabelText('Antigüedad de la cartera');
    // All four buckets render as toggle buttons (even empty ones).
    expect(within(breakdown).getByRole('button', { name: /0 a 3 meses/ })).toBeInTheDocument();
    expect(within(breakdown).getByRole('button', { name: /3 a 6 meses/ })).toBeInTheDocument();
    expect(within(breakdown).getByRole('button', { name: /6 a 12 meses/ })).toBeInTheDocument();
    expect(within(breakdown).getByRole('button', { name: /Más de 12 meses/ })).toBeInTheDocument();
  });

  it('renders client names, status badge, debt chip and claims chip in the table', () => {
    renderPage();
    const table = getTable();
    expect(within(table).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();
    expect(within(table).getByText('Deudor')).toBeInTheDocument();
    expect(within(table).getByText(/ARS\s*15\.000,00/)).toBeInTheDocument();
    expect(within(table).getByText('2 reclamos')).toBeInTheDocument();
  });

  it('makes each client name link to the client detail route', () => {
    renderPage();
    const link = screen.getByText('Ana Nueva').closest('a');
    expect(link).toHaveAttribute('href', '/admin/customers/view/c-1');
  });

  it('shows a "Mostrando X–Y de Z" counter', () => {
    renderPage();
    expect(screen.getByText(/Mostrando 1–2 de 2/)).toBeInTheDocument();
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
    // No table when there's no data at all.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
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

  // ── Filters (client-side) ───────────────────────────────────────────────────

  it('search by name reduces the list to matching clients', async () => {
    const user = userEvent.setup();
    renderPage();
    const table = getTable();
    expect(within(table).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'ana');

    expect(within(getTable()).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(getTable()).queryByText('Beto Deudor')).not.toBeInTheDocument();
  });

  it('filtering by status keeps only matching clients', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'late');

    const table = getTable();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();
    expect(within(table).queryByText('Ana Nueva')).not.toBeInTheDocument();
  });

  it('the "Con deuda" toggle keeps only clients with debt', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Con deuda' }));

    const table = getTable();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();
    expect(within(table).queryByText('Ana Nueva')).not.toBeInTheDocument();
  });

  it('the "Con reclamos" toggle keeps only clients with open claims', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Con reclamos' }));

    const table = getTable();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();
    expect(within(table).queryByText('Ana Nueva')).not.toBeInTheDocument();
  });

  it('clicking an age-breakdown card filters the table by that bucket', async () => {
    const user = userEvent.setup();
    renderPage();
    const breakdown = screen.getByLabelText('Antigüedad de la cartera');
    // Beto is 12+; clicking "Más de 12 meses" should drop Ana (0-3).
    await user.click(within(breakdown).getByRole('button', { name: /Más de 12 meses/ }));

    const table = getTable();
    expect(within(table).getByText('Beto Deudor')).toBeInTheDocument();
    expect(within(table).queryByText('Ana Nueva')).not.toBeInTheDocument();
  });

  it('shows a no-results state with a clear button when filters match nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'zzzz-no-match');

    expect(screen.getByTestId('no-results')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Clearing restores the full list.
    await user.click(within(screen.getByTestId('no-results')).getByRole('button', { name: /limpiar filtros/i }));
    expect(within(getTable()).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(getTable()).getByText('Beto Deudor')).toBeInTheDocument();
  });

  it('"Limpiar filtros" appears only when a filter is active and resets everything', async () => {
    const user = userEvent.setup();
    renderPage();
    // No clear button at rest.
    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Con deuda' }));
    const clearBtn = screen.getByRole('button', { name: /limpiar filtros/i });
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);
    expect(within(getTable()).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(getTable()).getByText('Beto Deudor')).toBeInTheDocument();
  });

  // ── Pagination (25 per page) ────────────────────────────────────────────────

  it('paginates the list to 25 rows per page and renders only the current page', () => {
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: bigPortfolio(30) }));
    renderPage();

    const table = getTable();
    const bodyRows = within(table).getAllByRole('row').slice(1); // drop the header row
    expect(bodyRows).toHaveLength(25);
    // First page shows the first 25 clients, not the last 5.
    expect(within(table).getByText('Cliente 000')).toBeInTheDocument();
    expect(within(table).queryByText('Cliente 029')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–25 de 30/)).toBeInTheDocument();
  });

  it('navigating to page 2 shows the remaining rows', async () => {
    const user = userEvent.setup();
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: bigPortfolio(30) }));
    renderPage();

    await user.click(screen.getByRole('button', { name: '2' }));

    const table = getTable();
    expect(within(table).getByText('Cliente 029')).toBeInTheDocument();
    expect(within(table).queryByText('Cliente 000')).not.toBeInTheDocument();
    expect(screen.getByText(/Mostrando 26–30 de 30/)).toBeInTheDocument();
  });

  it('changing a filter resets pagination back to page 1', async () => {
    const user = userEvent.setup();
    vi.mocked(usePortfolioModule.useMyPortfolio).mockReturnValue(mockQuery({ data: bigPortfolio(30) }));
    renderPage();

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText(/Mostrando 26–30 de 30/)).toBeInTheDocument();

    // Typing a search resets to page 1 (all 30 match "cliente").
    await user.type(screen.getByLabelText('Buscar cliente por nombre'), 'cliente');
    expect(screen.getByText(/Mostrando 1–/)).toBeInTheDocument();
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
    // Clients still render in the table.
    expect(within(getTable()).getByText('Ana Nueva')).toBeInTheDocument();
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
    // Each client shows its owning agente/vendedor as a table cell chip. The
    // vendedor names ALSO appear as <select> options, so scope to the Agente chip.
    const table = getTable();
    expect(within(table).getByText('Ana Nueva')).toBeInTheDocument();
    expect(within(table).getByText('Carlos Otro')).toBeInTheDocument();
    expect(within(table).getByLabelText('Agente: Juan Vendedor')).toBeInTheDocument();
    expect(within(table).getByLabelText('Agente: Maria Vendedora')).toBeInTheDocument();
    // The Agente column header is present.
    expect(within(table).getByRole('columnheader', { name: 'Agente' })).toBeInTheDocument();
  });

  it('does not show the Agente column in mi-cartera mode', () => {
    mockPermissions((p) => p === 'recapture.manage');
    renderPage();
    const table = getTable();
    expect(within(table).queryByLabelText('Agente: Juan Vendedor')).not.toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Agente' })).not.toBeInTheDocument();
  });
});
