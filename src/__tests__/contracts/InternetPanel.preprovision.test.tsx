/**
 * InternetPanel — pre-provisión / auto-instalación (pppoe-preprovision-autoinstall, REQ-FE-2)
 *
 * S5.1: tipo de IP OBLIGATORIO sin preselección — submit bloqueado + hint accesible
 *       hasta elegir; elegir habilita.
 * S5.2: opción "Sin router — auto-instalación" (primera opción real del selector):
 *       oculta "IP remota", muestra hint, y el payload va SIN nasId ni remoteAddress
 *       pero CON ipTypePreference.
 * S5.3 (panel del cliente): PPPoE activo con nasId null → badge "Pendiente de
 *       instalación" + Router "—". Enforce de un pendiente (409 PPPOE_PENDING_INSTALL)
 *       → mensaje claro.
 * S5.4: flujo CON router sin regresión — wire test campo por campo del payload,
 *       ahora con ipTypePreference.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InternetPanel } from '@/pages/customers/tabs/contracts/InternetPanel';
import * as usePppoeModule from '@/hooks/usePppoe';
import * as useNasModule from '@/hooks/useNas';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import * as usePlansModule from '@/hooks/usePlans';
import type { PlanDto } from '@/types/plans';
import type { PppoeServiceDto } from '@/types/pppoe';

import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { makePppoeServiceDto, makeNasServer } from '@/__tests__/_utils/entityFactories';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('@/hooks/usePppoe');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/hooks/usePlans');
// Stub interactivo: cuando el modal de motivo está abierto, un botón confirma
// con un motivo fijo (necesario para ejercitar el flujo de enforce).
vi.mock(
  '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal',
  () => ({
    ServiceRemovalReasonModal: ({ open, onConfirm }: { open: boolean; onConfirm: (r: string) => void }) =>
      open ? (
        <button type="button" onClick={() => onConfirm('motivo test')}>
          confirmar-motivo
        </button>
      ) : null,
  }),
);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NAS_SERVERS = [
  makeNasServer({ id: 'nas-1', name: 'Router Central' }),
  makeNasServer({ id: 'nas-2', name: 'Router Norte', ipAddress: '192.168.1.2', nasIpAddress: '192.168.1.2' }),
];

const PLANS: PlanDto[] = [
  {
    id: 'plan-1',
    code: 'IP-5M',
    name: 'IP 5M',
    category: 'Alta',
    downloadKbps: 5000,
    uploadKbps: 1000,
    rateLimit: '5M/1M',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

const CONTRACT_SERVICES = [{ id: 'svc-1', name: 'INTERNET', status: 'inactive' }];

// ── Setup ─────────────────────────────────────────────────────────────────────
function setupMocks({
  contractPppoe = [] as PppoeServiceDto[],
  createMutateAsync = vi.fn().mockResolvedValue({}),
  enforceMutateAsync = vi.fn().mockResolvedValue({}),
  moveMutateAsync = vi.fn().mockResolvedValue({}),
} = {}) {
  vi.mocked(usePppoeModule.useContractPppoe).mockReturnValue(mockQuery({
    data: contractPppoe,
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));
  vi.mocked(usePppoeModule.useCreatePppoe).mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useCreatePppoe>);
  vi.mocked(usePppoeModule.useEnforcePppoeForContract).mockReturnValue({
    mutateAsync: enforceMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useEnforcePppoeForContract>);

  vi.mocked(usePppoeModule.useUnassignedPppoe).mockReturnValue(mockQuery({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));
  vi.mocked(usePppoeModule.useAssociatePppoe).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof usePppoeModule.useAssociatePppoe>);
  vi.mocked(usePppoeModule.usePppoeCredentials).mockReturnValue(mockQuery({
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
  }));
  vi.mocked(usePppoeModule.usePppoeCallerId).mockReturnValue(mockQuery({
    data: { callerId: null },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }));
  vi.mocked(usePppoeModule.useUpdatePppoe).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(usePppoeModule.useMovePppoe).mockReturnValue({ mutateAsync: moveMutateAsync, isPending: false } as never);
  vi.mocked(usePppoeModule.useDeactivatePppoe).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  vi.mocked(usePppoeModule.useDeassociatePppoe).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);

  vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: NAS_SERVERS }));
  vi.mocked(useNasModule.useNextFreeIp).mockReturnValue(mockQuery({
    data: undefined,
    isSuccess: false,
    isError: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }));

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
  } as unknown as ReturnType<typeof useMyPermissionsModule.useMyPermissions>);

  return { createMutateAsync, enforceMutateAsync, moveMutateAsync };
}

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <InternetPanel
        contractId="contract-1"
        clientId="client-42"
        contractServices={CONTRACT_SERVICES as never}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

/** El form vive en una sección colapsable que arranca cerrada. */
async function expandCreateForm(user: ReturnType<typeof userEvent.setup>) {
  const header = screen.getByRole('button', { name: /Cargar PPPoE/i });
  if (header.getAttribute('aria-expanded') === 'false') {
    await user.click(header);
  }
}

/** Llena usuario + contraseña + plan (los campos comunes a ambos flujos). */
async function fillBaseFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(document.getElementById('pppoe-username') as HTMLInputElement, 'juan.perez');
  await user.type(document.getElementById('pppoe-password') as HTMLInputElement, 'secret123');
  await user.selectOptions(document.getElementById('pppoe-profile') as HTMLSelectElement, 'IP-5M');
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── S5.1: tipo de IP obligatorio sin preselección ────────────────────────────
describe('S5.1: tipo de IP obligatorio sin preselección', () => {
  it('ninguno de los dos botones arranca activo', async () => {
    setupMocks();
    renderPanel();
    expect(screen.getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('con todo completo menos el tipo, el submit sigue deshabilitado y el hint accesible está visible', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    await fillBaseFields(user);
    await user.selectOptions(document.getElementById('pppoe-nas') as HTMLSelectElement, 'nas-1');

    expect(screen.getByRole('button', { name: /Crear PPPoE/i })).toBeDisabled();

    // Hint accesible: texto visible + linkeado al grupo por aria-describedby
    const hint = screen.getByText('Elegí el tipo de IP');
    expect(hint).toBeInTheDocument();
    const group = screen.getByRole('group', { name: /tipo de ip/i });
    expect(hint.id).toBeTruthy();
    expect(group).toHaveAttribute('aria-describedby', hint.id);
  });

  it('elegir un tipo habilita el submit y quita el hint', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    await fillBaseFields(user);
    await user.selectOptions(document.getElementById('pppoe-nas') as HTMLSelectElement, 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    expect(screen.getByRole('button', { name: /Crear PPPoE/i })).not.toBeDisabled();
    expect(screen.queryByText('Elegí el tipo de IP')).toBeNull();
  });

  // W5: un SR parado en el botón de submit deshabilitado tiene que saber por qué.
  it('W5: el hint accesible también describe el botón de submit; elegir el tipo lo quita', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    const submit = screen.getByRole('button', { name: /Crear PPPoE/i });
    const hint = screen.getByText('Elegí el tipo de IP');
    expect(hint.id).toBeTruthy();
    expect(submit).toHaveAttribute('aria-describedby', hint.id);

    await user.click(screen.getByRole('button', { name: 'Privada' }));
    expect(submit).not.toHaveAttribute('aria-describedby');
  });
});

// ── S5.2: sin router — auto-instalación ──────────────────────────────────────
describe('S5.2: opción "Sin router — auto-instalación"', () => {
  it('es la primera opción real del selector Router (después del placeholder)', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    expect(routerSelect.options[0].value).toBe('');
    expect(routerSelect.options[1].text).toMatch(/Sin router — auto-instalación/);
  });

  it('elegirla oculta el campo IP remota y muestra el hint de auto-instalación', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    const noRouterValue = routerSelect.options[1].value;
    await user.selectOptions(routerSelect, noRouterValue);

    expect(screen.queryByLabelText(/IP remota/i)).toBeNull();
    expect(
      screen.getByText(/El sistema asigna el NAS y la IP fija automáticamente cuando el cliente se conecta por primera vez/i),
    ).toBeInTheDocument();
  });

  it('el submit va SIN nasId ni remoteAddress, CON ipTypePreference', async () => {
    const user = userEvent.setup();
    const { createMutateAsync } = setupMocks();
    renderPanel();
    await expandCreateForm(user);

    await fillBaseFields(user);
    const routerSelect = document.getElementById('pppoe-nas') as HTMLSelectElement;
    await user.selectOptions(routerSelect, routerSelect.options[1].value);
    await user.click(screen.getByRole('button', { name: 'Privada' }));

    await user.click(screen.getByRole('button', { name: /Crear PPPoE/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const body = createMutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(body.username).toBe('juan.perez');
    expect(body.password).toBe('secret123');
    expect(body.profile).toBe('IP-5M');
    expect(body.ipTypePreference).toBe('cgnat');
    expect(body).not.toHaveProperty('nasId');
    expect(body).not.toHaveProperty('remoteAddress');
  });
});

// ── S5.4: flujo con router sin regresión ─────────────────────────────────────
describe('S5.4: flujo con router intacto + tipo obligatorio', () => {
  it('con router elegido, el campo IP remota sigue visible', async () => {
    const user = userEvent.setup();
    setupMocks();
    renderPanel();
    await expandCreateForm(user);

    await user.selectOptions(document.getElementById('pppoe-nas') as HTMLSelectElement, 'nas-1');
    expect(screen.getByLabelText(/IP remota/i)).toBeInTheDocument();
  });

  it('wire test campo por campo: el payload con router incluye nasId + ipTypePreference', async () => {
    const user = userEvent.setup();
    const { createMutateAsync } = setupMocks();
    renderPanel();
    await expandCreateForm(user);

    await fillBaseFields(user);
    await user.selectOptions(document.getElementById('pppoe-nas') as HTMLSelectElement, 'nas-1');
    await user.click(screen.getByRole('button', { name: 'Pública' }));

    await user.click(screen.getByRole('button', { name: /Crear PPPoE/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutateAsync).toHaveBeenCalledWith({
      username: 'juan.perez',
      password: 'secret123',
      nasId: 'nas-1',
      profile: 'IP-5M',
      remoteAddress: undefined,
      ipTypePreference: 'public',
    });
  });
});

// ── S5.3 (panel del cliente): badge del pendiente ────────────────────────────
describe('S5.3: badge "Pendiente de instalación" en el panel del cliente', () => {
  const pendingPppoe = makePppoeServiceDto({
    nasId: null,
    remoteAddress: null,
    status: 'enabled',
  });

  it('un PPPoE activo con nasId null muestra el badge y Router "—"', () => {
    setupMocks({ contractPppoe: [pendingPppoe] });
    renderPanel();

    expect(screen.getByText('Pendiente de instalación')).toBeInTheDocument();
    const routerDt = screen.getByText('Router');
    expect(routerDt.parentElement).toHaveTextContent('—');
  });

  it('un PPPoE activo CON nas no muestra el badge', () => {
    setupMocks({ contractPppoe: [makePppoeServiceDto()] });
    renderPanel();
    expect(screen.queryByText('Pendiente de instalación')).toBeNull();
  });

  it('enforce de un pendiente → 409 PPPOE_PENDING_INSTALL muestra mensaje claro', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('conflict'), {
      response: { status: 409, data: { code: 'PPPOE_PENDING_INSTALL' } },
    });
    setupMocks({
      contractPppoe: [pendingPppoe],
      enforceMutateAsync: vi.fn().mockRejectedValue(err),
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Cortar' }));
    await user.click(screen.getByRole('button', { name: 'confirmar-motivo' }));

    // El badge también dice "Pendiente de instalación" — el mensaje de error
    // se busca en el banner role="alert", no por texto suelto.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/pendiente de instalación/i);
    });
  });

  // W2: el BE persiste ipMode 'fixed' para la pre-provisión (design D3), pero
  // mientras nasId es null NO hay IP — el detalle muestra "—" limpio, sin el
  // artefacto "— fija".
  it('W2: el detalle IP remota de un pendiente muestra "—" limpio, sin el badge "fija"', () => {
    setupMocks({ contractPppoe: [pendingPppoe] });
    renderPanel();

    const dt = screen.getByText('IP remota');
    const dd = dt.parentElement?.querySelector('dd') as HTMLElement;
    expect(dd).not.toBeNull();
    expect(dd.textContent?.trim()).toBe('—');
    expect(within(dd).queryByText('fija')).toBeNull();
  });
});

// ── W3: adopción manual del pendiente desde Editar ───────────────────────────
describe('W3: adopción manual (pendiente → elegir router en Editar)', () => {
  const pendingPppoe = makePppoeServiceDto({
    nasId: null,
    remoteAddress: null,
    status: 'enabled',
  });

  async function editAndPickRouter(user: ReturnType<typeof userEvent.setup>, nasId: string) {
    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.selectOptions(document.getElementById('pppoe-edit-nas') as HTMLSelectElement, nasId);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));
  }

  it('elegir un router y guardar llama a move.mutateAsync con { id, nasId }', async () => {
    const user = userEvent.setup();
    const { moveMutateAsync } = setupMocks({ contractPppoe: [pendingPppoe] });
    renderPanel();

    await editAndPickRouter(user, 'nas-2');

    await waitFor(() => expect(moveMutateAsync).toHaveBeenCalledTimes(1));
    expect(moveMutateAsync).toHaveBeenCalledWith({ id: 'pppoe-1', nasId: 'nas-2' });
  });

  it('422 NO_FREE_IP del move → mensaje mapeado (pool lleno), NO el genérico', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('unprocessable'), {
      response: { status: 422, data: { code: 'NO_FREE_IP', error: 'no free ip' } },
    });
    setupMocks({ contractPppoe: [pendingPppoe], moveMutateAsync: vi.fn().mockRejectedValue(err) });
    renderPanel();

    await editAndPickRouter(user, 'nas-2');

    await waitFor(() => {
      expect(screen.getByText('El pool del NAS destino no tiene IPs libres.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/no se pudo guardar los cambios/i)).toBeNull();
  });

  it('404 NO_POOL_FOR_NAS_TYPE del move → mensaje mapeado (sin pool CGNAT)', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('not found'), {
      response: { status: 404, data: { code: 'NO_POOL_FOR_NAS_TYPE', error: 'no pool' } },
    });
    setupMocks({ contractPppoe: [pendingPppoe], moveMutateAsync: vi.fn().mockRejectedValue(err) });
    renderPanel();

    await editAndPickRouter(user, 'nas-2');

    await waitFor(() => {
      expect(screen.getByText('El NAS destino no tiene pool CGNAT configurado.')).toBeInTheDocument();
    });
    expect(screen.queryByText(/no se pudo guardar los cambios/i)).toBeNull();
  });
});
