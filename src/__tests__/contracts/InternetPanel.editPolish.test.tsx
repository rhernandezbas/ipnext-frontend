/**
 * InternetPanel — Edit form polish (internetpanel-edit-polish)
 *
 * EP-1  El form de Editar NO tiene un campo "Perfil" (free-text) — fue removido.
 * EP-2  El form de Editar tiene los campos: Nueva contraseña, IP remota, Router.
 * EP-3  El botón "Editar" está presente y al clickearlo abre el form.
 * EP-4  El form de Editar tiene un control de auto-asignación de IP (toggle Privada/Pública + botón).
 * EP-5  Al seleccionar tipo y el hook devuelve IP libre, el campo "IP remota" del edit se rellena.
 * EP-6  El botón Editar tiene un ícono pencil (SVG con aria-hidden) visible.
 * EP-7  El form de Editar cierra al hacer click en Cancelar (regresión).
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
import type { PlanDto } from '@/types/plans';

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
  nextFreeIp?: { data?: { ip: string } | undefined; isSuccess?: boolean; isFetching?: boolean; isError?: boolean; error?: Error | null; };
}

function setup(opts: SetupOpts = {}) {
  const { pppoe: pppoePatch = {}, nextFreeIp = {} } = opts;
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

  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue(mockQuery({
    data: undefined, isLoading: false, isError: false, isSuccess: false,
  }));
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useUpdatePppoe>);

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
    ...nextFreeIp,
  }));

  vi.mocked(useContractServicesModule.useUpdateContractService).mockReturnValue(neutralMutation());

  vi.mocked(usePlansModule.usePlans).mockReturnValue(mockQuery({
    data: PLANS,
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));

  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    can: vi.fn(() => true),
    isLoading: false,
    isError: false,
    permissions: ['pppoe.manage', 'pppoe.cut'],
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

/** Abre el form de edición clickeando el botón "Editar". */
async function openEditForm(user: ReturnType<typeof userEvent.setup>) {
  const editBtn = screen.getByRole('button', { name: /Editar/i });
  await user.click(editBtn);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── EP-1: Sin campo "Perfil" en el form de Editar ────────────────────────────
describe('EP-1: el form de Editar NO tiene campo "Perfil" (free-text)', () => {
  it('no existe un input con label "Perfil" dentro del form de edición', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    // El form de editar NO debe tener un label "Perfil" asociado a un input
    expect(screen.queryByLabelText(/^Perfil$/i)).not.toBeInTheDocument();
  });

  it('no existe un input con id "pppoe-edit-profile"', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    expect(document.querySelector('#pppoe-edit-profile')).toBeNull();
  });
});

// ── EP-2: Los campos correctos están presentes ───────────────────────────────
describe('EP-2: el form de Editar tiene los campos esperados', () => {
  it('tiene "Nueva contraseña", "IP remota" y "Router"', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/IP remota/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Router/i })).toBeInTheDocument();
  });
});

// ── EP-3: El botón Editar abre el form ───────────────────────────────────────
describe('EP-3: el botón "Editar" abre el form de edición', () => {
  it('antes de clickear no hay campo "Nueva contraseña"', () => {
    setup();
    renderPanel();

    expect(screen.queryByLabelText(/Nueva contraseña/i)).not.toBeInTheDocument();
  });

  it('después de clickear aparece el form con "Nueva contraseña"', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();
  });
});

// ── EP-4: Control de auto-asignación de IP en el form de Editar ──────────────
describe('EP-4: el form de Editar tiene el control de auto-asignación de IP', () => {
  it('tiene un toggle Privada / Pública dentro del form de edición', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    // Deben existir botones Privada y Pública (pueden ser varios si el form de crear también está visible,
    // pero el form de crear solo aparece si no hay PPPoE activo — aquí sí hay PPPoE activo)
    expect(screen.getByRole('button', { name: 'Privada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pública' })).toBeInTheDocument();
  });

  it('tiene un botón "Auto-asignar IP" dentro del form de edición', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    expect(screen.getByRole('button', { name: /Auto-asignar IP/i })).toBeInTheDocument();
  });
});

// ── EP-5: Auto-asignación rellena el campo "IP remota" del edit ──────────────
describe('EP-5: auto-asignación rellena la IP del form de edición', () => {
  it('click en Auto-asignar IP (con tipo seleccionado) rellena la IP remota', async () => {
    const user = userEvent.setup();
    const refetchMock = vi.fn().mockResolvedValue({});

    // El hook devuelve datos listos desde el principio
    setup({
      nextFreeIp: {
        data: { ip: '100.64.10.50' },
        isSuccess: true,
        isFetching: false,
        isError: false,
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useNasModule.useNextFreeIp>,
    });

    renderPanel();
    await openEditForm(user);

    // Primero elegir el tipo
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    // Luego click en "Auto-asignar IP" — esto pone editIpAutoFilled=true y el useEffect llena el campo
    const autoBtn = screen.getByRole('button', { name: /Auto-asignar IP/i });
    await user.click(autoBtn);

    // El campo IP remota se rellena con la IP libre
    await waitFor(() => {
      const ipInput = screen.getByLabelText(/IP remota/i);
      expect(ipInput).toHaveValue('100.64.10.50');
    });
  });

  it('el hook useNextFreeIp se llama con el nasId del PPPoE y el tipo seleccionado', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await openEditForm(user);

    await user.click(screen.getByRole('button', { name: 'Pública' }));

    // useNextFreeIp debe haber sido llamado con nas-1 (nasId del PPPoE base) y 'public'
    expect(useNasModule.useNextFreeIp).toHaveBeenCalledWith('nas-1', 'public');
  });
});

// ── EP-6: El botón Editar tiene ícono pencil ─────────────────────────────────
describe('EP-6: el botón "Editar" tiene un ícono SVG de lápiz', () => {
  it('el botón Editar contiene un SVG con aria-hidden', () => {
    setup();
    renderPanel();

    const editBtn = screen.getByRole('button', { name: /Editar/i });
    const svg = editBtn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── EP-7: Cancelar cierra el form (regresión) ─────────────────────────────────
describe('EP-7: Cancelar cierra el form de edición', () => {
  it('click en Cancelar vuelve a mostrar el botón Editar', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();

    await openEditForm(user);
    expect(screen.getByLabelText(/Nueva contraseña/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));

    expect(screen.queryByLabelText(/Nueva contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument();
  });
});
