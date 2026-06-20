/**
 * InternetPanel — Desasociar PPPoE
 *
 * Cubre:
 *  DA-1  Con PPPoE activo + pppoe.manage → el botón "Desasociar" se renderiza
 *  DA-2  Click en "Desasociar" → muestra diálogo de confirmación
 *  DA-3  Confirmar diálogo → llama a la mutation deassociate con (pppoeId)
 *  DA-4  Sin pppoe.manage → el botón "Desasociar" NO se renderiza
 *  DA-5  "Desasociar" y "Dar de baja PPPoE" son acciones distintas y coexisten
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
import type { PppoeServiceDto } from '@/types/pppoe';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
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

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: [ACTIVE_PPPOE],
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
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());

  // Stub useDeassociatePppoe — el hook que añadiremos
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

describe('DA-2: click en Desasociar muestra diálogo de confirmación', () => {
  it('al hacer click en "Desasociar" aparece el diálogo de confirmación', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));

    // El diálogo de confirmación tiene el título "Desasociar PPPoE"
    expect(screen.getByText('Desasociar PPPoE')).toBeInTheDocument();
    expect(screen.getByText(/Desasociar este PPPoE del contrato/i)).toBeInTheDocument();
    expect(screen.getByText(/Volverá al inventario de PPPoE libres/i)).toBeInTheDocument();
  });
});

describe('DA-3: confirmar diálogo llama a la mutation deassociate', () => {
  it('confirmar dispara deassociateMutateAsync con el id del PPPoE', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue({});
    setup({ deassociateMutateAsync: mutate });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));
    // Dialog is now open — click Confirmar
    expect(screen.getByText('Desasociar PPPoE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith('pppoe-active');
    });
  });

  it('cancelar el diálogo NO llama a la mutation', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    setup({ deassociateMutateAsync: mutate });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Desasociar$/i }));
    // Verify dialog is open then cancel
    expect(screen.getByText('Desasociar PPPoE')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Cancelar$/i }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText('Desasociar PPPoE')).not.toBeInTheDocument();
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
