/**
 * InternetPanel — Desasociar PPPoE
 *
 * Cubre:
 *  DA-1  Con PPPoE activo + pppoe.manage → el botón "Desasociar" se renderiza
 *  DA-2  Click en "Desasociar" → abre ServiceRemovalReasonModal (textarea visible)
 *  DA-3a Confirmar motivo en el modal → llama a deassociate con { pppoeId, reason }
 *  DA-3b Cancelar el modal → NO llama a la mutation
 *  DA-4  Sin pppoe.manage → el botón "Desasociar" NO se renderiza
 *  DA-5  "Desasociar" y "Dar de baja PPPoE" son acciones distintas y coexisten
 */
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
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');
// ServiceRemovalReasonModal usa createPortal; renderizamos una versión real pero
// simplificada para poder interactuar con el textarea y los botones.
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({
    ServiceRemovalReasonModal: ({
      open,
      serviceName,
      onConfirm,
      onCancel,
    }: {
      open: boolean;
      serviceName: string;
      onConfirm: (reason: string) => void;
      onCancel: () => void;
    }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-label={serviceName}>
          <textarea data-testid="reason-textarea" placeholder="Motivo" />
          <button
            type="button"
            onClick={() => {
              const el = document.querySelector<HTMLTextAreaElement>('[data-testid="reason-textarea"]');
              onConfirm(el?.value ?? 'motivo-test');
            }}
          >
            Dar de baja
          </button>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      );
    },
  }),
);

// ── Fixtures ─────────────────────────────────────────────────────────────────
const ACTIVE_PPPOE: PppoeServiceDto = {
  id: 'pppoe-active',
  username: 'cliente.activo',
  profile: '10M',
  remoteAddress: '10.0.0.9',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-01T00:00:00Z',
  ipMode: 'fixed',
  ipTypePreference: 'cgnat',
};

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
  canManage?: boolean;
  canCut?: boolean;
  deassociateMutateAsync?: ReturnType<typeof vi.fn>;
  deassociatePending?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const {
    canManage = true,
    canCut = true,
    deassociateMutateAsync = vi.fn().mockResolvedValue({}),
    deassociatePending = false,
  } = opts;

  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: [ACTIVE_PPPOE],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePppoeModule.useContractPppoe>);

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  } as ReturnType<typeof usePppoeModule.usePppoeCallerId>);

  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue({
    mutateAsync: deassociateMutateAsync,
    isPending: deassociatePending,
  } as unknown as ReturnType<typeof usePppoeModule.useDeassociatePppoe>);


  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined, isSuccess: false, isError: false, isFetching: false,
    error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(
    neutralMutation(),
  );

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some((p) => {
        if (p === 'pppoe.manage') return canManage;
        if (p === 'pppoe.cut') return canCut;
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

  return { deassociateMutateAsync };
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DA-1: botón Desasociar aparece con PPPoE activo y pppoe.manage', () => {
  it('se renderiza el botón "Desasociar" cuando hay PPPoE activo y el usuario tiene pppoe.manage', () => {
    setup();
    renderPanel();
    expect(screen.getByRole('button', { name: /Desasociar/i })).toBeInTheDocument();
  });
});

describe('DA-2: click en Desasociar abre ServiceRemovalReasonModal (textarea)', () => {
  it('al hacer click en "Desasociar" aparece el modal con un textarea para el motivo', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));

    // El mock del modal renderiza un textarea cuando open=true
    expect(screen.getByTestId('reason-textarea')).toBeInTheDocument();
  });
});

describe('DA-3a: confirmar motivo llama a deassociate con { pppoeId, reason }', () => {
  it('confirmar en el modal dispara deassociateMutateAsync con pppoeId y reason', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue({});
    setup({ deassociateMutateAsync: mutate });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));
    // Escribe el motivo en el textarea del modal mock
    await user.type(screen.getByTestId('reason-textarea'), 'Cliente se va');
    // Confirma
    await user.click(screen.getByRole('button', { name: /^Dar de baja$/i }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ pppoeId: 'pppoe-active', reason: 'Cliente se va' });
    });
  });
});

describe('DA-3b: cancelar el modal NO llama a la mutation', () => {
  it('cancelar el modal cierra sin llamar a deassociate', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    setup({ deassociateMutateAsync: mutate });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));
    expect(screen.getByTestId('reason-textarea')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Cancelar$/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reason-textarea')).not.toBeInTheDocument();
  });
});

describe('DA-4: gating sin pppoe.manage', () => {
  it('sin pppoe.manage el botón Desasociar NO se renderiza', () => {
    setup({ canManage: false });
    renderPanel();
    expect(screen.queryByRole('button', { name: /Desasociar/i })).not.toBeInTheDocument();
  });
});

describe('DA-5: Desasociar y Dar de baja coexisten como acciones distintas', () => {
  it('con pppoe.manage y pppoe.cut ambos botones están visibles simultáneamente', () => {
    setup({ canManage: true, canCut: true });
    renderPanel();
    expect(screen.getByRole('button', { name: /Desasociar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar de baja PPPoE/i })).toBeInTheDocument();
  });
});
