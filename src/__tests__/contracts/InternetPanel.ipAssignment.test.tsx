/**
 * InternetPanel — IP Assignment control (pin / unpin)
 *
 * IP-1  ipMode='fixed' → renderiza "IP fija: {ip}" + botón "Liberar (volver al pool)"
 * IP-2  ipMode='pool'  → renderiza "IP automática del pool" + botón "Fijar IP"
 * IP-3  Click "Fijar IP" → revela input + botón "Fijar"; confirmar llama pinIp con la IP
 * IP-4  Pin con éxito → banner role="status" con "IP fijada"
 * IP-5  Pin 409 → "Esa IP ya está asignada a otro cliente."
 * IP-6  Unpin con éxito → banner role="status" con "IP liberada"
 * IP-7  Unpin 409 → "Este router no tiene pool — no se puede liberar."
 * IP-8  Unpin 502 → "Router no disponible, reintentá."
 * IP-9  Sin permiso pppoe.manage → el control no se renderiza
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as useContractServicesModule from '@/hooks/useContractServices';
import * as usePlansModule from '@/hooks/usePlans';
import type { PppoeServiceDto } from '@/types/pppoe';

import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';

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
  pinMutateAsync?: Mock;
  unpinMutateAsync?: Mock;
}

function setup(opts: SetupOpts = {}) {
  const {
    pppoe: pppoePatch = {},
    canManage = true,
    pinMutateAsync = vi.fn().mockResolvedValue({}),
    unpinMutateAsync = vi.fn().mockResolvedValue({}),
  } = opts;

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

  vi.mocked(usePppoeModule.usePinPppoeIp).mockReturnValue(mockMutation({
    mutateAsync: pinMutateAsync,
    isPending: false,
  }));

  vi.mocked(usePppoeModule.useUnpinPppoeIp).mockReturnValue(mockMutation({
    mutateAsync: unpinMutateAsync,
    isPending: false,
  }));

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

  return { pinMutateAsync, unpinMutateAsync };
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

// ── IP-1: ipMode=fixed muestra la IP fija + botón Liberar ────────────────────
describe('IP-1: ipMode=fixed renderiza IP fija y botón Liberar', () => {
  it('muestra "IP fija: 10.0.0.9" y el botón "Liberar (volver al pool)"', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' } });
    renderPanel();

    expect(screen.getByText(/Asignación de IP/i)).toBeInTheDocument();
    expect(screen.getByText(/IP fija: 10\.0\.0\.9/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Liberar \(volver al pool\)/i })).toBeInTheDocument();
  });

  it('muestra el badge "fija" en la sección de detalle IP remota', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' } });
    renderPanel();

    // El badge "fija" debe estar junto al IP remota detail
    expect(screen.getByText('fija')).toBeInTheDocument();
  });
});

// ── IP-2: ipMode=pool muestra "Automática" + botón Fijar IP ─────────────────
describe('IP-2: ipMode=pool renderiza IP automática y botón Fijar IP', () => {
  it('muestra "IP automática del pool" y el botón "Fijar IP"', () => {
    setup({ pppoe: { ipMode: 'pool', remoteAddress: null } });
    renderPanel();

    expect(screen.getByText(/IP automática del pool/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fijar IP$/i })).toBeInTheDocument();
  });
});

// ── IP-3: Fijar IP → revela input y confirmar llama pinIp ───────────────────
describe('IP-3: click "Fijar IP" revela input; confirmar llama pinIp', () => {
  it('click Fijar IP muestra el input y el botón Fijar', async () => {
    const user = userEvent.setup();
    setup({ pppoe: { ipMode: 'pool', remoteAddress: null } });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Fijar IP$/i }));

    expect(screen.getByRole('textbox', { name: /IP a fijar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fijar$/i })).toBeInTheDocument();
  });

  it('tipear IP y confirmar llama pinIp con la IP ingresada', async () => {
    const user = userEvent.setup();
    const pinFn = vi.fn().mockResolvedValue({});
    setup({ pppoe: { ipMode: 'pool', remoteAddress: null }, pinMutateAsync: pinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Fijar IP$/i }));
    await user.type(screen.getByRole('textbox', { name: /IP a fijar/i }), '10.0.0.42');
    await user.click(screen.getByRole('button', { name: /^Fijar$/i }));

    await waitFor(() => {
      expect(pinFn).toHaveBeenCalledWith({ id: 'pppoe-1', ip: '10.0.0.42' });
    });
  });
});

// ── IP-4: Pin éxito → banner "IP fijada" ────────────────────────────────────
describe('IP-4: pin con éxito → banner role="status" con "IP fijada"', () => {
  it('tras el éxito aparece el banner de confirmación', async () => {
    const user = userEvent.setup();
    const pinFn = vi.fn().mockResolvedValue({});
    setup({ pppoe: { ipMode: 'pool', remoteAddress: null }, pinMutateAsync: pinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Fijar IP$/i }));
    await user.type(screen.getByRole('textbox', { name: /IP a fijar/i }), '10.0.0.99');
    await user.click(screen.getByRole('button', { name: /^Fijar$/i }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent(/IP fijada/i);
    });
  });
});

// ── IP-5: Pin 409 → "ya está asignada" ──────────────────────────────────────
describe('IP-5: pin 409 → mensaje "ya está asignada"', () => {
  it('cuando la IP está tomada muestra el mensaje correcto', async () => {
    const user = userEvent.setup();
    const err409 = Object.assign(new Error('conflict'), { response: { status: 409 } });
    const pinFn = vi.fn().mockRejectedValue(err409);
    setup({ pppoe: { ipMode: 'pool', remoteAddress: null }, pinMutateAsync: pinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^Fijar IP$/i }));
    await user.type(screen.getByRole('textbox', { name: /IP a fijar/i }), '10.0.0.1');
    await user.click(screen.getByRole('button', { name: /^Fijar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ya está asignada a otro cliente/i);
    });
  });
});

// ── IP-6: Unpin éxito → banner "IP liberada" ─────────────────────────────────
describe('IP-6: unpin con éxito → banner role="status" con "IP liberada"', () => {
  it('tras liberar aparece el banner de confirmación', async () => {
    const user = userEvent.setup();
    const unpinFn = vi.fn().mockResolvedValue({});
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' }, unpinMutateAsync: unpinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Liberar \(volver al pool\)/i }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent(/IP liberada/i);
    });
  });
});

// ── IP-7: Unpin 409 → "no tiene pool" ────────────────────────────────────────
describe('IP-7: unpin 409 → "Este router no tiene pool"', () => {
  it('cuando el router no tiene pool muestra el mensaje correcto', async () => {
    const user = userEvent.setup();
    const err409 = Object.assign(new Error('no pool'), { response: { status: 409 } });
    const unpinFn = vi.fn().mockRejectedValue(err409);
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' }, unpinMutateAsync: unpinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Liberar \(volver al pool\)/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no tiene pool/i);
    });
  });
});

// ── IP-8: Unpin 502 → "Router no disponible" ─────────────────────────────────
describe('IP-8: unpin 502 → "Router no disponible"', () => {
  it('cuando el router está caído muestra el mensaje de 502', async () => {
    const user = userEvent.setup();
    const err502 = Object.assign(new Error('bad gateway'), { response: { status: 502 } });
    const unpinFn = vi.fn().mockRejectedValue(err502);
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' }, unpinMutateAsync: unpinFn });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Liberar \(volver al pool\)/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Router no disponible/i);
    });
  });
});

// ── IP-9: Sin pppoe.manage → control no se renderiza ─────────────────────────
describe('IP-9: sin pppoe.manage el control no se renderiza', () => {
  it('sin el permiso no hay control de Asignación de IP', () => {
    setup({ pppoe: { ipMode: 'fixed', remoteAddress: '10.0.0.9' }, canManage: false });
    renderPanel();

    expect(screen.queryByText(/Asignación de IP/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Liberar \(volver al pool\)/i })).not.toBeInTheDocument();
  });
});
