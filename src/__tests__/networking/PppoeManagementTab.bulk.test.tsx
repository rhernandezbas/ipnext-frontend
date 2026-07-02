/**
 * Tests — Task 5.8: nuevas features del PppoeManagementTab
 * - 5.1 Placeholder del search
 * - 5.2b Columna MAC (callerId con valor, callerId=null)
 * - 5.4 Selección múltiple (checkbox por fila, seleccionar página, gate canManage)
 * - 5.5 Toolbar contextual (aparece/desaparece con selección)
 * - 5.6 Modal bulk (confirma → hook con body correcto)
 * - 5.7 Resumen post-bulk (ok/failed)
 * - Gate sin pppoe.manage → no hay checkboxes ni toolbar
 *
 * TDD estricto: RED → GREEN → REFACTOR
 */
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PppoeManagementTab } from '@/pages/networking/PppoeManagementTab';

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
    id: 'plan-2',
    code: 'IP-50M',
    name: 'IP 50M',
    category: 'Alta',
    downloadKbps: 50000,
    uploadKbps: 10000,
    rateLimit: '50M/10M',
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

/** Item con callerId (MAC presente) */
const itemWithMac: PppoeServiceListItem = {
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
  remoteAddress: '100.64.28.5',
  ipMode: 'pool',
  enforcedState: 'active',
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
  callerId: 'AA:BB:CC:DD:EE:FF',
};

/** Item sin callerId (MAC null) */
const itemWithoutMac: PppoeServiceListItem = {
  id: 'pppoe-2',
  username: 'cliente02',
  clientId: 'client-2',
  customerName: 'María González',
  status: 'active',
  profile: 'IP-50M',
  nasId: 'nas-1',
  nasName: 'NAS Central',
  nasType: 'radius_orchestrator',
  contractId: 'contract-2',
  remoteAddress: '100.64.28.9',
  ipMode: 'pool',
  enforcedState: 'active',
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
  callerId: null,
};

const mockListResult: PppoeServiceListResult = {
  data: [itemWithMac, itemWithoutMac],
  total: 2,
  page: 1,
  limit: 25,
};

// ── helpers ───────────────────────────────────────────────────────────────────
function makeMutationMock(mutateAsync = vi.fn().mockResolvedValue({ ok: [], failed: [] })) {
  return { mutate: vi.fn(), mutateAsync, isPending: false, isError: false, isSuccess: false, data: undefined };
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

function renderTab(qc: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PppoeManagementTab />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `filtro-${i}`);
}

/**
 * Selecciona `n` ids vía el botón "Seleccionar los N del filtro" — evita
 * renderizar `n` filas reales (la tabla sigue mostrando el fixture chico,
 * solo la SELECCIÓN tiene `n` ids). Hoisted a nivel de módulo (fix
 * pppoe-bulk-batch-timeout) para reusarlo también en los casos que antes
 * renderizaban cientos de filas reales (patrón W1, costoso en jsdom).
 */
async function selectNViaFilter(n: number, qc?: QueryClient): Promise<string[]> {
  const ids = makeIds(n);
  vi.mocked(useAllPppoe).mockReturnValue(
    makeQueryMock({ data: mockListResult.data, total: n, page: 1, limit: 25 }) as never,
  );
  const mutateAsync = vi.fn().mockResolvedValue({ ids, total: n });
  vi.mocked(useListPppoeIds).mockReturnValue({
    mutateAsync,
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
  } as never);

  renderTab(qc);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
  await userEvent.click(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i }));
  await screen.findByText(new RegExp(`${n} seleccionados`, 'i'));
  return ids;
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.1 — Placeholder del search
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.1: placeholder del search', () => {
  it('el input tiene el placeholder correcto con IP y MAC', () => {
    renderTab();
    const input = screen.getByRole('textbox', { name: /buscar pppoe/i });
    expect(input).toHaveAttribute('placeholder', 'Buscar usuario, cliente, IP, MAC…');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.2b — Columna MAC
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.2b: columna MAC', () => {
  it('hay una columna de cabecera "MAC"', () => {
    renderTab();
    expect(screen.getByRole('columnheader', { name: /^mac$/i })).toBeInTheDocument();
  });

  it('muestra el callerId cuando tiene valor', () => {
    renderTab();
    expect(screen.getByText('AA:BB:CC:DD:EE:FF')).toBeInTheDocument();
  });

  it('muestra "—" accesible cuando callerId es null', () => {
    renderTab();
    // El elemento "—" debe tener aria-label="Sin dato"
    const noDataEls = screen.getAllByLabelText(/sin dato/i);
    expect(noDataEls.length).toBeGreaterThan(0);
  });

  it('no muestra string vacío cuando callerId es null', () => {
    renderTab();
    // Cuando callerId=null, debe aparecer "—" con aria-label="Sin dato", NO una celda vacía
    const noDataEls = screen.getAllByLabelText(/sin dato/i);
    expect(noDataEls.length).toBeGreaterThan(0);
    // El texto "—" (emdash) debe aparecer en la columna MAC (no string vacío)
    noDataEls.forEach(el => {
      expect(el.textContent?.trim()).toBe('—');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.4 — Selección múltiple (checkboxes)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.4: selección múltiple', () => {
  it('muestra checkboxes por fila cuando tiene pppoe.manage', () => {
    renderTab();
    const checkboxes = screen.getAllByRole('checkbox');
    // Al menos: 1 header + N filas
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('NO muestra checkboxes cuando no tiene pppoe.manage', () => {
    setup(false);
    renderTab();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('seleccionar un checkbox de fila lo marca', async () => {
    renderTab();
    const rowCheckboxes = screen.getAllByRole('checkbox').filter(
      cb => cb !== screen.getAllByRole('checkbox')[0],
    );
    await userEvent.click(rowCheckboxes[0]);
    expect(rowCheckboxes[0]).toBeChecked();
  });

  it('seleccionar la página marca todos los checkboxes de la página', async () => {
    renderTab();
    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);
    // Todos los checkboxes de fila deben estar marcados
    const rowCheckboxes = screen.getAllByRole('checkbox').filter(cb => cb !== headerCheckbox);
    rowCheckboxes.forEach(cb => expect(cb).toBeChecked());
  });

  it('deseleccionar "seleccionar página" desmarca todos', async () => {
    renderTab();
    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    // Marcar todo
    await userEvent.click(headerCheckbox);
    // Desmarcar todo
    await userEvent.click(headerCheckbox);
    const rowCheckboxes = screen.getAllByRole('checkbox').filter(cb => cb !== headerCheckbox);
    rowCheckboxes.forEach(cb => expect(cb).not.toBeChecked());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.5 — Toolbar contextual
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.5: toolbar contextual', () => {
  it('NO muestra toolbar de selección cuando no hay nada seleccionado', () => {
    renderTab();
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });

  it('muestra toolbar con "N seleccionados" cuando hay selección', async () => {
    renderTab();
    const allCheckboxes = screen.getAllByRole('checkbox');
    const rowCheckboxes = allCheckboxes.slice(1);
    await userEvent.click(rowCheckboxes[0]);
    expect(screen.getByText(/1 seleccionado/i)).toBeInTheDocument();
  });

  it('muestra botón "Cambiar plan" en la toolbar', async () => {
    renderTab();
    const allCheckboxes = screen.getAllByRole('checkbox');
    await userEvent.click(allCheckboxes[1]);
    expect(screen.getByRole('button', { name: /cambiar plan/i })).toBeInTheDocument();
  });

  it('muestra botón "Limpiar" en la toolbar', async () => {
    renderTab();
    const allCheckboxes = screen.getAllByRole('checkbox');
    await userEvent.click(allCheckboxes[1]);
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();
  });

  it('"Limpiar" deselecciona todo', async () => {
    renderTab();
    const allCheckboxes = screen.getAllByRole('checkbox');
    await userEvent.click(allCheckboxes[1]);
    // Toolbar visible
    expect(screen.getByText(/1 seleccionado/i)).toBeInTheDocument();
    // Limpiar
    await userEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    // Toolbar desaparece
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });

  it('NO muestra toolbar cuando no tiene pppoe.manage', () => {
    setup(false);
    renderTab();
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W1 → v2 → fix pppoe-bulk-batch-timeout: el bloqueo original de 200 fue
// REEMPLAZADO por el envío en lotes (pppoe-bulk-select-filter design.md
// Decisión 6), y AHORA el tamaño de lote baja de 200 a 25 (BULK_BATCH_SIZE,
// fix pppoe-bulk-batch-timeout — un lote de 200 con throttle serial tarda
// 2-4min y el proxy corta la conexión). Estos tests REESCRIBEN HONESTAMENTE
// los números de lote (antes "2 lotes de 200", ahora "lotes de 25") — el
// umbral del checkbox de confirmación (>200 seleccionados) NO cambia.
// Migrados a `selectNViaFilter` (no rendering de N filas reales) — el viejo
// patrón de renderizar 200/201 filas era solo necesario antes de que ese
// helper existiera.
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — W1 REEMPLAZADO: 201 ya NO bloquea, se envía en lotes de 25', () => {
  it('ANTES bloqueaba con 201 seleccionados; AHORA "Cambiar plan" queda HABILITADO + aviso de 9 lotes de 25 + checkbox de confirmación', async () => {
    await selectNViaFilter(201);

    // Cambio de spec: YA NO dice "máximo 200" — informa cuántos lotes de 25 se van a mandar.
    expect(screen.getByText(/201 seleccionados.*se enviará en 9 lotes de 25/i)).toBeInTheDocument();
    expect(screen.queryByText(/máximo 200/i)).toBeNull();
    expect(screen.queryByText(/lotes de 200/i)).toBeNull();

    // El botón NO está aria-disabled — 201 es ejecutable (sin cambios respecto a W1→v2).
    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(bulkBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // El checkbox de confirmación obligatorio de N>200 sigue gateado por
    // BULK_SELECTION_CAP (200) — NO por el tamaño de lote.
    expect(within(dialog).getByRole('checkbox', { name: /entiendo que voy a cambiar el plan de 201 servicios/i })).toBeInTheDocument();
  });

  it('con 200 seleccionados (borde inferior del checkbox): "Cambiar plan" habilitado, aviso de 8 lotes de 25 pero SIN checkbox (fix: el aviso de lotes ya no depende del cap de 200)', async () => {
    await selectNViaFilter(200);

    // Cambio de spec de ESTE fix: 200 SUPERA BULK_BATCH_SIZE(25), así que el
    // aviso de lotes SÍ aparece ahora (antes, atado a >200, no aparecía para
    // exactamente 200). El checkbox de confirmación, en cambio, sigue sin
    // aparecer (200 no es > BULK_SELECTION_CAP=200 — sin cambios ahí).
    expect(screen.getByText(/200 seleccionados.*se enviará en 8 lotes de 25/i)).toBeInTheDocument();
    expect(screen.queryByText(/máximo 200/i)).toBeNull();

    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(bulkBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // N<=200: sin checkbox extra (flujo del cap de confirmación intacto)
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.6 — Modal bulk
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.6: modal bulk cambio de plan', () => {
  async function openBulkModal() {
    renderTab();
    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
  }

  it('abre el modal bulk al hacer click en "Cambiar plan"', async () => {
    await openBulkModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('el modal contiene el dropdown de planes (sin Corte)', async () => {
    await openBulkModal();
    const dialog = screen.getByRole('dialog');
    // IP 5M y IP 50M deben aparecer, CORTE no
    expect(within(dialog).getByRole('option', { name: /IP 5M/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /IP 50M/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /plan corte/i })).toBeNull();
  });

  it('submit llama a bulkChangePlan.mutateAsync con el body correcto (ids + profile)', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: ['pppoe-1', 'pppoe-2'], failed: [] });
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(mutateAsync),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');

    // Seleccionar el plan IP-50M
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    // Click en confirmar
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ids: expect.arrayContaining(['pppoe-1', 'pppoe-2']),
          profile: 'IP-50M',
        }),
      );
    });
  });

  it('incluye reason en el body cuando se completa el input', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: ['pppoe-1'], failed: [] });
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(mutateAsync),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    const reasonInput = within(dialog).getByLabelText(/motivo|razón|reason/i);
    await userEvent.type(reasonInput, 'promo verano');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'promo verano',
        }),
      );
    });
  });

  it('muestra error INLINE (role=alert) con el mensaje real del BE cuando bulkChangePlan falla (422)', async () => {
    // Shape axios real: axios NUNCA rechaza con new Error('...') plano, siempre
    // con { response: { status, data } }. err.message sería genérico
    // ("Request failed with status code 422") — el fix lee response.data.error.
    const axiosError = {
      response: {
        status: 422,
        data: { code: 'PLAN_NOT_FOUND', error: 'El plan X no existe' },
      },
    };
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(axiosError)),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      const alert = within(dialog).getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('El plan X no existe');
    });
    // modal permanece abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra el mensaje del BE cuando el bulk falla con 422 BULK_TOO_LARGE', async () => {
    const axiosError = {
      response: {
        status: 422,
        data: { code: 'BULK_TOO_LARGE', error: 'Máximo 200 servicios por operación bulk' },
      },
    };
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(axiosError)),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Máximo 200 servicios por operación bulk');
    });
  });

  it('muestra el mensaje del BE cuando el bulk falla con 403', async () => {
    const axiosError = {
      response: {
        status: 403,
        data: { code: 'FORBIDDEN', error: 'No tenés permisos para cambiar el plan en bulk' },
      },
    };
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(axiosError)),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('No tenés permisos para cambiar el plan en bulk');
    });
  });

  it('cae al mensaje genérico si el error no trae shape axios (sin response)', async () => {
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(vi.fn().mockRejectedValue(new Error('network down'))),
    } as never);

    await openBulkModal();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('No se pudo cambiar el plan.');
    });
  });

  it('cierra el modal al hacer click en Cancelar', async () => {
    await openBulkModal();
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.7 — Resumen post-bulk
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 5.7: resumen post-bulk', () => {
  async function runBulk(
    result: { ok: string[]; failed: { id: string; username: string; error: string }[] },
  ) {
    const mutateAsync = vi.fn().mockResolvedValue(result);
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({
      ...makeMutationMock(mutateAsync),
    } as never);

    renderTab();
    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    return dialog;
  }

  it('muestra resumen con N exitosos cuando el bulk es exitoso', async () => {
    await runBulk({ ok: ['pppoe-1', 'pppoe-2'], failed: [] });
    await waitFor(() => {
      expect(screen.getByText(/2.*exitoso|2.*ok/i)).toBeInTheDocument();
    });
  });

  it('muestra lista de failed con username y error', async () => {
    await runBulk({
      ok: ['pppoe-1'],
      failed: [{ id: 'pppoe-2', username: 'cliente02', error: 'Router caído' }],
    });
    await waitFor(() => {
      // Usar getAllByText porque la tabla también tiene "cliente02" en otra fila
      const matches = screen.getAllByText(/cliente02/i);
      expect(matches.length).toBeGreaterThan(0);
      expect(screen.getByText(/router caído/i)).toBeInTheDocument();
    });
  });

  it('después del bulk exitoso los items OK ya no están seleccionados', async () => {
    await runBulk({ ok: ['pppoe-1', 'pppoe-2'], failed: [] });
    await waitFor(() => {
      // La toolbar de selección desaparece (no hay seleccionados)
      expect(screen.queryByText(/seleccionado/i)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.3 — Botón "Seleccionar los N del filtro" (pppoe-bulk-select-filter v2)
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — 3.3: botón "Seleccionar los N del filtro"', () => {
  const selectFilterBtnName = /seleccionar los \d+ del filtro/i;

  it('NO aparece sin ningún filtro activo', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: selectFilterBtnName })).toBeNull();
  });

  it('aparece cuando hay un filtro de NAS activo + pppoe.manage', async () => {
    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    expect(screen.getByRole('button', { name: selectFilterBtnName })).toBeInTheDocument();
  });

  it('aparece cuando hay un filtro de estado activo', async () => {
    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por estado/i }), 'active');
    expect(screen.getByRole('button', { name: selectFilterBtnName })).toBeInTheDocument();
  });

  it('NO aparece sin pppoe.manage aunque haya un filtro activo (gate FE)', async () => {
    setup(false);
    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    expect(screen.queryByRole('button', { name: selectFilterBtnName })).toBeNull();
  });

  it('clic congela la selección con los ids devueltos por el hook, llamado con los filtros vigentes', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ids: ['x-1', 'x-2', 'x-3'], total: 3 });
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: selectFilterBtnName }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ nasId: 'nas-1', includeUnassigned: true }),
      );
    });
    // La selección queda CONGELADA con los ids devueltos (no con currentPageIds).
    expect(await screen.findByText(/3 seleccionados/i)).toBeInTheDocument();
  });

  it('muestra estado de carga en el botón mientras trae los ids (isPending)', async () => {
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    const btn = screen.getByRole('button', { name: /buscando/i });
    expect(btn).toBeDisabled();
  });

  // Nit R2(b): el catch de handleSelectAllFiltered usa bulkErrorMessage(err, ...)
  // (mismo helper que ya usa el modal bulk) — muestra el mensaje REAL del BE
  // (response.data.error/code), no el genérico de axios ("Request failed with
  // status code 400"). Este test REEMPLAZA HONESTAMENTE al viejo "error inline
  // si el fetch de ids falla" (que rechazaba con un Error plano y no ejercitaba
  // el bug real — un rechazo axios real nunca es `new Error('mensaje lindo')`).
  it('R2(b): error inline con el mensaje REAL del BE (shape axios) cuando el fetch de ids falla', async () => {
    const axiosError = {
      response: {
        status: 400,
        data: { code: 'FILTER_REQUIRED', error: 'Debés especificar al menos un filtro' },
      },
    };
    const mutateAsync = vi.fn().mockRejectedValue(axiosError);
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: selectFilterBtnName }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Debés especificar al menos un filtro');
    });
  });

  it('R2(b): cae al mensaje genérico si el error no trae shape axios (sin response)', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network down'));
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: selectFilterBtnName }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo obtener los ids del filtro.');
    });
  });

  it('3.4: cambiar el filtro DESPUÉS de seleccionar por el botón LIMPIA la selección congelada (invariante anti-TOCTOU)', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ids: ['x-1', 'x-2', 'x-3'], total: 3 });
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: selectFilterBtnName }));
    expect(await screen.findByText(/3 seleccionados/i)).toBeInTheDocument();

    // Cambiar el filtro de estado (distinto del que se usó para seleccionar) limpia.
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por estado/i }), 'active');
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F1 — race anti-TOCTOU: cambiar el filtro MIENTRAS el fetch de
// "Seleccionar los N del filtro" está EN VUELO no debe repoblar la selección
// con ids del filtro VIEJO cuando el fetch resuelve tarde. El onChange limpia
// `selected` de inmediato (síncrono); el fetch en vuelo debe descartar su
// resultado en silencio si el filtro ya cambió.
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — F1: race anti-TOCTOU en "Seleccionar los N del filtro"', () => {
  function withSecondNas() {
    vi.mocked(useNasServers).mockReturnValue(
      makeQueryMock([...mockNasServers, { ...mockNasServers[0], id: 'nas-2', name: 'NAS Norte' }]) as never,
    );
  }

  it('cambiar el NAS MIENTRAS el fetch está en vuelo: al resolver, la selección queda VACÍA (no se repobla con ids del filtro viejo)', async () => {
    withSecondNas();
    let resolveIds!: (v: { ids: string[]; total: number }) => void;
    const mutateAsync = vi.fn().mockImplementation(
      () => new Promise<{ ids: string[]; total: number }>((resolve) => { resolveIds = resolve; }),
    );
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // El fetch del filtro nas-1 quedó EN VUELO (todavía no resuelve). Cambiar
    // el NAS ANTES de que resuelva — el onChange limpia `selected` YA.
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-2');
    expect(screen.queryByText(/seleccionado/i)).toBeNull();

    // Resuelve el fetch VIEJO (con ids del filtro nas-1, ya no vigente).
    resolveIds({ ids: ['old-1', 'old-2', 'old-3'], total: 3 });
    // Dejar correr los microtasks pendientes del await interrumpido (setTimeout(0)
    // macrotask asegura que se drenen antes de seguir, a diferencia de un solo tick).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Anti-TOCTOU: NO se repuebla la selección con los ids del filtro viejo.
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1); // no se disparó un segundo fetch
  });

  it('caso search: escribir en el buscador limpia la selección de inmediato (pre-debounce); el fetch en vuelo no la repuebla', async () => {
    let resolveIds!: (v: { ids: string[]; total: number }) => void;
    const mutateAsync = vi.fn().mockImplementation(
      () => new Promise<{ ids: string[]; total: number }>((resolve) => { resolveIds = resolve; }),
    );
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);

    renderTab();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // Escribir en el buscador: el onChange limpia `selected` YA, ANTES de que
    // el debounce (300ms) siquiera dispare un fetch nuevo.
    await userEvent.type(screen.getByRole('textbox', { name: /buscar pppoe/i }), 'x');
    expect(screen.queryByText(/seleccionado/i)).toBeNull();

    resolveIds({ ids: ['old-1', 'old-2', 'old-3'], total: 3 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Nit R2(a) — hasActiveFilter debe usar search.trim(): espacios-solos NO son
// un filtro activo (el BE trimea y un search=' ' aislado sería 400
// FILTER_REQUIRED — el botón nunca debería aparecer para ese caso).
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — Nit R2(a): hasActiveFilter usa search.trim()', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('search compuesto solo por espacios (sin otros filtros) NO muestra "Seleccionar los N del filtro"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();

    const searchInput = screen.getByRole('textbox', { name: /buscar pppoe/i });
    act(() => {
      fireEvent.change(searchInput, { target: { value: '   ' } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeNull();
    });
  });

  it('search con contenido real (más allá del trim) SÍ muestra el botón', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTab();

    const searchInput = screen.getByRole('textbox', { name: /buscar pppoe/i });
    act(() => {
      fireEvent.change(searchInput, { target: { value: '  juan  ' } });
    });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4/5 — Envío en lotes (>200), agregación, corte por lote entero, checkbox
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Fix pppoe-bulk-batch-timeout: el tamaño de lote baja de 200 a 25
// (BULK_BATCH_SIZE) — un lote de 200 con throttle serial de 300ms tarda 2-4min
// y el proxy corta la conexión antes de que la respuesta vuelva. Además, el
// mensaje de corte deja de asumir "rechazo de transporte = 0 aplicado": el
// lote rechazado queda `unconfirmed` (estado desconocido), no "0 aplicados".
// El checkbox de confirmación de >200 seleccionados NO cambia (sigue atado a
// BULK_SELECTION_CAP=200, independiente del tamaño de lote).
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — envío en lotes de 25 (fix pppoe-bulk-batch-timeout): agregación, corte honesto, checkbox', () => {
  it('340 seleccionados: toolbar informa "se enviará en 14 lotes de 25" y el botón no está aria-disabled', async () => {
    await selectNViaFilter(340);
    expect(screen.getByText(/340 seleccionados.*se enviará en 14 lotes de 25/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('checkbox obligatorio "Entiendo que voy a cambiar el plan de 340 servicios" gatea el confirm (sin cambios: sigue atado a BULK_SELECTION_CAP=200, no al tamaño de lote)', async () => {
    await selectNViaFilter(340);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar|cambiar/i });
    expect(confirmBtn).toBeDisabled();

    const checkbox = within(dialog).getByRole('checkbox', {
      name: /entiendo que voy a cambiar el plan de 340 servicios/i,
    });
    await userEvent.click(checkbox);
    expect(confirmBtn).not.toBeDisabled();
  });

  it('N<=200 (150): NO aparece el checkbox extra; confirm sigue dependiendo solo del plan elegido (va por lotes de 25 igual, sin checkbox)', async () => {
    await selectNViaFilter(150);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar|cambiar/i });
    expect(confirmBtn).not.toBeDisabled(); // ya hay un plan por default (planOptions[0])
  });

  it('40 seleccionados → 2 requests secuenciales (25 y 15, EN ORDEN) y agrega ok/failed cross-lote', async () => {
    const ids = await selectNViaFilter(40);
    const batch1Ok = ids.slice(0, 20);
    const batch1Failed = ids.slice(20, 25).map((id) => ({ id, username: id, error: 'Router caído' }));
    const batch2Ok = ids.slice(25, 38);
    const batch2Failed = ids.slice(38, 40).map((id) => ({ id, username: id, error: 'PPPOE_NOT_FOUND' }));

    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockResolvedValueOnce({ ok: batch2Ok, failed: batch2Failed });
    // W4: el camino de lotes llama a batchMutation (SIN invalidación por lote),
    // NO a bulkMutation — ver useBulkChangePppoePlanBatch.
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    // 40 <= BULK_SELECTION_CAP(200): sin checkbox extra que tildar.
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    // Orden verificado: el primer request lleva 25 ids (BULK_BATCH_SIZE), el segundo 15.
    expect(mutateAsync.mock.calls[0][0].ids).toHaveLength(25);
    expect(mutateAsync.mock.calls[0][0].ids).toEqual(ids.slice(0, 25));
    expect(mutateAsync.mock.calls[1][0].ids).toHaveLength(15);
    expect(mutateAsync.mock.calls[1][0].ids).toEqual(ids.slice(25));

    // Resumen agregado: 20+13=33 ok, 5+2=7 failed.
    await waitFor(() => {
      expect(within(dialog).getByText(/33.*exitoso/i)).toBeInTheDocument();
    });
  }, 15000);

  it('progreso por lote visible (role=status) durante el envío', async () => {
    const ids = await selectNViaFilter(40);
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/lote 1\/2.*40 servicios/i)).toBeInTheDocument();
    });

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(within(dialog).getByText(/40.*exitoso/i)).toBeInTheDocument();
    });
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // BUG REAL DE PROD reproducido: el lote 1/2 RECHAZA por transporte (proxy
  // timeout) pero el BE lo había aplicado ENTERO (verificado en el RADIUS).
  // El mensaje YA NO puede decir "se aplicaron 0" — el estado del lote
  // rechazado es DESCONOCIDO (`unconfirmed`), no "0 aplicados".
  // ─────────────────────────────────────────────────────────────────────────
  it('BUG REAL reproducido: el lote 1/2 rechaza por transporte → el mensaje NO dice "se aplicaron 0", dice que puede haberse aplicado igual', async () => {
    await selectNViaFilter(50); // 2 lotes de 25
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1)); // el lote 2 NUNCA se manda

    await waitFor(() => {
      const alert = within(dialog).getByRole('alert');
      // Semántica HONESTA (el fix): ya NO afirma que se aplicaron 0 servicios.
      expect(alert).not.toHaveTextContent(/se aplicaron 0/i);
      expect(alert).not.toHaveTextContent(/0 aplicados/i);
      expect(alert).toHaveTextContent(/lote 1\/2/i);
      expect(alert).toHaveTextContent(/no obtuvo respuesta/i);
      expect(alert).toHaveTextContent(/pueden haberse aplicado/i);
      expect(alert).toHaveTextContent(/confirmados/i);
      expect(alert).toHaveTextContent(/reintent/i);
    });

    // Los 50 ids siguen seleccionados: nada se confirmó como `ok`.
    expect(await screen.findByText(/50 seleccionados/i)).toBeInTheDocument();
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // Corte a mitad de la corrida (100 ids, 4 lotes de 25) — mismo escenario que
  // el "ADDED Requirement: Selección post-corte" del spec. Pin del invariante
  // de selección (ex-S5): los `ok` confirmados salen de la selección; los
  // `failed` + `unconfirmed` (lote rechazado) + los no-enviados quedan.
  // ─────────────────────────────────────────────────────────────────────────
  it('corte a mitad de la corrida: el 2º de 4 lotes RECHAZA → agrega el parcial confirmado del lote 1, corta, y la selección retiene failed+unconfirmed+no-enviados', async () => {
    const ids = await selectNViaFilter(100); // 4 lotes: 25+25+25+25
    const batch1Ok = ids.slice(0, 20);
    const batch1Failed = ids.slice(20, 25).map((id) => ({ id, username: id, error: 'Router caído' }));
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockRejectedValueOnce({ response: { status: 500, data: {} } }); // corta antes del 3er lote
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2)); // los lotes 3 y 4 NUNCA se mandan

    await waitFor(() => {
      expect(within(dialog).getByText(/20.*exitoso/i)).toBeInTheDocument(); // parcial confirmado del lote 1
      // Dos alerts conviven: el mensaje de corte y la lista de `failed` del
      // lote 1 (best-effort, preexistente) — se busca puntualmente el de corte.
      const alerts = within(dialog).getAllByRole('alert');
      const cutAlert = alerts.find((el) => /no obtuvo respuesta/i.test(el.textContent ?? ''));
      expect(cutAlert).toBeTruthy();
      expect(cutAlert).toHaveTextContent(/lote 2\/4/i);
      expect(cutAlert).toHaveTextContent(/confirmados/i);
      expect(cutAlert).not.toHaveTextContent(/se aplicaron/i);
    });

    // 100 - 20 (ok confirmados del lote 1) = 80 quedan seleccionados: los 5
    // failed del lote 1 + los 25 unconfirmed del lote 2 + los 50 nunca
    // enviados (lotes 3 y 4).
    expect(await screen.findByText(/80 seleccionados/i)).toBeInTheDocument();
  }, 15000);

  it('los ítems `failed` (best-effort, ambos lotes resuelven) NO cortan: el lote 2 SÍ se envía', async () => {
    const ids = await selectNViaFilter(40);
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({
        ok: ids.slice(0, 18),
        failed: ids.slice(18, 25).map((id) => ({ id, username: id, error: 'Router caído' })),
      })
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      // Sin corte: no hay mensaje de "no obtuvo respuesta" — solo la lista de
      // `failed` (best-effort, preexistente).
      expect(screen.queryByText(/no obtuvo respuesta/i)).toBeNull();
      expect(within(dialog).getByText(/33.*exitoso/i)).toBeInTheDocument(); // 18+15
    });
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // W4 — el camino de lotes NO invalida por request; invalida GLOBAL_LIST_KEY
  // una única vez al terminar la corrida (completa o cortada).
  // ─────────────────────────────────────────────────────────────────────────
  it('W4: batchMutation NO invalida por lote — GLOBAL_LIST_KEY se invalida UNA sola vez al completar la corrida', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const ids = await selectNViaFilter(40, qc);
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: ids.slice(0, 25), failed: [] })
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));

    // El resumen final es visible (la corrida terminó).
    await waitFor(() => {
      expect(within(dialog).getByText(/40.*exitoso/i)).toBeInTheDocument();
    });

    // Invalidación de GLOBAL_LIST_KEY: exactamente UNA vez (no una por lote).
    const globalListInvalidations = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['pppoe', 'list']),
    );
    expect(globalListInvalidations).toHaveLength(1);
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // Ola 2 (pedido del usuario 2026-07-02: "esto hazlo async, y que se pueda
  // cortar todos") — REESCRITURA HONESTA de W2: el viejo comportamiento
  // ("Cancelar" disabled durante TODA la corrida en lotes, sin forma real de
  // cortar) YA NO EXISTE. Ahora, durante una corrida EN LOTES:
  //   - "Cancelar" es reemplazado por "Continuar en segundo plano" (HABILITADO)
  //   - aparece "Cortar" (real, corta antes del próximo lote)
  // El camino directo (<=BULK_BATCH_SIZE) SIGUE con "Cancelar" disabled — ver
  // el describe "camino directo" más abajo, que pinea ese invariante intacto.
  // ─────────────────────────────────────────────────────────────────────────
  it('ola 2: durante el envío en lotes "Cancelar" YA NO existe — aparece "Continuar en segundo plano" (habilitado) + "Cortar"; al terminar, el resumen es visible', async () => {
    const ids = await selectNViaFilter(40);
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    // Lote 1 en vuelo: "Cancelar" NO existe más; en su lugar, "Continuar en
    // segundo plano" (habilitado) y "Cortar" (habilitado, real).
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: /^cancelar$/i })).toBeNull();
      const bgBtn = within(dialog).getByRole('button', { name: /continuar en segundo plano/i });
      expect(bgBtn).not.toBeDisabled();
      const cutBtn = within(dialog).getByRole('button', { name: /^cortar$/i });
      expect(cutBtn).not.toBeDisabled();
    });

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });

    // Corrida terminada: el resumen se ve y el botón de cierre ("Cerrar") está habilitado.
    await waitFor(() => {
      expect(within(dialog).getByText(/40.*exitoso/i)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', { name: /cerrar/i })).not.toBeDisabled();
  }, 15000);

  it('ola 2: camino directo (<=BULK_BATCH_SIZE, sin orquestador): "Cancelar" SIGUE disabled durante el envío — SIN "Cortar" ni "Continuar en segundo plano" (intacto)', async () => {
    let resolveMutate!: (v: unknown) => void;
    const mutateAsync = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveMutate = resolve; }),
    );
    vi.mocked(useBulkChangePppoePlan).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    renderTab();
    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      // Con `isPending` el botón lleva aria-label propio ("Cancelar — no se
      // puede cerrar durante el envío"), que ARIA prioriza sobre el texto
      // visible — por eso el matcher NO ancla el nombre exacto.
      const cancelBtn = within(dialog).getByRole('button', { name: /cancelar/i });
      expect(cancelBtn).toBeDisabled();
      expect(cancelBtn).toHaveAttribute('title', expect.stringMatching(/no se puede cerrar/i));
    });
    expect(within(dialog).queryByRole('button', { name: /^cortar$/i })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /continuar en segundo plano/i })).toBeNull();

    resolveMutate({ ok: ['pppoe-1', 'pppoe-2'], failed: [] });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /cerrar/i })).not.toBeDisabled();
    });
  }, 15000);

  it('ola 2: "Cortar" clickeado ANTES del próximo lote detiene la corrida — se envía solo lo que ya estaba en vuelo, el resumen muestra "corrida cortada" y lo no-enviado sigue seleccionado', async () => {
    const ids = await selectNViaFilter(100); // 4 lotes de 25
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi.fn().mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; }),
    );
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    // Lote 1 en vuelo: clic en "Cortar" → pasa a "Cortando…" (disabled)
    const cutBtn = await within(dialog).findByRole('button', { name: /^cortar$/i });
    await userEvent.click(cutBtn);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: /cortando/i })).toBeDisabled();
    });

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });

    // El lote 2 NUNCA se manda: el chequeo de shouldCancel corta antes de mandarlo.
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(within(dialog).getByText(/corrida cortada en el lote 2 de 4/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/25.*exitoso/i)).toBeInTheDocument();
    });

    // 100 - 25 confirmados ok del lote 1 = 75 quedan seleccionados (nunca se
    // enviaron los lotes 2/3/4).
    expect(await screen.findByText(/75 seleccionados/i)).toBeInTheDocument();
  }, 15000);

  it('ola 2: "Continuar en segundo plano" cierra el modal SIN abortar la corrida — el chip muestra el progreso en vivo', async () => {
    const ids = await selectNViaFilter(60); // 3 lotes: 25/25/10
    let resolveFirst!: (v: unknown) => void;
    let resolveSecond!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(50), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await within(dialog).findByRole('button', { name: /continuar en segundo plano/i });
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    // El modal se cierra — la corrida SIGUE (no hay dialog, pero el mock 2/3 aún no resolvió).
    expect(screen.queryByRole('dialog')).toBeNull();

    // Chip visible con el progreso del lote 1 (accesible: role="status" en el
    // contenedor es la ÚNICA live region — fix re-review F3: el span hijo ya
    // NO lleva aria-live explícito, evita el anuncio duplicado).
    const progressText = screen.getByText(/cambiando plan: lote 1\/3/i);
    expect(progressText).toBeInTheDocument();
    expect(progressText).not.toHaveAttribute('aria-live');
    expect(progressText.closest('[role="status"]')).not.toBeNull();

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(screen.getByText(/cambiando plan: lote 2\/3/i)).toBeInTheDocument();
    });

    resolveSecond({ ok: ids.slice(25, 50), failed: [] });

    // Corrida terminada en background: el chip desaparece, aparece el banner de resumen.
    await waitFor(() => {
      expect(screen.queryByText(/cambiando plan:/i)).toBeNull();
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    });
  }, 15000);

  it('ola 2: "Cortar" desde el chip (modal cerrado, segundo plano) corta la corrida igual que desde el modal', async () => {
    const ids = await selectNViaFilter(60); // 3 lotes: 25/25/10
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi.fn().mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; }),
    );
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Cortar DESDE EL CHIP (no desde el modal, que está cerrado).
    await userEvent.click(screen.getByRole('button', { name: /^cortar$/i }));
    expect(screen.getByRole('button', { name: /cortando/i })).toBeDisabled();

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1)); // el lote 2 nunca se manda

    // Terminó en background (cortada) — el banner muestra el resumen.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });

    // "Ver detalle" reabre el modal con el resultado de la cancelación.
    await userEvent.click(screen.getByRole('button', { name: /ver detalle/i }));
    expect(await screen.findByText(/corrida cortada en el lote 2 de 3/i)).toBeInTheDocument();
  }, 15000);

  it('ola 2: "Ver detalle" del banner reabre el modal mostrando el resultado final (corrida completa en background)', async () => {
    const ids = await selectNViaFilter(40); // 2 lotes de 25/15
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /ver detalle/i }));

    const reopened = screen.getByRole('dialog');
    expect(within(reopened).getByText(/40.*exitoso/i)).toBeInTheDocument();
  }, 15000);

  it('ola 2: "Descartar" del banner limpia el resumen (no vuelve a aparecer el banner ni el chip)', async () => {
    const ids = await selectNViaFilter(40);
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(screen.queryByRole('button', { name: /ver detalle/i })).toBeNull();
    expect(screen.queryByText(/cambiando plan:/i)).toBeNull();
  }, 15000);

  it('ola 2: cut + cancelled combinados — el mensaje prioriza el `cut` (más grave) y suma la nota de corte manual', async () => {
    const ids = await selectNViaFilter(75); // 3 lotes de 25
    let rejectSecond!: (err: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: ids.slice(0, 25), failed: [] })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSecond = reject; }));
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    // Esperar a que el lote 2 esté REALMENTE en vuelo (el 2º call ya se disparó).
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));

    // Cortar MIENTRAS el lote 2 está en vuelo.
    await userEvent.click(within(dialog).getByRole('button', { name: /^cortar$/i }));

    // El lote 2, que ya estaba en vuelo, rechaza por transporte de todos modos.
    rejectSecond({ code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' });

    await waitFor(() => {
      const alert = within(dialog).getByRole('alert');
      // El mensaje de `cut` (más grave, estado desconocido) sigue siendo el primario.
      expect(alert).toHaveTextContent(/no obtuvo respuesta/i);
      expect(alert).toHaveTextContent(/lote 2\/3/i);
      // Y suma la nota de que además el operador cortó manualmente.
      expect(alert).toHaveTextContent(/cortaste la corrida manualmente/i);
    });

    // NO debe aparecer el mensaje de cancelación PURA (ese es para cuando no hay `cut`).
    expect(within(dialog).queryByText(/^corrida cortada en el lote/i)).toBeNull();
  }, 15000);

  it('ola 2: mientras hay una corrida en curso (incluso en segundo plano), "Cambiar plan" queda deshabilitado con title explicativo', async () => {
    // Nota: se deja el lote 2 con 5 `failed` a propósito — si TODO terminara
    // `ok`, la selección quedaría vacía y la toolbar entera (con el botón
    // "Cambiar plan") desaparecería, y no habría nada que reactivar.
    const ids = await selectNViaFilter(60); // 3 lotes: 25/25/10
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({
        ok: ids.slice(25, 45),
        failed: ids.slice(45, 50).map((id) => ({ id, username: id, error: 'Router caído' })),
      })
      .mockResolvedValueOnce({ ok: ids.slice(50), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    // Con el modal cerrado y la corrida en curso, el botón de la toolbar está disabled.
    const toolbarBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(toolbarBtn).toBeDisabled();
    expect(toolbarBtn).toHaveAttribute('title', expect.stringMatching(/en curso/i));

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });

    // Terminada la corrida (con 5 `failed` que quedan seleccionados), el
    // botón sigue existiendo y vuelve a estar habilitado.
    expect(screen.getByRole('button', { name: /cambiar plan/i })).not.toBeDisabled();
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // Accesibilidad (ola 2): el chip y el banner usan role=status como ÚNICA
  // live region (fix re-review F3: el span de progreso YA NO lleva un
  // aria-live="polite" explícito además del role=status del contenedor —
  // eso duplicaba el anuncio para lectores de pantalla); los botones nuevos
  // tienen labels de texto claro (sin iconos mudos).
  // ─────────────────────────────────────────────────────────────────────────
  it('ola 2: accesibilidad — chip/banner con role=status como ÚNICA live region (sin aria-live duplicado en el hijo), botones con labels de texto claro', async () => {
    const ids = await selectNViaFilter(40); // 2 lotes: 25/15
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    // Chip: contenedor role=status + texto de progreso SIN aria-live propio
    // (una sola live region — el role=status del contenedor ya alcanza).
    const chipStatuses = screen.getAllByRole('status');
    const progressText = screen.getByText(/cambiando plan: lote 1\/2/i);
    expect(chipStatuses.some((el) => el.contains(progressText))).toBe(true);
    expect(progressText).not.toHaveAttribute('aria-live');

    // Botón "Cortar" tiene label de texto claro (no ícono mudo).
    expect(screen.getByRole('button', { name: /^cortar$/i })).toHaveTextContent('Cortar');

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });

    await waitFor(() => {
      // Banner de resumen: también role=status.
      const banner = screen.getByRole('button', { name: /ver detalle/i }).closest('[role="status"]');
      expect(banner).not.toBeNull();
    });
    expect(screen.getByRole('button', { name: /ver detalle/i })).toHaveTextContent('Ver detalle');
    expect(screen.getByRole('button', { name: /descartar/i })).toHaveTextContent('Descartar');
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // Fix re-review F1: congelar la selección mientras `isBulkRunning` es true.
  // Antes, tocar la selección (Limpiar / descheckear filas) durante una
  // corrida en segundo plano (modal cerrado) hacía desaparecer el chip de
  // progreso + "Cortar" (gateados por `requiresBatching`, reactivo a
  // `selected.size`) Y corrompía el conteo del banner post-corrida (que resta
  // contra `selected.size`). Fix DOBLE: (a) el chip ya no depende de
  // `requiresBatching`, solo de `batchProgress`; (b) los controles de
  // selección quedan `disabled` mientras corre un lote.
  // ─────────────────────────────────────────────────────────────────────────
  it('F1: corrida en background + click en "Limpiar" — el botón queda disabled, la selección NO cambia, el chip sigue visible con "Cortar"', async () => {
    const ids = await selectNViaFilter(60); // 3 lotes: 25/25/10
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25, 50), failed: [] })
      .mockResolvedValueOnce({ ok: ids.slice(50), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    // Corrida en background: chip visible con "Cortar".
    await screen.findByText(/cambiando plan: lote 1\/3/i);

    const limpiarBtn = screen.getByRole('button', { name: /limpiar/i });
    expect(limpiarBtn).toBeDisabled();
    expect(limpiarBtn).toHaveAttribute('title', expect.stringMatching(/cambio de plan en curso/i));

    // Un click sobre un botón nativamente disabled no dispara el handler —
    // la selección NO debería cambiar.
    await userEvent.click(limpiarBtn);

    expect(screen.getByText(/60 seleccionados/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cortar$/i })).toBeInTheDocument();
    expect(screen.getByText(/cambiando plan: lote 1\/3/i)).toBeInTheDocument();

    // Dejar la corrida terminar limpio.
    resolveFirst({ ok: ids.slice(0, 25), failed: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });
  }, 15000);

  it('F1: checkbox de fila, checkbox de header y "Seleccionar los N del filtro" quedan disabled durante la corrida en background', async () => {
    const ids = await selectNViaFilter(40); // 2 lotes: 25/15
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    await screen.findByText(/cambiando plan: lote 1\/2/i);

    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    expect(headerCheckbox).toBeDisabled();
    const rowCheckboxes = screen.getAllByRole('checkbox').filter((cb) => cb !== headerCheckbox);
    expect(rowCheckboxes.length).toBeGreaterThan(0);
    rowCheckboxes.forEach((cb) => expect(cb).toBeDisabled());

    const selectFilteredBtn = screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i });
    expect(selectFilteredBtn).toBeDisabled();
    expect(selectFilteredBtn).toHaveAttribute('title', expect.stringMatching(/cambio de plan en curso/i));

    resolveFirst({ ok: ids.slice(0, 25), failed: [] });

    // Terminada la corrida, los controles se reactivan.
    await waitFor(() => {
      expect(headerCheckbox).not.toBeDisabled();
    });
    rowCheckboxes.forEach((cb) => expect(cb).not.toBeDisabled());
    expect(selectFilteredBtn).not.toBeDisabled();
  }, 15000);

  it('F1: el conteo del banner post-corrida es correcto y estable aunque se intente tocar la selección durante la corrida (bloqueado por disabled)', async () => {
    const ids = await selectNViaFilter(40); // 2 lotes: 25/15
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    await screen.findByText(/cambiando plan: lote 1\/2/i);

    // Intento de interferencia — bloqueado por disabled, no debería alterar nada.
    await userEvent.click(screen.getByRole('button', { name: /limpiar/i }));

    // Lote 1 (25 ids): 20 ok + 5 failed. Lote 2 (15 ids): todos ok.
    resolveFirst({
      ok: ids.slice(0, 20),
      failed: ids.slice(20, 25).map((id) => ({ id, username: id, error: 'Router caído' })),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });

    const banner = screen.getByRole('button', { name: /ver detalle/i }).closest('[role="status"]') as HTMLElement;
    // ok total = 20 (lote 1) + 15 (lote 2) = 35; failed = 5. La selección
    // congelada garantiza que estos números no se corrompieron por la
    // interferencia intentada arriba.
    expect(banner.textContent).toMatch(/35 confirmados? ok/i);
    expect(banner.textContent).toMatch(/5 fallidos?/i);
    // failed.length(5) === selected.size restante(5) tras sacar los 35 ok →
    // no debe quedar nada "sin confirmación/no enviados".
    expect(banner.textContent).not.toMatch(/sin confirmaci[oó]n/i);
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // Fix re-review F1(b) COMPLETO: los handlers de filtro (search/NAS/estado)
  // hacían `setSelected(new Set())` SIN gatear por `isBulkRunning` — los
  // inputs de filtro quedan HABILITADOS a propósito durante la corrida (el
  // objetivo del async es que el operador siga navegando), así que un cambio
  // de filtro en background vaciaba la selección (= el set de reintento de
  // la corrida) y corrompía el conteo del banner post-corrida. Ahora la
  // limpieza es condicional (`if (!isBulkRunning)`); el bump de
  // filterGenerationRef sigue incondicional (inofensivo — "Seleccionar los
  // N del filtro" está disabled durante la corrida, no hay fetch stale).
  // ─────────────────────────────────────────────────────────────────────────
  it('F1(b): corrida en background + cambio del filtro NAS (habilitado) — la selección NO cambia y el conteo del banner post-corrida es correcto', async () => {
    const ids = await selectNViaFilter(40); // 2 lotes: 25/15
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: ids.slice(25), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /continuar en segundo plano/i }));

    await screen.findByText(/cambiando plan: lote 1\/2/i);

    // El filtro NAS sigue HABILITADO (el operador puede navegar/refiltrar la
    // tabla durante la corrida) — cambiarlo NO debe tocar la selección.
    const nasSelect = screen.getByRole('combobox', { name: /filtrar por nas/i });
    expect(nasSelect).not.toBeDisabled();
    await userEvent.selectOptions(nasSelect, ''); // "Todos los NAS"

    // La selección (set de reintento de la corrida) queda intacta.
    expect(screen.getByText(/40 seleccionados/i)).toBeInTheDocument();
    // El chip sigue vivo con "Cortar".
    expect(screen.getByText(/cambiando plan: lote 1\/2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cortar$/i })).toBeInTheDocument();

    // Lote 1 (25 ids): 20 ok + 5 failed. Lote 2 (15 ids): todos ok.
    resolveFirst({
      ok: ids.slice(0, 20),
      failed: ids.slice(20, 25).map((id) => ({ id, username: id, error: 'Router caído' })),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
    });

    const banner = screen.getByRole('button', { name: /ver detalle/i }).closest('[role="status"]') as HTMLElement;
    // 35 ok + 5 fallidos; los 5 failed quedan seleccionados (reintento) →
    // selected.size(5) - failed.length(5) = 0, sin "sin confirmación".
    expect(banner.textContent).toMatch(/35 confirmados? ok/i);
    expect(banner.textContent).toMatch(/5 fallidos?/i);
    expect(banner.textContent).not.toMatch(/sin confirmaci[oó]n/i);
    expect(screen.getByText(/5 seleccionados/i)).toBeInTheDocument();
  }, 15000);

  it('F1(b) pin: SIN corrida en curso, cambiar el filtro SÍ limpia la selección (invariante anti-TOCTOU intacto)', async () => {
    await selectNViaFilter(40);
    // Sin corrida: cambiar el filtro NAS limpia la selección congelada.
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), '');
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  }, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate sin pppoe.manage
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — gate sin pppoe.manage', () => {
  it('sin pppoe.manage no hay checkboxes', () => {
    setup(false);
    renderTab();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('sin pppoe.manage no aparece toolbar bulk', () => {
    setup(false);
    renderTab();
    expect(screen.queryByText(/cambiar plan/i)).toBeNull();
  });

  it('con pppoe.manage los checkboxes sí aparecen', () => {
    setup(true);
    renderTab();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });
});
