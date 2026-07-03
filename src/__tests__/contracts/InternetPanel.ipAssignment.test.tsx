/**
 * InternetPanel — regresión sqlippool descartado (S6.1)
 *
 * El toggle "IP fija" / "Liberar (volver al pool)" + el input de pin de modo
 * pool (IpAssignmentControl) se REMOVIERON: el sqlippool fue descartado y ningún
 * NAS corre en modo pool, así que el control era código muerto (409 seguro).
 *
 * S6.1  El panel con un PPPoE fijo sigue mostrando la IP en el detalle, pero YA
 *       NO hay control de "Asignación de IP" ni botón "Liberar"/"Fijar IP".
 */
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

import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/useContractServices');
vi.mock('@/hooks/usePlans');
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({ ServiceRemovalReasonModal: () => null }),
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
  pppoe?: Partial<PppoeServiceDto>;
  canManage?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const { pppoe: pppoePatch = {}, canManage = true } = opts;

  const pppoe = { ...BASE_PPPOE, ...pppoePatch };

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: [pppoe],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue(mockQuery({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  }));

  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue(mockQuery({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  }));

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());

  vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({
    data: [{ id: 'nas-1', name: 'Router Central', type: 'mikrotik_api', ipAddress: '192.168.1.1', radiusSecret: 'secret', nasIpAddress: '192.168.1.1', apiPort: null, apiLogin: null, apiPassword: null, status: 'active', lastSeen: null, clientCount: 0, description: '' }],
  }));

  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue(mockQuery({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }));

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());

  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn((perm: string | string[]) => {
      const perms = Array.isArray(perm) ? perm : [perm];
      return perms.some((p) => {
        if (p === 'pppoe.manage') return canManage;
        if (p === 'pppoe.cut') return true;
        return true;
      });
    }),
    isLoading: false,
    isError: false,
    permissions: [
      ...(canManage ? ['pppoe.manage'] : []),
      'pppoe.cut',
    ],
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

// ── S6.1: la IP sigue visible pero el control de asignación se removió ────────
describe('S6.1: PPPoE fijo muestra la IP en el detalle, sin control de asignación', () => {
  it('la IP del servicio sigue visible en el detalle (con el badge "fija")', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' } });
    renderPanel();

    expect(screen.getByText(/10\.0\.0\.9/)).toBeInTheDocument();
    expect(screen.getByText('fija')).toBeInTheDocument();
  });

  it('YA NO existe la sección "Asignación de IP" ni el botón "Liberar"', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' } });
    renderPanel();

    expect(screen.queryByText(/Asignación de IP/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Liberar \(volver al pool\)/i }),
    ).not.toBeInTheDocument();
  });

  it('tampoco existe el botón "Fijar IP" del modo pool', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' } });
    renderPanel();

    expect(screen.queryByRole('button', { name: /^Fijar IP$/i })).not.toBeInTheDocument();
  });
});
