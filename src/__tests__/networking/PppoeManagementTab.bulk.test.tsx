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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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
// W1 — Tope de 200 comunicado y prevenido
// ─────────────────────────────────────────────────────────────────────────────
describe('PppoeManagementTab bulk — W1: tope de 200 seleccionados', () => {
  function makeItems(n: number): PppoeServiceListItem[] {
    return Array.from({ length: n }, (_, i) => ({
      ...itemWithMac,
      id: `pppoe-cap-${i}`,
      username: `cliente-cap-${i}`,
    }));
  }

  it('con 201 seleccionados: "Cambiar plan" queda aria-disabled y se muestra el tope', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: makeItems(201), total: 201, page: 1, limit: 25 }) as never,
    );
    renderTab();

    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);

    expect(screen.getByText(/201 seleccionados.*máximo 200/i)).toBeInTheDocument();

    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).toHaveAttribute('aria-disabled', 'true');
    expect(bulkBtn.getAttribute('title')).toMatch(/200/);

    // el click no debe abrir el modal
    await userEvent.click(bulkBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
    // 201 filas renderizadas + toggle de selección de página es costoso en jsdom
  }, 20000);

  it('con 200 seleccionados: "Cambiar plan" queda habilitado y no se muestra advertencia', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: makeItems(200), total: 200, page: 1, limit: 25 }) as never,
    );
    renderTab();

    const headerCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i });
    await userEvent.click(headerCheckbox);

    expect(screen.getByText(/200 seleccionados/i)).toBeInTheDocument();
    expect(screen.queryByText(/máximo 200/i)).toBeNull();

    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(bulkBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
