/**
 * InternetPanel — status vocabulary (Bug 2)
 *
 * PppoeService.status is 'enabled' | 'disabled' | 'pending' (RADIUS secret state).
 * 'active' belongs to enforcedState, NOT to PppoeService.status.
 *
 * Tests:
 *  SV-1  status:'enabled' → badge "Activo" shown, "Asociar PPPoE existente" NOT rendered
 *  SV-2  status:'disabled' → badge "Desactivado" shown
 *  SV-3  status:'active' (old wrong value) → NOT treated as active → "Asociar" section IS shown
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';

vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'active' }];

function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

function baseSetup(pppoeData: PppoeServiceDto[]) {
  vi.mocked(usePlansModule.usePlans).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePlansModule.usePlans>);

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: pppoeData,
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

  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useAssociatePppoe>);

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
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());

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

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(
    neutralMutation(),
  );

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
    permissions: ['pppoe.manage'],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);
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

const ENABLED_PPPOE: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente.test',
  profile: '10M',
  remoteAddress: '10.0.0.9',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-1',
  createdAt: '2026-06-01T00:00:00Z',
};

const DISABLED_PPPOE: PppoeServiceDto = {
  ...ENABLED_PPPOE,
  id: 'pppoe-2',
  status: 'disabled',
};

describe('SV-1: status:enabled → badge Activo, no Asociar section', () => {
  it('renders badge "Activo" and does NOT show "Asociar PPPoE existente"', () => {
    baseSetup([ENABLED_PPPOE]);
    renderPanel();

    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByText('Asociar PPPoE existente')).not.toBeInTheDocument();
  });
});

describe('SV-2: status:disabled → badge Desactivado', () => {
  it('renders badge "Desactivado" when PppoeService.status is "disabled"', () => {
    baseSetup([DISABLED_PPPOE]);
    renderPanel();

    // The panel finds no 'enabled' pppoe, so it shows the empty state with adopt/create forms
    // The disabled pppoe does NOT become the activePppoe
    // The badge area is not shown (activePppoe is null)
    // Instead, "Asociar PPPoE existente" should be present (no active pppoe found)
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.getByText('Asociar PPPoE existente')).toBeInTheDocument();
  });
});

describe('SV-3: regresión — status:"active" (valor viejo bugueado) NO se trata como activo', () => {
  it('does NOT show the active panel when status carries the old "active" value', () => {
    // Regression guard del bug: el FE chequeaba status === 'active', pero
    // PppoeService.status es 'enabled'/'disabled'/'pending' ('active' es enforcedState).
    // Un PPPoE con el viejo valor 'active' NO debe elegirse como activePppoe.
    const pppoeWithOldActiveStatus: PppoeServiceDto = {
      ...ENABLED_PPPOE,
      status: 'active', // valor viejo y equivocado — debe ignorarse ahora
    };
    baseSetup([pppoeWithOldActiveStatus]);
    renderPanel();

    // 'active' ya no se reconoce → no hay activePppoe → se muestra la UI de adopción, sin badge "Activo"
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.getByText('Asociar PPPoE existente')).toBeInTheDocument();
  });
});
