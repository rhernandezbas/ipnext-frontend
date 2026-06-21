/**
 * InternetPanel — Adopción de inventario PPPoE
 *
 * Cubre:
 *  AD-1  Sin PPPoE activo + pppoe.manage → se renderiza la sección "Asociar PPPoE existente"
 *  AD-2  Loading: muestra "Cargando PPPoE sin asignar…"
 *  AD-3  Empty: lista vacía muestra el hint del ingest
 *  AD-4  Filtro por usuario acota la lista
 *  AD-5  Asociar: click → mutateAsync con { id } → éxito (sin error visible)
 *  AD-6  Asociar 409: muestra el mensaje de "ya asociado a otro contrato"
 *  AD-7  Gating: sin pppoe.manage → ni la sección de adopción ni el form de crear se renderizan
 *  RV-1  Reveal: el password NO se pide eager (enabled=false en el primer render)
 *  RV-2  Reveal: click en el ojo → enabled=true → muestra el password resuelto
 *  RV-3  Reveal gating: sin pppoe.manage la fila de Contraseña no se renderiza
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const NO_PPPOE_CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'inactive' }];

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

const ORPHANS: PppoeServiceDto[] = [
  {
    id: 'orphan-1', username: 'juan.perez', profile: '20M', remoteAddress: '10.0.0.1',
    status: 'active', enforcedState: 'active', nasId: 'nas-1', contractId: null,
    createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'orphan-2', username: 'maria.gomez', profile: null, remoteAddress: null,
    status: 'active', enforcedState: 'active', nasId: 'nas-1', contractId: null,
    createdAt: '2026-06-01T00:00:00Z',
  },
];

/** Stub neutral para todas las mutations que el panel construye pero estos tests no ejercitan. */
function neutralMutation() {
  return { mutateAsync: vi.fn(), isPending: false } as never;
}

interface SetupOpts {
  contractPppoe?: Partial<ReturnType<typeof usePppoeModule.useContractPppoe>>;
  unassigned?: Partial<ReturnType<typeof usePppoeModule.useUnassignedPppoe>>;
  associateMutateAsync?: ReturnType<typeof vi.fn>;
  associatePending?: boolean;
  credentials?: Partial<ReturnType<typeof usePppoeModule.usePppoeCredentials>>;
  canManage?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const {
    contractPppoe,
    unassigned,
    associateMutateAsync = vi.fn().mockResolvedValue({}),
    associatePending = false,
    credentials,
    canManage = true,
  } = opts;

  vi.mocked(usePlansModule.usePlans).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  } as ReturnType<typeof usePlansModule.usePlans>);

  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...contractPppoe,
  } as ReturnType<typeof usePppoeModule.useContractPppoe>);

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue({
    data: ORPHANS,
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...unassigned,
  } as ReturnType<typeof usePppoeModule.useUnassignedPppoe>);

  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue({
    mutateAsync: associateMutateAsync,
    isPending: associatePending,
  } as unknown as ReturnType<typeof usePppoeModule.useAssociatePppoe>);

  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...credentials,
  } as ReturnType<typeof usePppoeModule.usePppoeCredentials>);

  // Mutations del panel que no se ejercitan acá.
  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue(neutralMutation());
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue(neutralMutation());

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
      return perms.some((p) => (canManage ? true : p !== 'pppoe.manage'));
    }),
    isLoading: false,
    isError: false,
    permissions: canManage ? ['pppoe.manage'] : [],
    roles: [],
    user: null,
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  return { associateMutateAsync };
}

function renderPanel() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={NO_PPPOE_CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

/**
 * La sección "Asociar PPPoE existente" ahora es colapsable y arranca cerrada.
 * Estos tests ejercitan la adopción, así que primero hay que expandirla
 * (mirror de la nueva UX: el operador abre la sección antes de operar).
 */
async function expandAssociate(user: ReturnType<typeof userEvent.setup>) {
  const assocHeader = screen.getByRole('button', { name: /Asociar PPPoE existente/i });
  if (assocHeader.getAttribute('aria-expanded') === 'false') {
    await user.click(assocHeader);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Adopción ────────────────────────────────────────────────────────────────────
describe('AD-1: sección Asociar PPPoE existente', () => {
  it('se renderiza cuando no hay PPPoE activo y el usuario tiene pppoe.manage', () => {
    setup();
    renderPanel();
    expect(screen.getByText('Asociar PPPoE existente')).toBeInTheDocument();
    expect(screen.getByText('juan.perez')).toBeInTheDocument();
    expect(screen.getByText('maria.gomez')).toBeInTheDocument();
  });
});

describe('AD-2: loading', () => {
  it('muestra el estado de carga mientras la lista de huérfanos está cargando', () => {
    setup({ unassigned: { data: undefined, isLoading: true, isSuccess: false } as never });
    renderPanel();
    expect(screen.getByText(/Cargando PPPoE sin asignar/i)).toBeInTheDocument();
  });
});

describe('AD-3: empty', () => {
  it('muestra el hint del ingest cuando no hay huérfanos', () => {
    setup({ unassigned: { data: [], isLoading: false, isSuccess: true } as never });
    renderPanel();
    expect(screen.getByText(/No hay PPPoE sin asignar/i)).toBeInTheDocument();
    expect(screen.getByText(/corré el ingest del router/i)).toBeInTheDocument();
  });
});

describe('AD-4: filtro por usuario', () => {
  it('acota la lista por substring del username', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandAssociate(user);

    await user.type(screen.getByLabelText(/Buscar por usuario/i), 'juan');

    expect(screen.getByText('juan.perez')).toBeInTheDocument();
    expect(screen.queryByText('maria.gomez')).not.toBeInTheDocument();
  });

  it('muestra un mensaje cuando ningún huérfano coincide con el filtro', async () => {
    const user = userEvent.setup();
    setup();
    renderPanel();
    await expandAssociate(user);

    await user.type(screen.getByLabelText(/Buscar por usuario/i), 'zzz');

    expect(screen.getByText(/Ningún PPPoE coincide/i)).toBeInTheDocument();
  });
});

describe('AD-5: asociar — éxito', () => {
  it('click en Asociar dispara mutateAsync con el id del huérfano', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue({});
    setup({ associateMutateAsync: mutate });
    renderPanel();
    await expandAssociate(user);

    const row = screen.getByText('juan.perez').closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Asociar' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ id: 'orphan-1' });
    });
    // En el camino feliz no se muestra ningún error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AD-6: asociar — 409', () => {
  it('muestra el mensaje cuando el PPPoE ya está asociado a otro contrato', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } });
    const mutate = vi.fn().mockRejectedValue(err);
    setup({ associateMutateAsync: mutate });
    renderPanel();
    await expandAssociate(user);

    const row = screen.getByText('maria.gomez').closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Asociar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ya está asociado a otro contrato/i);
    });
  });
});

describe('AD-7: gating', () => {
  it('sin pppoe.manage no se renderiza la sección de adopción ni el form de crear', () => {
    setup({ canManage: false });
    renderPanel();
    expect(screen.queryByText('Asociar PPPoE existente')).not.toBeInTheDocument();
    expect(screen.queryByText('Cargar PPPoE')).not.toBeInTheDocument();
    expect(screen.getByText(/No tenés permiso para cargar uno/i)).toBeInTheDocument();
  });
});

// ── Revelar credenciales ─────────────────────────────────────────────────────────
describe('RV-1: el password NO se pide eager', () => {
  it('en el primer render usePppoeCredentials se llama con enabled=false', () => {
    setup({ contractPppoe: { data: [ACTIVE_PPPOE] } as never });
    renderPanel();

    // Hay PPPoE activo → se renderiza la fila de Contraseña con el reveal enmascarado.
    expect(screen.getByText('••••••••')).toBeInTheDocument();
    // El hook se invocó SIEMPRE con enabled=false (segundo arg) — nunca eager.
    const calls = vi.mocked(usePppoeModule.usePppoeCredentials).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call[1]).toBe(false);
    }
  });
});

describe('RV-2: click en el ojo revela el password', () => {
  it('al click pasa enabled=true y muestra el password resuelto', async () => {
    const user = userEvent.setup();
    setup({
      contractPppoe: { data: [ACTIVE_PPPOE] } as never,
      credentials: {
        data: { username: 'cliente.activo', password: 'S3cr3t-pass' },
        isSuccess: true, isLoading: false, isError: false,
      } as never,
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Mostrar contraseña/i }));

    // Tras el click, alguna invocación del hook llegó con enabled=true.
    await waitFor(() => {
      const calls = vi.mocked(usePppoeModule.usePppoeCredentials).mock.calls;
      expect(calls.some((c) => c[1] === true)).toBe(true);
    });
    expect(screen.getByText('S3cr3t-pass')).toBeInTheDocument();
  });
});

describe('RV-3: reveal gating', () => {
  it('sin pppoe.manage la fila de Contraseña no se renderiza', () => {
    setup({ contractPppoe: { data: [ACTIVE_PPPOE] } as never, canManage: false });
    renderPanel();
    expect(screen.queryByText('Contraseña')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mostrar contraseña/i })).not.toBeInTheDocument();
  });
});
