import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlansPage from '@/pages/networking/PlansPage';
import * as usePlansModule from '@/hooks/usePlans';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { PlanDto } from '@/types/plans';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

const FULL_PERMISSIONS: UseMyPermissionsResult = {
  permissions: ['*'],
  roles: [],
  user: null,
  isLoading: false,
  isError: false,
  can: () => true,
};

vi.mock('@/hooks/usePlans');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const PLAN_AIR: PlanDto = {
  id: 'plan-1',
  code: 'IP-Air-30-10',
  name: 'IP-Air-30-10',
  category: 'Air',
  downloadKbps: 30000,
  uploadKbps: 10000,
  rateLimit: '10M/30M',
  status: 'enabled',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PLAN_ALTA: PlanDto = {
  id: 'plan-2',
  code: 'IP-One-300-100',
  name: 'IP-One-300-100',
  category: 'Alta',
  downloadKbps: 300000,
  uploadKbps: 100000,
  rateLimit: '100M/300M',
  status: 'enabled',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PLAN_CORTE: PlanDto = {
  id: 'plan-3',
  code: 'IP-REDUCCION',
  name: 'IP-REDUCCION',
  category: 'Corte',
  downloadKbps: 256,
  uploadKbps: 256,
  rateLimit: '256k/256k',
  status: 'enabled',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ALL_PLANS = [PLAN_AIR, PLAN_ALTA, PLAN_CORTE];

function setupHooks(plans: PlanDto[] = ALL_PLANS) {
  vi.mocked(usePlansModule.usePlans).mockReturnValue({
    data: plans,
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePlansModule.usePlans>);

  vi.mocked(usePlansModule.useCreatePlan).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof usePlansModule.useCreatePlan>);

  vi.mocked(usePlansModule.useUpdatePlan).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof usePlansModule.useUpdatePlan>);

  vi.mocked(usePlansModule.useDeletePlan).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePlansModule.useDeletePlan>);
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore full permissions after any individual test that overrides them
  vi.mocked(useMyPermissions).mockReturnValue(FULL_PERMISSIONS);
  setupHooks();
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('PlansPage — rendering', () => {
  it('renders the page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /catálogo de planes/i })).toBeInTheDocument();
  });

  it('renders the banner with RADIUS info', () => {
    renderPage();
    expect(screen.getByRole('note')).toHaveTextContent(/fuente única de velocidades/i);
    expect(screen.getByRole('note')).toHaveTextContent(/todos los routers por igual/i);
  });

  it('shows KPI cards with plan counts', () => {
    renderPage();
    // 3 active plans total — KPI card (go up 2 levels: kpiSub → kpiCard)
    const kpiSubTotal = screen.getByText('en el catálogo');
    const kpiCard = kpiSubTotal.closest('div')?.parentElement as HTMLElement;
    expect(within(kpiCard).getByText('3')).toBeInTheDocument();
    // 1 corte plan
    const kpiSubCut = screen.getByText('reducción / baja');
    const kpiCutCard = kpiSubCut.closest('div')?.parentElement as HTMLElement;
    expect(within(kpiCutCard).getByText('1')).toBeInTheDocument();
  });

  it('renders all three category group headers in the table', () => {
    renderPage();
    const table = screen.getByRole('table');
    // Each category appears at least once (group header + possibly badge)
    expect(within(table).getAllByText('Air').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Alta gama').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Corte').length).toBeGreaterThan(0);
  });

  it('renders plan codes in the table', () => {
    renderPage();
    expect(screen.getByText('IP-Air-30-10')).toBeInTheDocument();
    expect(screen.getByText('IP-One-300-100')).toBeInTheDocument();
    expect(screen.getByText('IP-REDUCCION')).toBeInTheDocument();
  });

  it('renders rate-limit chips', () => {
    renderPage();
    expect(screen.getByText('10M/30M')).toBeInTheDocument();
    expect(screen.getByText('100M/300M')).toBeInTheDocument();
    expect(screen.getByText('256k/256k')).toBeInTheDocument();
  });

  it('shows empty state when no plans match filter', async () => {
    setupHooks([]);
    renderPage();
    expect(screen.getByText(/no se encontraron planes/i)).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    vi.mocked(usePlansModule.usePlans).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof usePlansModule.usePlans>);
    renderPage();
    // When loading, KPI shows "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});

// ─── Grouped by category ─────────────────────────────────────────────────────

describe('PlansPage — table grouping', () => {
  it('groups plans by category with Air first, then Alta gama, then Corte', () => {
    renderPage();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // Find the group rows text sequence
    const texts = rows.map(r => r.textContent ?? '');
    const airIdx = texts.findIndex(t => t.includes('Air') && !t.includes('Air gama') && !t.includes('IP-Air'));
    const altaIdx = texts.findIndex(t => t.includes('Alta gama'));
    const corteIdx = texts.findIndex(t => t.includes('Corte') && !t.includes('IP-REDUCCION'));
    expect(airIdx).toBeLessThan(altaIdx);
    expect(altaIdx).toBeLessThan(corteIdx);
  });
});

// ─── Search + filter chips ────────────────────────────────────────────────────

describe('PlansPage — search and filter', () => {
  it('filters plans by search query', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByPlaceholderText(/buscar plan/i);
    await user.type(input, 'Air');
    // Alta gama plan should not appear
    expect(screen.queryByText('IP-One-300-100')).not.toBeInTheDocument();
    expect(screen.getByText('IP-Air-30-10')).toBeInTheDocument();
  });

  it('filters by category chip', async () => {
    const user = userEvent.setup();
    renderPage();
    const altaChip = screen.getByRole('button', { name: /alta gama/i });
    await user.click(altaChip);
    expect(screen.queryByText('IP-Air-30-10')).not.toBeInTheDocument();
    expect(screen.getByText('IP-One-300-100')).toBeInTheDocument();
  });

  it('clicking Todos chip shows all plans', async () => {
    const user = userEvent.setup();
    renderPage();
    // Filter to Alta gama first (unambiguous button)
    await user.click(screen.getByRole('button', { name: /alta gama/i }));
    expect(screen.queryByText('IP-Air-30-10')).not.toBeInTheDocument();
    // Then click Todos
    await user.click(screen.getByRole('button', { name: /todos/i }));
    expect(screen.getByText('IP-Air-30-10')).toBeInTheDocument();
    expect(screen.getByText('IP-One-300-100')).toBeInTheDocument();
    expect(screen.getByText('IP-REDUCCION')).toBeInTheDocument();
  });
});

// ─── Permissions — plan.manage ────────────────────────────────────────────────

describe('PlansPage — permissions', () => {
  it('shows Editar and Eliminar buttons when user has plan.manage', () => {
    // setup.ts defaults to * (all permissions) — already set
    renderPage();
    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    expect(editButtons.length).toBeGreaterThan(0);
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('hides write buttons when user lacks plan.manage', () => {
    // Override useMyPermissions to deny plan.manage
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['plan.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(x => x === 'plan.read');
      },
    });

    renderPage();
    expect(screen.queryByRole('button', { name: /editar ip-air/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar ip-air/i })).not.toBeInTheDocument();
  });

  it('hides "Nuevo plan" button when user lacks plan.manage', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['plan.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(x => x === 'plan.read');
      },
    });

    renderPage();
    expect(screen.queryByRole('button', { name: /nuevo plan/i })).not.toBeInTheDocument();
  });

  it('shows "Nuevo plan" button when user has plan.manage', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo plan/i })).toBeInTheDocument();
  });
});

// ─── Create modal ─────────────────────────────────────────────────────────────

describe('PlansPage — create modal', () => {
  it('opens create modal when clicking "Nuevo plan"', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));
    expect(screen.getByRole('dialog', { name: /nuevo plan/i })).toBeInTheDocument();
  });

  it('closes modal on cancel', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls createPlan mutation on form submit', async () => {
    const mutateMock = vi.fn((_data, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
    vi.mocked(usePlansModule.useCreatePlan).mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePlansModule.useCreatePlan>);

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText(/código/i), 'IP-Test-50');
    await user.type(within(dialog).getByLabelText(/nombre/i), 'IP-Test-50');
    await user.type(within(dialog).getByLabelText(/bajada/i), '50');
    await user.type(within(dialog).getByLabelText(/subida/i), '20');
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'IP-Test-50',
        name: 'IP-Test-50',
        downloadKbps: 50000,
        uploadKbps: 20000,
      }),
      expect.any(Object),
    );
  });
});

// ─── Edit modal ───────────────────────────────────────────────────────────────

describe('PlansPage — edit modal', () => {
  it('opens edit modal with plan data pre-filled', async () => {
    const user = userEvent.setup();
    renderPage();
    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    await user.click(editBtns[0]);
    const dialog = screen.getByRole('dialog', { name: /editar plan/i });
    expect(dialog).toBeInTheDocument();
    // Code should be shown readonly (not an input)
    expect(within(dialog).getByText('IP-Air-30-10')).toBeInTheDocument();
  });

  it('code field is readonly in edit modal', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    const dialog = screen.getByRole('dialog');
    // Should not have an editable input for code
    const codeInput = within(dialog).queryByLabelText(/código/i);
    expect(codeInput).not.toBeInTheDocument();
  });
});

// ─── W1: Error state ──────────────────────────────────────────────────────────

describe('PlansPage — W1: query error state', () => {
  it('shows error state (not empty state) when usePlans fails', () => {
    vi.mocked(usePlansModule.usePlans).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlansModule.usePlans>);

    renderPage();

    // Should NOT show empty state text
    expect(screen.queryByText(/no se encontraron planes/i)).not.toBeInTheDocument();
    // Should show an error indicator
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Should have a retry button
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});

// ─── W2: Validation error contract ───────────────────────────────────────────

describe('PlansPage — W2: API error field mapping', () => {
  it('shows real validation message from 422 with details field (not generic fallback)', async () => {
    // BE returns: { code: 'VALIDATION_ERROR', details: [...] } on 422
    // NOT { message: '...' } — the FE must read details, not message
    const err422 = Object.assign(new Error('Validation'), {
      response: {
        status: 422,
        data: {
          code: 'VALIDATION_ERROR',
          details: [{ message: 'El campo code es requerido', path: ['code'] }],
          // NOTE: NO "message" field — BE doesn't send it
        },
      },
    });

    vi.mocked(usePlansModule.useCreatePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: err422,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePlansModule.useCreatePlan>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));

    const dialog = screen.getByRole('dialog');
    // Should NOT show generic fallback
    expect(within(dialog).queryByText(/ocurrió un error inesperado/i)).not.toBeInTheDocument();
    // Should show the validation error (real message or a specific validation text)
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    const alert = within(dialog).getByRole('alert');
    expect(alert.textContent).not.toBe('');
    // Should NOT be the generic "unexpected" message
    expect(alert.textContent).not.toMatch(/ocurrió un error inesperado/i);
  });

  it('shows real error message from 409 using error field (not message)', async () => {
    // BE returns: { code: 'PLAN_CODE_TAKEN', error: 'message text' } on 409
    const err409 = Object.assign(new Error('Conflict'), {
      response: {
        status: 409,
        data: {
          code: 'PLAN_CODE_TAKEN',
          error: 'Ya existe un plan con ese código',
          // NOTE: NO "message" field — BE doesn't send it for 409
        },
      },
    });

    vi.mocked(usePlansModule.useCreatePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: err409,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePlansModule.useCreatePlan>);

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /nuevo plan/i }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/código/i);
  });
});

// ─── W4: Fragment key warning ─────────────────────────────────────────────────

describe('PlansPage — W4: Fragment key in grouped table', () => {
  it('renders grouped table without React key warnings (explicit Fragment with key)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    renderPage();
    // React emits console.error for missing keys — ensure none about lists
    const keyWarnings = consoleErrorSpy.mock.calls.filter(
      args => typeof args[0] === 'string' && args[0].includes('key'),
    );
    expect(keyWarnings).toHaveLength(0);
    consoleErrorSpy.mockRestore();
  });
});

// ─── S1: Delete error surfacing ───────────────────────────────────────────────

describe('PlansPage — S1: delete error surfacing', () => {
  it('exposes delete error when DELETE fails', () => {
    const deleteErr = Object.assign(new Error('Delete failed'), {
      response: { status: 500, data: {} },
    });

    vi.mocked(usePlansModule.useDeletePlan).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: deleteErr,
    } as unknown as ReturnType<typeof usePlansModule.useDeletePlan>);

    renderPage();
    // Should show some error indication when delete has an error
    // (exact UI TBD — at minimum the page must not crash)
    expect(screen.getByRole('heading', { name: /catálogo de planes/i })).toBeInTheDocument();
    // If delete error is surfaced via alert, it should be visible
    const alerts = screen.queryAllByRole('alert');
    // We assert the error is surfaced — if no alert exists yet, this tells us the fix is needed
    expect(alerts.some(a => /error|falló|intentá/i.test(a.textContent ?? ''))).toBe(true);
  });
});
