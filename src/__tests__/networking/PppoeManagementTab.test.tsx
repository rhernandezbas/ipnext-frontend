/**
 * Tests — Phases 6 & 7: PppoeManagementTab component.
 *
 * Phase 6: tabla, filtros, loading/error/empty, permisos
 * Phase 7: modales (crear, editar, renombrar), credenciales, baja
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── component under test ──────────────────────────────────────────────────────
import { PppoeManagementTab } from '@/pages/networking/PppoeManagementTab';

// ── types ─────────────────────────────────────────────────────────────────────
import type { PppoeServiceListResult, PppoeServiceListItem } from '@/types/internetService';
import type { NasServer } from '@/types/nas';
import type { PlanDto } from '@/types/plans';

// ── mock modules ──────────────────────────────────────────────────────────────
vi.mock('@/hooks/useInternetServices', () => ({
  useAllPppoe: vi.fn(),
}));
vi.mock('@/hooks/useNas', () => ({
  useNasServers: vi.fn(),
}));
vi.mock('@/hooks/usePlans', () => ({
  usePlans: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));
vi.mock('@/hooks/usePppoe', () => ({
  useCreatePppoeStandalone: vi.fn(),
  useRenamePppoe: vi.fn(),
  useUpdatePppoeGlobal: vi.fn(),
  useMovePppoeGlobal: vi.fn(),
  useDeactivatePppoeGlobal: vi.fn(),
  usePppoeCredentials: vi.fn(),
  useBulkChangePppoePlan: vi.fn(),
  useBulkChangePppoePlanBatch: vi.fn(),
  useListPppoeIds: vi.fn(),
  GLOBAL_LIST_KEY: ['pppoe', 'list'],
}));

// ── import mocked modules ─────────────────────────────────────────────────────
import { useAllPppoe } from '@/hooks/useInternetServices';
import { useNasServers } from '@/hooks/useNas';
import { usePlans } from '@/hooks/usePlans';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useCreatePppoeStandalone,
  useRenamePppoe,
  useUpdatePppoeGlobal,
  useMovePppoeGlobal,
  useDeactivatePppoeGlobal,
  usePppoeCredentials,
  useBulkChangePppoePlan,
  useBulkChangePppoePlanBatch,
  useListPppoeIds,
} from '@/hooks/usePppoe';

// ── fixtures ──────────────────────────────────────────────────────────────────
const mockNasServers: NasServer[] = [
  {
    id: 'nas-1',
    name: 'NAS Central',
    type: 'radius_orchestrator',
    ipAddress: '10.0.0.1',
    nasIpAddress: '10.0.0.1',
    radiusSecret: 'secret',
    apiPort: null,
    apiLogin: null,
    apiPassword: null,
    status: 'active',
    lastSeen: null,
    clientCount: 10,
    description: '',
  },
];

const mockPlans: PlanDto[] = [
  {
    id: 'plan-1',
    code: 'IP-5M',
    name: 'IP 5M',
    category: 'Alta',
    downloadKbps: 5000,
    uploadKbps: 1000,
    rateLimit: '5M/1M',
    status: 'enabled',
    createdAt: '2026-01-01',
  },
  {
    id: 'plan-corte',
    code: 'CORTE',
    name: 'Plan Corte',
    category: 'Corte',
    downloadKbps: 128,
    uploadKbps: 128,
    rateLimit: '128k',
    status: 'enabled',
    createdAt: '2026-01-01',
  },
];

const mockItems: PppoeServiceListItem[] = [
  {
    id: 'pppoe-1',
    username: 'cliente01',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    status: 'active',
    profile: 'IP-5M',
    nasId: 'nas-1',
    nasName: 'NAS Central',
    nasType: 'radius_orchestrator',
    contractId: 'contract-1',
    remoteAddress: '10.0.0.1',
    ipMode: 'fixed',
    enforcedState: 'active',
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pppoe-orphan',
    username: 'huerfano01',
    clientId: null,
    customerName: null,
    status: 'inactive',
    profile: null,
    nasId: 'nas-1',
    nasName: 'NAS Central',
    nasType: 'radius_orchestrator',
    contractId: null,
    remoteAddress: null,
    ipMode: 'pool',
    enforcedState: 'active',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const mockListResult: PppoeServiceListResult = {
  data: mockItems,
  total: 2,
  page: 1,
  limit: 25,
};

// ── helpers ───────────────────────────────────────────────────────────────────
function makeMutationMock(mutateAsync = vi.fn().mockResolvedValue({})) {
  return { mutate: vi.fn(), mutateAsync, isPending: false, isError: false, isSuccess: false };
}

function makeQueryMock<T>(
  data: T,
  opts: { isLoading?: boolean; isError?: boolean; isFetching?: boolean; refetch?: () => void } = {},
) {
  return {
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
    isFetching: opts.isFetching ?? false,
    refetch: opts.refetch ?? vi.fn(),
    isSuccess: !opts.isLoading && !opts.isError,
  };
}

function setup(canManage = true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    can: () => canManage,
    isLoading: false,
    isError: false,
    user: null as never,
    roles: [],
    permissions: [],
  });
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  vi.mocked(useNasServers).mockReturnValue(makeQueryMock(mockNasServers) as never);
  vi.mocked(usePlans).mockReturnValue(makeQueryMock(mockPlans) as never);
  vi.mocked(useAllPppoe).mockReturnValue(makeQueryMock(mockListResult) as never);
  vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useRenamePppoe).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useUpdatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useMovePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useDeactivatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(usePppoeCredentials).mockReturnValue(makeQueryMock(null) as never);
  vi.mocked(useBulkChangePppoePlan).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useListPppoeIds).mockReturnValue(
    makeMutationMock(vi.fn().mockResolvedValue({ ids: [], total: 0 })) as never,
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PppoeManagementTab />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — tabla
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — tabla básica', () => {
  it('muestra el username del primer item', () => {
    renderTab();
    expect(screen.getByText('cliente01')).toBeInTheDocument();
  });

  it('muestra el username del item huérfano', () => {
    renderTab();
    expect(screen.getByText('huerfano01')).toBeInTheDocument();
  });

  it('muestra el nombre del cliente cuando clientId no es null', () => {
    renderTab();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });

  it('muestra indicador "Sin contrato" para el item con clientId=null', () => {
    renderTab();
    expect(screen.getByText(/sin contrato/i)).toBeInTheDocument();
  });

  it('muestra el plan del primer item', () => {
    renderTab();
    expect(screen.getByText('IP-5M')).toBeInTheDocument();
  });

  it('muestra el nombre del NAS', () => {
    renderTab();
    // NAS Central aparece en la columna NAS de cada fila
    const items = screen.getAllByText('NAS Central');
    expect(items.length).toBeGreaterThan(0);
  });

  it('no muestra paginación cuando hay 2 resultados (total <= 25)', () => {
    renderTab();
    // Pagination component returns null when totalPages <= 1.
    // Se busca el <nav aria-label="Paginación"> específico (el queryByLabelText(/página/i)
    // anterior colisionaba con el checkbox "Seleccionar todos de esta página" del bulk).
    expect(screen.queryByRole('navigation', { name: /paginación/i })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — paginación
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — paginación', () => {
  it('muestra controles de paginación cuando hay más de 25 resultados', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, total: 50 }) as never,
    );
    renderTab();
    // Pagination renders buttons for page navigation
    const buttons = screen.getAllByRole('button');
    // At minimum there should be more buttons than just "Crear PPPoE" and action buttons
    expect(buttons.length).toBeGreaterThan(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — filtros
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — filtros', () => {
  it('hay un input de búsqueda', () => {
    renderTab();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('el select de NAS contiene una opción "todos"', () => {
    renderTab();
    const selects = screen.getAllByRole('combobox');
    const allOptionTexts = selects.flatMap(s =>
      Array.from(s.querySelectorAll('option')).map(o => o.textContent ?? ''),
    );
    expect(allOptionTexts.some(t => /todos/i.test(t))).toBe(true);
  });

  it('el select de NAS contiene la opción "NAS Central"', () => {
    renderTab();
    expect(screen.getByRole('option', { name: 'NAS Central' })).toBeInTheDocument();
  });

  it('el select de estado contiene opciones de status', () => {
    renderTab();
    const selects = screen.getAllByRole('combobox');
    const allOptionTexts = selects.flatMap(s =>
      Array.from(s.querySelectorAll('option')).map(o => o.textContent ?? ''),
    );
    // At least one status label should appear
    expect(allOptionTexts.some(t => /activo|reducido|bloqueado|baja|inactivo/i.test(t))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — loading / error / empty
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — estados especiales', () => {
  it('muestra spinner/skeleton cuando isLoading=true', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock(undefined, { isLoading: true }) as never,
    );
    renderTab();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando isError=true', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock(undefined, { isError: true }) as never,
    );
    renderTab();
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it('muestra botón "Reintentar" en estado de error', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock(undefined, { isError: true }) as never,
    );
    renderTab();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('muestra estado vacío cuando no hay datos', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, data: [], total: 0 }) as never,
    );
    renderTab();
    expect(screen.getByText(/no se encontraron/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — permisos
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — permisos', () => {
  it('muestra botón "Crear PPPoE" cuando el usuario tiene pppoe.manage', () => {
    setup(true);
    renderTab();
    expect(screen.getByRole('button', { name: /crear pppoe/i })).toBeInTheDocument();
  });

  it('oculta botón "Crear PPPoE" cuando el usuario NO tiene pppoe.manage', () => {
    setup(false);
    renderTab();
    expect(screen.queryByRole('button', { name: /crear pppoe/i })).toBeNull();
  });

  it('oculta el menú de acciones por fila cuando no hay permiso', () => {
    setup(false);
    renderTab();
    // KebabMenu has aria-label="Acciones"
    expect(screen.queryAllByRole('button', { name: 'Acciones' })).toHaveLength(0);
  });

  it('muestra el menú de acciones por fila cuando hay permiso', () => {
    setup(true);
    renderTab();
    expect(screen.getAllByRole('button', { name: 'Acciones' }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — modal Crear PPPoE
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — modal Crear PPPoE', () => {
  it('abre el modal al hacer click en "Crear PPPoE"', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra solo los planes no-Corte en el select de plan', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
    // "IP 5M" should appear, "Plan Corte" should NOT
    expect(screen.queryByRole('option', { name: 'IP 5M' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Plan Corte' })).toBeNull();
  });

  it('submit llama a createStandalone.mutateAsync con los datos del form', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreatePppoeStandalone).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));

    const dialog = screen.getByRole('dialog');

    // Fill NAS
    await userEvent.selectOptions(within(dialog).getByLabelText(/nas/i), 'nas-1');
    // Fill plan
    await userEvent.selectOptions(within(dialog).getByLabelText(/plan/i), 'IP-5M');
    // Fill username
    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'nuevo01');
    // Fill password
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass123');

    // Submit
    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'nuevo01',
          password: 'pass123',
          nasId: 'nas-1',
          plan: 'IP-5M',
        }),
      );
    });
  });

  it('NO incluye contractId en el body por defecto (standalone)', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreatePppoeStandalone).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
    const dialog = screen.getByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByLabelText(/nas/i), 'nas-1');
    await userEvent.selectOptions(within(dialog).getByLabelText(/plan/i), 'IP-5M');
    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'standalone01');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass456');

    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => {
      const args = mutateAsync.mock.calls[0]?.[0];
      expect(args).toBeDefined();
      expect(args.contractId).toBeUndefined();
    });
  });

  it('cierra el modal al hacer click en Cancelar', async () => {
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — modal Renombrar
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — modal Renombrar', () => {
  async function openRenameModal() {
    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    const renameOption = screen.getByRole('menuitem', { name: /cambiar usuario/i });
    await userEvent.click(renameOption);
  }

  it('abre el modal de renombrar al hacer click en "Cambiar usuario"', async () => {
    await openRenameModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra advertencia de reconfiguración de CPE', async () => {
    await openRenameModal();
    expect(screen.getByText(/reconfigurar/i)).toBeInTheDocument();
  });

  it('llama a renamePppoe.mutateAsync con el id y newUsername', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'pppoe-1', username: 'nuevo01', status: 'ok' });
    vi.mocked(useRenamePppoe).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await openRenameModal();
    const dialog = screen.getByRole('dialog');

    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'cliente01nuevo');
    await userEvent.click(within(dialog).getByRole('button', { name: /renombrar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pppoe-1', newUsername: 'cliente01nuevo' }),
      );
    });
  });

  it('muestra alerta de advertencia cuando la respuesta es partial', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      id: 'pppoe-1',
      username: 'nuevo01',
      status: 'partial',
      message: 'El secret viejo no pudo eliminarse',
    });
    vi.mocked(useRenamePppoe).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await openRenameModal();
    const dialog = screen.getByRole('dialog');

    await userEvent.type(within(dialog).getByRole('textbox'), 'nuevousuario');
    await userEvent.click(within(dialog).getByRole('button', { name: /renombrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/secret viejo/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — credenciales (lazy reveal)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — credenciales lazy', () => {
  it('usePppoeCredentials se llama con enabled=false antes del click', () => {
    renderTab();
    // Every call to usePppoeCredentials should have enabled=false initially
    const calls = vi.mocked(usePppoeCredentials).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, enabled]) => enabled === false)).toBe(true);
  });

  it('hay botones para revelar contraseña (ojo) en cada fila', () => {
    renderTab();
    const eyeBtns = screen.getAllByRole('button', { name: /revelar|contraseña|password/i });
    expect(eyeBtns.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — baja (delete)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — baja (delete)', () => {
  it('abre confirm y llama a deactivatePppoeGlobal.mutateAsync al confirmar', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeactivatePppoeGlobal).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);

    const bajaOption = screen.getByRole('menuitem', { name: /baja/i });
    await userEvent.click(bajaOption);

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pppoe-1' }),
    ));
  });

  it('NO llama a deactivate si el usuario cancela el confirm', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn();
    vi.mocked(useDeactivatePppoeGlobal).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);

    const bajaOption = screen.getByRole('menuitem', { name: /baja/i });
    await userEvent.click(bajaOption);

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F1 — credenciales gateadas por pppoe.manage
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F1: ojo de contraseña gateado con pppoe.manage', () => {
  it('oculta el ojo de contraseña cuando no hay pppoe.manage', () => {
    setup(false);
    renderTab();
    expect(screen.queryAllByRole('button', { name: /revelar contraseña/i })).toHaveLength(0);
  });

  it('muestra el ojo de contraseña cuando hay pppoe.manage', () => {
    setup(true);
    renderTab();
    expect(screen.getAllByRole('button', { name: /revelar contraseña/i }).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F2 — feedback de error en mutaciones (inline en modales, visible en kebab)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F2: error feedback en mutaciones', () => {
  it('muestra error inline en CreatePppoeModal cuando mutateAsync rechaza', async () => {
    vi.mocked(useCreatePppoeStandalone).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('409 Conflict'))),
    } as never);
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'u1');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'p1');
    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    // modal debe permanecer abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra error inline en EditPppoeModal cuando mutateAsync rechaza', async () => {
    vi.mocked(useUpdatePppoeGlobal).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('422 Unprocessable'))),
    } as never);
    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /editar/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    // modal debe permanecer abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra feedback visible cuando handleDeactivate falla (kebab)', async () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useDeactivatePppoeGlobal).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('502 Bad Gateway'))),
    } as never);
    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /baja/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F3 — status "reduced" debe renderizar badge ámbar (late), no verde (active)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F3: reduced badge ámbar', () => {
  it('badge de un item "reduced" tiene class "late" (ámbar), no "active" (verde)', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, data: [{ ...mockItems[0], status: 'reduced' }] }) as never,
    );
    const { container } = renderTab();
    // PppoeStatusBadge renders <span class="badge late">Reducido</span>
    // Usamos querySelector para filtrar por clase CSS (strategy: non-scoped en vitest config).
    // "Reducido" también aparece como option en el select de estado — querySelector('.late')
    // distingue la span del badge del option del filtro.
    const badge = container.querySelector('.late');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('active')).toBe(false);
    expect(badge!.textContent).toBe('Reducido');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F4 — rename partial SIN message muestra advertencia (no cierra silencioso)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F4: rename partial sin message', () => {
  it('muestra advertencia cuando la respuesta es partial sin message', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ status: 'partial' }); // sin message
    vi.mocked(useRenamePppoe).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /cambiar usuario/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'nuevousuario');
    await userEvent.click(within(dialog).getByRole('button', { name: /renombrar/i }));

    // debe mostrar una advertencia aunque no haya message en la respuesta
    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    // modal debe permanecer abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F5 — edit NO debe incluir status en el body si no se modificó
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F5: edit no pisa status si no se tocó', () => {
  it('no incluye status en el body cuando solo se edita el plan', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdatePppoeGlobal).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /editar/i }));
    const dialog = screen.getByRole('dialog');

    // seleccionamos el plan pero NO tocamos el select de estado
    await userEvent.selectOptions(within(dialog).getByLabelText(/plan/i), 'IP-5M');
    await userEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const body = mutateAsync.mock.calls[0][0].body as Record<string, unknown>;
    expect(body).not.toHaveProperty('status');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F2 (continued) — ramas de error faltantes: move, suspend, reactivate, rename-throw
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F2: ramas de error faltantes', () => {
  it('muestra error inline en MoveNasModal y NO cierra el modal cuando mutateAsync rechaza', async () => {
    vi.mocked(useMovePppoeGlobal).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('500 Internal Server Error'))),
    } as never);
    // Segundo NAS para que el select de destino tenga opciones
    vi.mocked(useNasServers).mockReturnValue(
      makeQueryMock([
        ...mockNasServers,
        { ...mockNasServers[0], id: 'nas-2', name: 'NAS Norte' },
      ]) as never,
    );

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /mover nas/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText(/nas destino/i), 'nas-2');
    await userEvent.click(within(dialog).getByRole('button', { name: /^mover$/i }));

    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    // modal debe permanecer abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra error banner visible cuando handleSuspend falla (kebab)', async () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useUpdatePppoeGlobal).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('503 Service Unavailable'))),
    } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    // mockItems[0] tiene status 'active' → muestra "Suspender"
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /^suspender$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('muestra error banner visible cuando handleReactivate falla (kebab)', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, data: [{ ...mockItems[0], status: 'blocked' }] }) as never,
    );
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useUpdatePppoeGlobal).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('503 Service Unavailable'))),
    } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    // item con status 'blocked' → muestra "Reactivar"
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /^reactivar$/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('muestra error inline en RenameModal y NO cierra el modal cuando mutateAsync rechaza', async () => {
    vi.mocked(useRenamePppoe).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('409 Conflict'))),
    } as never);

    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    await userEvent.click(screen.getByRole('menuitem', { name: /cambiar usuario/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'nuevousuario');
    await userEvent.click(within(dialog).getByRole('button', { name: /renombrar/i }));

    await waitFor(() => expect(within(dialog).getByRole('alert')).toBeInTheDocument());
    // modal debe permanecer abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F8 — baja no ofrece Suspender ni Reactivar
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab — F8: item en baja no muestra Suspender/Reactivar', () => {
  it('no ofrece "Suspender" a un item en baja', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, data: [{ ...mockItems[0], status: 'baja' }] }) as never,
    );
    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    expect(screen.queryByRole('menuitem', { name: /^suspender$/i })).toBeNull();
  });

  it('no ofrece "Reactivar" a un item en baja', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ ...mockListResult, data: [{ ...mockItems[0], status: 'baja' }] }) as never,
    );
    renderTab();
    const kebabBtns = screen.getAllByRole('button', { name: 'Acciones' });
    await userEvent.click(kebabBtns[0]);
    expect(screen.queryByRole('menuitem', { name: /^reactivar$/i })).toBeNull();
  });
});
