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
// W1 → v2: el bloqueo de 200 se REEMPLAZA por el envío en lotes (cambio de
// spec explícito, pppoe-bulk-select-filter design.md Decisión 6). Estos tests
// REESCRIBEN HONESTAMENTE los dos tests viejos ("201 → aria-disabled" y
// "200 → habilitado"): el comportamiento cambió, no se debilitó ningún assert
// — el diff muestra el cambio de expectativa (201 pasa de BLOQUEADO a
// EJECUTABLE en lotes + checkbox de confirmación).
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — W1 REEMPLAZADO: 201 ya NO bloquea, se envía en lotes', () => {
  function makeItems(n: number): PppoeServiceListItem[] {
    return Array.from({ length: n }, (_, i) => ({
      ...itemWithMac,
      id: `pppoe-cap-${i}`,
      username: `cliente-cap-${i}`,
    }));
  }

  it('ANTES bloqueaba con 201 seleccionados; AHORA "Cambiar plan" queda HABILITADO + aviso de 2 lotes + checkbox de confirmación', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: makeItems(201), total: 201, page: 1, limit: 25 }) as never,
    );
    renderTab();

    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);

    // Cambio de spec: YA NO dice "máximo 200" — informa cuántos lotes se van a mandar.
    expect(screen.getByText(/201 seleccionados.*se enviará en 2 lotes de 200/i)).toBeInTheDocument();
    expect(screen.queryByText(/máximo 200/i)).toBeNull();

    // Cambio de spec: el botón YA NO está aria-disabled — 201 es ejecutable.
    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).not.toHaveAttribute('aria-disabled', 'true');

    // El click SÍ abre el modal (antes no abría nada).
    await userEvent.click(bulkBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Nuevo requisito: checkbox de confirmación obligatorio de N>200.
    expect(within(dialog).getByRole('checkbox', { name: /entiendo que voy a cambiar el plan de 201 servicios/i })).toBeInTheDocument();
    // 201 filas renderizadas + toggle de selección de página es costoso en jsdom
  }, 20000);

  it('con 200 seleccionados (borde inferior): "Cambiar plan" habilitado, SIN aviso de lotes ni checkbox (comportamiento intacto)', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: makeItems(200), total: 200, page: 1, limit: 25 }) as never,
    );
    renderTab();

    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);

    expect(screen.getByText(/^200 seleccionados$/i)).toBeInTheDocument();
    expect(screen.queryByText(/lotes de 200/i)).toBeNull();
    expect(screen.queryByText(/máximo 200/i)).toBeNull();

    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(bulkBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // N<=200: sin checkbox extra (flujo actual intacto)
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    // 200 filas renderizadas + toggle de selección de página es costoso en jsdom
  }, 20000);
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
describe('PppoeManagementTab bulk — envío en lotes >200: agregación, corte, checkbox', () => {
  function makeIds(n: number): string[] {
    return Array.from({ length: n }, (_, i) => `filtro-${i}`);
  }

  /** Selecciona `n` ids vía el botón "Seleccionar los N del filtro" — evita
   * renderizar `n` filas reales (la tabla sigue mostrando el fixture chico,
   * solo la SELECCIÓN tiene `n` ids), a diferencia del viejo patrón W1 que
   * renderizaba cientos de filas y era costoso en jsdom. */
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

  it('340 seleccionados: toolbar informa "se enviará en 2 lotes de 200" y el botón no está aria-disabled', async () => {
    await selectNViaFilter(340);
    expect(screen.getByText(/340 seleccionados.*se enviará en 2 lotes de 200/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('checkbox obligatorio "Entiendo que voy a cambiar el plan de 340 servicios" gatea el confirm', async () => {
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

  it('N<=200 (150): NO aparece el checkbox extra; confirm sigue dependiendo solo del plan elegido', async () => {
    await selectNViaFilter(150);
    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar|cambiar/i });
    expect(confirmBtn).not.toBeDisabled(); // ya hay un plan por default (planOptions[0])
  });

  it('340 seleccionados → 2 requests secuenciales (200 y 140, EN ORDEN) y agrega ok/failed cross-lote', async () => {
    const ids = await selectNViaFilter(340);
    const batch1Ok = ids.slice(0, 190);
    const batch1Failed = ids.slice(190, 200).map((id) => ({ id, username: id, error: 'Router caído' }));
    const batch2Ok = ids.slice(200, 335);
    const batch2Failed = ids.slice(335, 340).map((id) => ({ id, username: id, error: 'PPPOE_NOT_FOUND' }));

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
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    // Orden verificado: el primer request lleva 200 ids, el segundo 140.
    expect(mutateAsync.mock.calls[0][0].ids).toHaveLength(200);
    expect(mutateAsync.mock.calls[0][0].ids).toEqual(ids.slice(0, 200));
    expect(mutateAsync.mock.calls[1][0].ids).toHaveLength(140);
    expect(mutateAsync.mock.calls[1][0].ids).toEqual(ids.slice(200));

    // Resumen agregado: 190+135=325 ok, 10+5=15 failed.
    await waitFor(() => {
      expect(within(dialog).getByText(/325.*exitoso/i)).toBeInTheDocument();
    });
  }, 15000);

  it('progreso por lote visible (role=status) durante el envío', async () => {
    const ids = await selectNViaFilter(340);
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: ids.slice(200), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => {
      const status = within(dialog).getByRole('status', { name: '' }) ?? within(dialog).getByText(/lote 1\/2/i);
      expect(status).toBeTruthy();
    });
    expect(within(dialog).getByText(/lote 1\/2.*340 servicios/i)).toBeInTheDocument();

    resolveFirst({ ok: ids.slice(0, 200), failed: [] });
    await waitFor(() => {
      expect(within(dialog).getByText(/340.*exitoso/i)).toBeInTheDocument();
    });
  }, 15000);

  it('corte por rechazo de lote entero: 500 ids (3 lotes), el 2º RECHAZA → corta, no manda el 3º, muestra parcial + error de corte', async () => {
    const ids = await selectNViaFilter(500);
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: ids.slice(0, 200), failed: [] })
      .mockRejectedValueOnce({ response: { status: 500, data: {} } });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2)); // el 3er lote NUNCA se manda

    await waitFor(() => {
      expect(within(dialog).getByText(/200.*exitoso/i)).toBeInTheDocument(); // parcial del lote 1
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/lote 2\/3/i);
    });
  }, 15000);

  it('los ítems `failed` (best-effort, batch resuelve 200) NO cortan: el lote 2 SÍ se envía', async () => {
    const ids = await selectNViaFilter(340);
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({
        ok: ids.slice(0, 150),
        failed: ids.slice(150, 200).map((id) => ({ id, username: id, error: 'Router caído' })),
      })
      .mockResolvedValueOnce({ ok: ids.slice(200), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      // Sin corte: el único role=alert visible es la lista de `failed` (best-effort,
      // preexistente), NO un mensaje de "se cortó en el lote X/Y".
      expect(screen.queryByText(/se cortó en el lote/i)).toBeNull();
      expect(within(dialog).getByText(/290.*exitoso/i)).toBeInTheDocument(); // 150+140
    });
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // W4 — el camino de lotes NO invalida por request; invalida GLOBAL_LIST_KEY
  // una única vez al terminar la corrida (completa o cortada).
  // ─────────────────────────────────────────────────────────────────────────
  it('W4: batchMutation NO invalida por lote — GLOBAL_LIST_KEY se invalida UNA sola vez al completar la corrida', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const ids = await selectNViaFilter(340, qc);
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: ids.slice(0, 200), failed: [] })
      .mockResolvedValueOnce({ ok: ids.slice(200), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));

    // El resumen final es visible (la corrida terminó).
    await waitFor(() => {
      expect(within(dialog).getByText(/340.*exitoso/i)).toBeInTheDocument();
    });

    // Invalidación de GLOBAL_LIST_KEY: exactamente UNA vez (no una por lote).
    const globalListInvalidations = invalidateSpy.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['pppoe', 'list']),
    );
    expect(globalListInvalidations).toHaveLength(1);
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // W2 — "Cancelar" queda deshabilitado mientras la corrida en lotes está en
  // curso (los lotes siguen mutando el RADIUS en background; cerrar el modal
  // perdería el resumen final). Al terminar, se habilita y el resumen se ve.
  // ─────────────────────────────────────────────────────────────────────────
  it('W2: durante el envío en lotes "Cancelar" está disabled; al terminar se habilita y el resumen es visible', async () => {
    const ids = await selectNViaFilter(340);
    let resolveFirst!: (v: unknown) => void;
    const mutateAsync = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: ids.slice(200), failed: [] });
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    // Lote 1 en vuelo: "Cancelar" disabled, con explicación visible al operador.
    await waitFor(() => {
      const cancelBtn = within(dialog).getByRole('button', { name: /cancelar/i });
      expect(cancelBtn).toBeDisabled();
      expect(cancelBtn).toHaveAttribute('title', expect.stringMatching(/no se puede cerrar/i));
    });

    resolveFirst({ ok: ids.slice(0, 200), failed: [] });

    // Corrida terminada: el resumen se ve y el botón de cierre ("Cerrar") está habilitado.
    await waitFor(() => {
      expect(within(dialog).getByText(/340.*exitoso/i)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', { name: /cerrar/i })).not.toBeDisabled();
  }, 15000);

  // ─────────────────────────────────────────────────────────────────────────
  // S5 — pin de equivalencia post-corrida: el estado final de la selección
  // tras una corrida N>200 es el MISMO invariante que garantiza el camino
  // N<=200 (applyOkToSelection): los `ok` agregados salen de la selección;
  // los `failed` Y los ids NO-ENVIADOS (post-corte) quedan seleccionados.
  // ─────────────────────────────────────────────────────────────────────────
  it('S5: tras una corrida N>200 con corte, los ok agregados salen de la selección y failed + no-enviados quedan seleccionados', async () => {
    const ids = await selectNViaFilter(500); // 3 lotes: 200 + 200 + 100
    const batch1Ok = ids.slice(0, 150);
    const batch1Failed = ids.slice(150, 200).map((id) => ({ id, username: id, error: 'Router caído' }));
    const mutateAsync = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockRejectedValueOnce({ response: { status: 500, data: {} } }); // corta antes del 3er lote
    vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue({ ...makeMutationMock(mutateAsync) } as never);

    await userEvent.click(screen.getByRole('button', { name: /cambiar plan/i }));
    const dialog = screen.getByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /plan/i }), 'IP-50M');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /entiendo/i }));
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar|cambiar/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));

    // 500 - 150 (ok del lote 1) = 350 quedan seleccionados: los 50 failed del
    // lote 1 + los 300 ids del lote 2 y 3 que nunca llegaron a enviarse.
    const expectedSelected = ids.length - batch1Ok.length;
    expect(await screen.findByText(new RegExp(`${expectedSelected} seleccionados`, 'i'))).toBeInTheDocument();
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
