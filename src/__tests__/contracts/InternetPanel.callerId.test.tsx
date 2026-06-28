/**
 * InternetPanel — Caller-ID (MAC) display
 *
 * Cubre:
 *  CID-1  Loading → renderiza "…" en la celda Caller-ID
 *  CID-2  Success con valor → renderiza la MAC string
 *  CID-3  Success con null → renderiza "— sin sesión activa"
 *  CID-4  Error → renderiza "—" y el panel NO crashea (el resto sigue visible)
 *  CID-5  La baja lifecycleHint menciona "borra" y "libera la IP"
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

type CallerIdReturn = ReturnType<typeof usePppoeModule.usePppoeCallerId>;

interface SetupOpts {
  callerId?: Partial<CallerIdReturn>;
}

function setup(opts: SetupOpts = {}) {
  const { callerId = {} } = opts;

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

  // Caller-ID hook — el test lo controla
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...callerId,
  } as CallerIdReturn);

  // Mutations que el panel construye pero estos tests no ejercitan
  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());

  vi.mocked(usePppoeModule.usePinPppoeIp).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUnpinPppoeIp).mockReturnValue(neutralMutation());

  vi.mocked(useNasModule.useNasServers).mockReturnValue({
    data: [{ id: 'nas-1', name: 'Router Central' }],
  } as ReturnType<typeof useNasModule.useNasServers>);
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue({
    data: undefined, isSuccess: false, isError: false, isFetching: false,
    error: null, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>);

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
    permissions: ['pppoe.manage', 'pppoe.read', 'pppoe.cut'],
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CID-1: Caller-ID loading', () => {
  it('muestra "…" mientras carga el caller-id', () => {
    setup({ callerId: { isLoading: true, data: undefined, isError: false, isSuccess: false } });
    renderPanel();

    expect(screen.getByText('Caller-ID (MAC)')).toBeInTheDocument();
    // El "…" puede estar mezclado con texto, buscamos la celda
    const dt = screen.getByText('Caller-ID (MAC)');
    const dd = dt.nextElementSibling ?? dt.closest('div')?.querySelector('dd');
    expect(dd?.textContent).toContain('…');
  });
});

describe('CID-2: Caller-ID con valor', () => {
  it('muestra la MAC string cuando callerId tiene valor', () => {
    setup({
      callerId: {
        data: { callerId: 'AA:BB:CC:DD:EE:FF' },
        isLoading: false,
        isError: false,
        isSuccess: true,
      },
    });
    renderPanel();

    expect(screen.getByText('Caller-ID (MAC)')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC:DD:EE:FF')).toBeInTheDocument();
  });
});

describe('CID-3: Caller-ID null / sin sesión activa', () => {
  it('muestra "— sin sesión activa" cuando callerId es null', () => {
    setup({
      callerId: {
        data: { callerId: null },
        isLoading: false,
        isError: false,
        isSuccess: true,
      },
    });
    renderPanel();

    expect(screen.getByText('Caller-ID (MAC)')).toBeInTheDocument();
    expect(screen.getByText(/sin sesión activa/i)).toBeInTheDocument();
  });
});

describe('CID-4: Caller-ID error — panel no crashea', () => {
  it('muestra "—" y el panel sigue renderizando el usuario PPPoE', () => {
    setup({
      callerId: {
        data: undefined,
        isLoading: false,
        isError: true,
        isSuccess: false,
      },
    });
    renderPanel();

    // Panel sigue renderizando datos del PPPoE
    expect(screen.getByText('cliente.activo')).toBeInTheDocument();
    expect(screen.getByText('Caller-ID (MAC)')).toBeInTheDocument();
    // La celda de error debe mostrar un "—" (muted)
    const dt = screen.getByText('Caller-ID (MAC)');
    const dd = dt.nextElementSibling ?? dt.closest('div')?.querySelector('dd');
    expect(dd?.textContent).toBe('—');
  });
});

describe('CID-5: Baja lifecycleHint refleja borra + libera IP', () => {
  it('el hint de baja menciona que borra del RADIUS y libera la IP', () => {
    setup();
    renderPanel();

    // Buscamos el hint que acompaña al botón "Dar de baja PPPoE"
    const bajaBtn = screen.getByRole('button', { name: /Dar de baja PPPoE/i });
    const lifecycleItem = bajaBtn.closest('div');
    expect(lifecycleItem?.textContent).toMatch(/RADIUS/i);
    expect(lifecycleItem?.textContent).toMatch(/libera/i);
  });
});
