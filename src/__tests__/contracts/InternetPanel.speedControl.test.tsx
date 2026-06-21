/**
 * InternetPanel — Control "Cambiar velocidad" (speed control)
 *
 * SC-1  Con planes disponibles se renderiza un <select> con las opciones filtradas
 *       (enabled && category !== 'Corte') + el perfil actual pre-seleccionado
 * SC-2  Selecting a different plan enables "Aplicar"; unchanged selection keeps it disabled
 * SC-3  Click "Aplicar" → update.mutateAsync({ id, body: { profile: code } })
 * SC-4  Si usePlans() devuelve [] → NO hay select, se muestra el perfil como texto (sin crash)
 * SC-5  Si usePlans() devuelve error / isError → NO hay select, no se rompe el panel
 * SC-6  Gate pppoe.manage: sin el permiso el control no se renderiza
 * SC-7  Error en Aplicar → muestra un banner role="alert"
 *
 * Regresiones tras el rediseño (layout reorg):
 * RG-1  "Cortar" abre el modal de motivo → confirmar llama enforce con action:'block'
 * RG-2  "Desasociar" y "Dar de baja PPPoE" siguen presentes
 * RG-3  Los tres grupos semánticos (Modificar / Control de servicio / Ciclo de vida) están en el DOM
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';
import type { PlanDto } from '@/types/plans';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({
    ServiceRemovalReasonModal: ({
      open,
      serviceName,
      title,
      confirmLabel,
      onConfirm,
      onCancel,
    }: {
      open: boolean;
      serviceName: string;
      title?: string;
      confirmLabel?: string;
      onConfirm: (reason: string) => void;
      onCancel: () => void;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-label={title ?? serviceName}>
          <textarea data-testid="reason-textarea" placeholder="Motivo" />
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector<HTMLTextAreaElement>('[data-testid="reason-textarea"]');
              onConfirm(el?.value ?? 'motivo-test');
            }}
          >
            {confirmLabel ?? 'Confirmar'}
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      );
    },
  }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const BASE_PPPOE: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente.test',
  profile: 'IP-Air-10-5',
  remoteAddress: '10.0.0.9',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-01T00:00:00Z',
};

const PLANS: PlanDto[] = [
  {
    id: 'p1',
    code: 'IP-Air-10-5',
    name: 'Air 10/5',
    category: 'Air',
    downloadKbps: 10000,
    uploadKbps: 5000,
    rateLimit: '10M/5M',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    code: 'IP-Air-30-10',
    name: 'Air 30/10',
    category: 'Air',
    downloadKbps: 30000,
    uploadKbps: 10000,
    rateLimit: '30M/10M',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p3',
    code: 'IP-Corte',
    name: 'Corte',
    category: 'Corte',
    downloadKbps: 512,
    uploadKbps: 256,
    rateLimit: '512k/256k',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'p4',
    code: 'IP-Alta-Disabled',
    name: 'Alta Disabled',
    category: 'Alta',
    downloadKbps: 5000,
    uploadKbps: 2000,
    rateLimit: '5M/2M',
    status: 'disabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'active' }];

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

interface SetupOpts {
  pppoe?: Partial<PppoeServiceDto>;
  plans?: PlanDto[];
  plansError?: boolean;
  canManage?: boolean;
  canCut?: boolean;
  updateMutateAsync?: ReturnType<typeof vi.fn>;
  enforceMutateAsync?: ReturnType<typeof vi.fn>;
}

function setup(opts: SetupOpts = {}) {
  const {
    pppoe: pppoePatch = {},
    plans = PLANS,
    plansError = false,
    canManage = true,
    canCut = true,
    updateMutateAsync = vi.fn().mockResolvedValue({}),
    enforceMutateAsync = vi.fn().mockResolvedValue({}),
  } = opts;

  const pppoe = { ...BASE_PPPOE, ...pppoePatch };

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: [pppoe],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePppoeModule.useContractPppoe>);

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePppoeModule.useUnassignedPppoe>);

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());

  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue({
    mutateAsync: updateMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useUpdatePppoe>);

  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue({
    mutateAsync: enforceMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useEnforcePppoeForContract>);
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCallerId>);

  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);

  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());

  vi.mocked(usePlansModule.usePlans).mockReturnValue({
    data: plansError ? undefined : plans,
    isLoading: false,
    isError: plansError,
    isSuccess: !plansError && plans.length >= 0,
  } as ReturnType<typeof usePlansModule.usePlans>);

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some((p) => {
        if (p === 'pppoe.cut') return canCut;
        if (p === 'pppoe.manage') return canManage;
        return true;
      });
    }),
    isLoading: false,
    isError: false,
    permissions: [
      ...(canManage ? ['pppoe.manage'] : []),
      ...(canCut ? ['pppoe.cut'] : []),
    ],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  return { updateMutateAsync, enforceMutateAsync };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── SC-1: Select con planes filtrados ─────────────────────────────────────────
describe('SC-1: dropdown de planes con opciones filtradas', () => {
  it('muestra solo los planes enabled y no-Corte', () => {
    setup();
    renderPanel();

    const select = screen.getByRole('combobox', { name: /velocidad/i });
    expect(select).toBeInTheDocument();

    // Planes enabled + no-Corte: p1 (Air 10/5) y p2 (Air 30/10)
    expect(screen.getByRole('option', { name: /Air 10\/5/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Air 30\/10/i })).toBeInTheDocument();

    // Excluidos: Corte (category=Corte) y Alta Disabled (status=disabled)
    expect(screen.queryByRole('option', { name: /Corte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Alta Disabled/i })).not.toBeInTheDocument();
  });

  it('pre-selecciona el plan actual (profile del PPPoE)', () => {
    setup(); // pppoe.profile = 'IP-Air-10-5'
    renderPanel();

    const select = screen.getByRole('combobox', { name: /velocidad/i }) as HTMLSelectElement;
    expect(select.value).toBe('IP-Air-10-5');
  });
});

// ── SC-2: Aplicar deshabilitado cuando no hay cambio ─────────────────────────
describe('SC-2: Aplicar deshabilitado cuando el plan no cambió', () => {
  it('"Aplicar" está deshabilitado cuando el plan seleccionado es el actual', () => {
    setup();
    renderPanel();

    const aplicarBtn = screen.getByRole('button', { name: /^Aplicar$/i });
    expect(aplicarBtn).toBeDisabled();
  });

  it('"Aplicar" se habilita al seleccionar un plan diferente', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    const select = screen.getByRole('combobox', { name: /velocidad/i });
    await user.selectOptions(select, 'IP-Air-30-10');

    const aplicarBtn = screen.getByRole('button', { name: /^Aplicar$/i });
    expect(aplicarBtn).not.toBeDisabled();
  });
});

// ── SC-3: Click Aplicar llama update con { profile: code } ───────────────────
describe('SC-3: click Aplicar llama update.mutateAsync con { profile: code }', () => {
  it('al confirmar el cambio de plan llama update con el code del plan elegido', async () => {
    const user = userEvent.setup();
    const updateFn = vi.fn().mockResolvedValue({});
    setup({ updateMutateAsync: updateFn });
    renderPanel();

    const select = screen.getByRole('combobox', { name: /velocidad/i });
    await user.selectOptions(select, 'IP-Air-30-10');

    await user.click(screen.getByRole('button', { name: /^Aplicar$/i }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith({
        id: 'pppoe-1',
        body: { profile: 'IP-Air-30-10' },
      });
    });
  });
});

// ── SC-4: Sin planes → degradación (texto, sin crash) ────────────────────────
describe('SC-4: usePlans() devuelve [] → no hay select, muestra perfil como texto', () => {
  it('sin planes no se renderiza el select de velocidad y no hay crash', () => {
    setup({ plans: [] });
    renderPanel();

    expect(screen.queryByRole('combobox', { name: /velocidad/i })).not.toBeInTheDocument();
    // El panel no debe crashear y debe seguir mostrando otros datos
    expect(screen.getByText('cliente.test')).toBeInTheDocument();
  });

  it('muestra el perfil actual como texto cuando no hay planes', () => {
    setup({ plans: [] });
    renderPanel();

    // El perfil actual debe estar visible como read-only text
    expect(screen.getByTestId('speed-profile-readonly')).toBeInTheDocument();
    expect(screen.getByTestId('speed-profile-readonly')).toHaveTextContent('IP-Air-10-5');
  });
});

// ── SC-5: Error en usePlans → degradación sin crash ──────────────────────────
describe('SC-5: usePlans() con error → no hay select, panel no se rompe', () => {
  it('si usePlans falla no se renderiza el select y el panel sigue funcionando', () => {
    setup({ plansError: true });
    renderPanel();

    expect(screen.queryByRole('combobox', { name: /velocidad/i })).not.toBeInTheDocument();
    // Panel sigue mostrando datos del PPPoE
    expect(screen.getByText('cliente.test')).toBeInTheDocument();
  });
});

// ── SC-6: Gate pppoe.manage ───────────────────────────────────────────────────
describe('SC-6: sin pppoe.manage el control de velocidad no se renderiza', () => {
  it('sin permiso pppoe.manage el select de velocidad no aparece', () => {
    setup({ canManage: false });
    renderPanel();

    expect(screen.queryByRole('combobox', { name: /velocidad/i })).not.toBeInTheDocument();
  });
});

// ── SC-7: Error en Aplicar → banner role="alert" ──────────────────────────────
describe('SC-7: error en Aplicar → muestra banner role="alert"', () => {
  it('cuando update rechaza muestra un banner de error', async () => {
    const user = userEvent.setup();
    const updateFn = vi.fn().mockRejectedValue(new Error('network error'));
    setup({ updateMutateAsync: updateFn });
    renderPanel();

    const select = screen.getByRole('combobox', { name: /velocidad/i });
    await user.selectOptions(select, 'IP-Air-30-10');
    await user.click(screen.getByRole('button', { name: /^Aplicar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// ── RG-1: Cortar sigue funcionando tras el rediseño ───────────────────────────
describe('RG-1: regresión — Cortar abre modal y llama enforce', () => {
  it('click en Cortar → modal → confirmar → enforce con action:block', async () => {
    const user = userEvent.setup();
    const enforceFn = vi.fn().mockResolvedValue({});
    setup({ enforceMutateAsync: enforceFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Cortar$/i }));
    expect(screen.getByTestId('reason-textarea')).toBeInTheDocument();

    await user.type(screen.getByTestId('reason-textarea'), 'Deuda');
    const dialog = screen.getByTestId('reason-textarea').closest('[role="dialog"]') as HTMLElement;
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(
      (b) => b.textContent !== 'Cancelar',
    )!;
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(enforceFn).toHaveBeenCalledWith({
        id: 'pppoe-1',
        action: 'block',
        reason: 'Deuda',
      });
    });
  });
});

// ── RG-2: Desasociar y Dar de baja siguen presentes ───────────────────────────
describe('RG-2: regresión — Desasociar y Dar de baja PPPoE siguen presentes', () => {
  it('ambos botones están en el DOM tras el rediseño', () => {
    setup();
    renderPanel();

    expect(screen.getByRole('button', { name: /Desasociar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar de baja PPPoE/i })).toBeInTheDocument();
  });
});

// ── RG-3: Grupos semánticos en el DOM ─────────────────────────────────────────
describe('RG-3: regresión — los 3 grupos están en el DOM', () => {
  it('renderiza las secciones Modificar, Control de servicio y Ciclo de vida', () => {
    setup();
    renderPanel();

    expect(screen.getByText(/Modificar/i)).toBeInTheDocument();
    expect(screen.getByText(/Control de servicio/i)).toBeInTheDocument();
    expect(screen.getByText(/Ciclo de vida/i)).toBeInTheDocument();
  });
});
