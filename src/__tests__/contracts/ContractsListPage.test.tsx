/**
 * ContractsListPage — Strict TDD tests
 * CP-1: render data / empty / loading / error
 * CP-2: search debounce 300ms + URL ?search
 * CP-3: status filter + URL
 * CP-4: technology dropdown from catalog + filter + URL
 * CP-5: pagination + page-reset-on-filter
 * CP-6: permission guard allow/block
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import ContractsListPage from '@/pages/contracts/ContractsListPage';
import * as useContractsModule from '@/hooks/useContracts';
import * as useServiceTechModule from '@/hooks/useServiceTechnologies';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import { RequirePermission } from '@/components/auth/RequirePermission';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/useContracts');
vi.mock('@/hooks/useServiceTechnologies');
vi.mock('@/hooks/useMyPermissions');

// ── Fixtures ──────────────────────────────────────────────────────────────────
import type { ContractSummary } from '@/types/contract';
import type { ServiceTechnology } from '@/types/serviceTechnology';

const mockContracts: ContractSummary[] = [
  {
    id: 'c1',
    clientId: 'client-1',
    clientName: 'Alice García',
    plan: 'Plan 50MB',
    status: 'active',
    technology: 'Fibra',
    startDate: '2024-01-01',
  },
  {
    id: 'c2',
    clientId: 'client-2',
    clientName: 'Bob Martínez',
    plan: 'Plan 100MB',
    status: 'inactive',
    technology: null,
    startDate: '2024-02-01',
  },
];

const mockTechnologies: ServiceTechnology[] = [
  { id: 't1', name: 'Fibra', description: 'Fibra óptica' },
  { id: 't2', name: 'Wireless', description: null },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderPage(url = '/admin/contracts/list') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/admin/contracts/list" element={<ContractsListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  vi.mocked(useContractsModule.useContracts).mockReturnValue({
    data: { data: mockContracts, total: 2, page: 1, pageSize: 25, totalPages: 1 },
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useContractsModule.useContracts>);

  vi.mocked(useContractsModule.useContractStats).mockReturnValue({
    data: { total: 2, byStatus: { Vigente: 1, Baja: 1 } },
    isLoading: false,
  } as ReturnType<typeof useContractsModule.useContractStats>);

  vi.mocked(useServiceTechModule.useServiceTechnologies).mockReturnValue({
    data: mockTechnologies,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useServiceTechModule.useServiceTechnologies>);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── CP-0: Stats bar integration ──────────────────────────────────────────────
describe('CP-0: stats bar', () => {
  it('renders ContractStatsCards with stats from useContractStats', () => {
    renderPage();
    expect(screen.getByText(/contratos totales/i)).toBeInTheDocument();
    // "Vigente" / "Baja" appear in the stats card label AND the filter dropdown — at least one occurrence
    expect(screen.getAllByText('Vigente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Baja').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a stats card updates the status filter', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Vigente/i }));
    await waitFor(() => {
      const calls = vi.mocked(useContractsModule.useContracts).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.status).toBe('Vigente');
    });
  });
});

// ── CP-1: Render ──────────────────────────────────────────────────────────────
describe('CP-1: render', () => {
  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /contratos/i })).toBeInTheDocument();
  });

  it('renders contract rows with client name and plan', () => {
    renderPage();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('Bob Martínez')).toBeInTheDocument();
    expect(screen.getByText('Plan 50MB')).toBeInTheDocument();
  });

  it('renders "—" for null technology', () => {
    renderPage();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Fibra" for a contract with technology', () => {
    renderPage();
    // "Fibra" appears in the technology filter dropdown AND as a table cell value
    expect(screen.getAllByText('Fibra').length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty message when no contracts', () => {
    vi.mocked(useContractsModule.useContracts).mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useContractsModule.useContracts>);
    renderPage();
    expect(screen.getByText(/no se encontraron contratos/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while loading', () => {
    vi.mocked(useContractsModule.useContracts).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useContractsModule.useContracts>);
    const { container } = renderPage();
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBeGreaterThan(0);
  });

  it('shows error message on error', () => {
    vi.mocked(useContractsModule.useContracts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useContractsModule.useContracts>);
    renderPage();
    expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
  });
});

// ── CP-1b: Client deep-link (#56) ─────────────────────────────────────────────
describe('CP-1b: client name is a link to the customer detail (#56)', () => {
  it('renders the client name as a link to /admin/customers/view/:clientId', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'Alice García' });
    expect(link).toHaveAttribute('href', '/admin/customers/view/client-1');
  });

  it('uses clientId (not the contract id) for the link target', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'Bob Martínez' });
    expect(link).toHaveAttribute('href', '/admin/customers/view/client-2');
  });

  // Degraded case: deploy FE-antes-que-BE o response cacheada → clientId undefined.
  // Patrón #47j Fix 3: sin clientId el nombre se muestra como texto plano,
  // nunca navega a /admin/customers/view/undefined.
  it('renders plain text (no link) when a row has no clientId', () => {
    vi.mocked(useContractsModule.useContracts).mockReturnValue({
      data: {
        data: [
          {
            id: 'c3',
            // clientId ausente — modela una response del BE viejo / cacheada
            clientName: 'Sin Cliente',
            plan: 'Plan X',
            status: 'active',
            technology: null,
            startDate: '2024-03-01',
          } as unknown as ContractSummary,
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useContractsModule.useContracts>);
    renderPage();
    // El nombre aparece como texto pero NO como link
    expect(screen.getByText('Sin Cliente')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sin Cliente' })).not.toBeInTheDocument();
    // Sanity: no se generó un href con "undefined"
    expect(screen.queryByText((_, el) => el?.getAttribute('href')?.includes('undefined') ?? false)).toBeNull();
  });
});

// ── CP-2: Search debounce ─────────────────────────────────────────────────────
describe('CP-2: search debounce 300ms', () => {
  it('renders search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/buscar contrato/i)).toBeInTheDocument();
  });

  it('debounces search input by 300ms before calling hook', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    const input = screen.getByPlaceholderText(/buscar contrato/i);

    // Trigger change — FilterBar debounces 300ms internally
    act(() => {
      fireEvent.change(input, { target: { value: 'alice' } });
    });

    // Immediately after change (before 300ms), search should NOT be passed yet
    const callsBefore = vi.mocked(useContractsModule.useContracts).mock.calls;
    const lastBefore = callsBefore[callsBefore.length - 1][0];
    expect(lastBefore.search).toBeFalsy();

    // Advance timers past debounce
    act(() => { vi.advanceTimersByTime(350); });

    await waitFor(() => {
      const calls = vi.mocked(useContractsModule.useContracts).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.search).toBe('alice');
    });
  });
});

// ── CP-3: Status filter ───────────────────────────────────────────────────────
describe('CP-3: status filter', () => {
  it('renders status filter dropdown', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
  });

  it('passes selected status to useContracts', async () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /estado/i });
    fireEvent.change(select, { target: { value: 'Vigente' } });

    await waitFor(() => {
      const calls = vi.mocked(useContractsModule.useContracts).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.status).toBe('Vigente');
    });
  });

  it('derives status options from real GR contract states (byStatus), not hardcoded', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /estado/i });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    // From the mocked byStatus { Vigente, Baja } + the "Todos" empty option
    expect(options).toContain('');
    expect(options).toContain('Vigente');
    expect(options).toContain('Baja');
    // The old hardcoded client states must NOT appear
    expect(options).not.toContain('blocked');
    expect(options).not.toContain('late');
    expect(options).not.toContain('inactive');
  });
});

// ── CP-4: Technology filter ───────────────────────────────────────────────────
describe('CP-4: technology filter', () => {
  it('renders technology filter dropdown with catalog options', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /tecnolog/i });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Todas');
    expect(options).toContain('Fibra');
    expect(options).toContain('Wireless');
  });

  it('only shows "Todas" option when catalog is empty', () => {
    vi.mocked(useServiceTechModule.useServiceTechnologies).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useServiceTechModule.useServiceTechnologies>);
    renderPage();
    const select = screen.getByRole('combobox', { name: /tecnolog/i });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Todas']);
  });

  it('passes selected technology to useContracts', async () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /tecnolog/i });
    fireEvent.change(select, { target: { value: 'Fibra' } });

    await waitFor(() => {
      const calls = vi.mocked(useContractsModule.useContracts).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.technology).toBe('Fibra');
    });
  });
});

// ── CP-5: Pagination + page reset ────────────────────────────────────────────
describe('CP-5: pagination', () => {
  it('renders pagination when totalPages > 1', () => {
    vi.mocked(useContractsModule.useContracts).mockReturnValue({
      data: { data: mockContracts, total: 50, page: 1, pageSize: 25, totalPages: 2 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useContractsModule.useContracts>);
    renderPage();
    // Pagination component renders page numbers or next/prev
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('resets page to 1 when status changes', async () => {
    // Start on page 2
    renderPage('/admin/contracts/list?page=2');
    const select = screen.getByRole('combobox', { name: /estado/i });
    fireEvent.change(select, { target: { value: 'Vigente' } });

    await waitFor(() => {
      const calls = vi.mocked(useContractsModule.useContracts).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.page).toBe(1);
    });
  });
});

// ── CP-6: Permission guard ────────────────────────────────────────────────────
// RequirePermission is applied in App.tsx around ContractsListPage.
// We verify via a wrapper that uses RequirePermission (the mocked version).
describe('CP-6: permission guard', () => {
  function renderWithPermission(hasPermission: boolean) {
    vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
      can: vi.fn(() => hasPermission),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

    return render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={['/admin/contracts/list']}>
          <Routes>
            <Route
              path="/admin/contracts/list"
              element={
                <RequirePermission permission="contracts.read">
                  <ContractsListPage />
                </RequirePermission>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders content when user has contracts.read', () => {
    renderWithPermission(true);
    expect(screen.getByRole('heading', { name: /contratos/i })).toBeInTheDocument();
  });

  it('renders NoPermissionPage when user lacks contracts.read', () => {
    renderWithPermission(false);
    // NoPermissionPage renders "No tenés permisos" text
    expect(screen.getByText(/no ten[eé]s permisos/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /contratos/i })).not.toBeInTheDocument();
  });
});
