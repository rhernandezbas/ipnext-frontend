/**
 * PppoeManagementTab — pre-provisión / auto-instalación (pppoe-preprovision-autoinstall, REQ-FE-2)
 *
 * S5.3: fila con nasId null → columna NAS "—" + badge "Pendiente de instalación";
 *       filtro rápido "Pendientes" con round-trip en URL (param namespaced pppoe_pending).
 *       v2: el chip es SERVER-SIDE — pending=true viaja en el filtro del listado y
 *       del endpoint de ids (paginación y select-all correctos sobre TODOS los pendientes).
 * S5.1 (modal crear): tipo de IP sin preselección; submit bloqueado + hint hasta elegir.
 * S5.2 (modal crear): "Sin router — auto-instalación" primera opción del selector NAS;
 *       elegirla oculta los campos de IP y el payload va SIN nasId, CON ipTypePreference.
 * S5.4 (modal crear): flujo con NAS sin regresión — wire test campo por campo.
 */
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { PppoeManagementTab } from '@/pages/networking/PppoeManagementTab';

import type { PppoeServiceListResult } from '@/types/internetService';
import type { PppoeServiceDto } from '@/types/pppoe';
import type { PlanDto } from '@/types/plans';

import { makePppoeListItem, makeNasServer } from '@/__tests__/_utils/entityFactories';

// ── mock modules ──────────────────────────────────────────────────────────────
vi.mock('@/hooks/useInternetServices', () => ({
  useAllPppoe: vi.fn(),
}));
vi.mock('@/hooks/useNas', () => ({
  useNasServers: vi.fn(),
}));
vi.mock('@/hooks/usePlans', () => ({
  usePlans: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));
vi.mock('@/hooks/usePppoe', () => ({
  useCreatePppoeStandalone: vi.fn(),
  useRenamePppoe: vi.fn(),
  useUpdatePppoeGlobal: vi.fn(),
  useMovePppoeGlobal: vi.fn(),
  useDeactivatePppoeGlobal: vi.fn(),
  usePppoeCredentials: vi.fn(),
  useBulkChangePppoePlan: vi.fn(),
  useBulkChangePppoePlanBatch: vi.fn(),
  useListPppoeIds: vi.fn(),
  GLOBAL_LIST_KEY: ['pppoe', 'list'],
}));

import { useAllPppoe } from '@/hooks/useInternetServices';
import { useNasServers } from '@/hooks/useNas';
import { usePlans } from '@/hooks/usePlans';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import {
  useCreatePppoeStandalone,
  useRenamePppoe,
  useUpdatePppoeGlobal,
  useMovePppoeGlobal,
  useDeactivatePppoeGlobal,
  usePppoeCredentials,
  useBulkChangePppoePlan,
  useBulkChangePppoePlanBatch,
  useListPppoeIds,
} from '@/hooks/usePppoe';

// ── fixtures ──────────────────────────────────────────────────────────────────
const mockNasServers = [
  makeNasServer({ id: 'nas-1', name: 'NAS Central', type: 'radius_orchestrator' }),
];

const mockPlans: PlanDto[] = [
  {
    id: 'plan-1',
    code: 'IP-5M',
    name: 'IP 5M',
    category: 'Alta',
    downloadKbps: 5000,
    uploadKbps: 1000,
    rateLimit: '5M/1M',
    status: 'enabled',
    createdAt: '2026-01-01',
  },
];

const normalItem = makePppoeListItem();
// W2: fixture HONESTO — el BE persiste ipMode 'fixed' para la pre-provisión
// (design D3: la IP fija se asigna en la adopción). El render no debe mostrar
// el artefacto "— fija" mientras nasId es null.
const pendingItem = makePppoeListItem({
  id: 'pppoe-pending',
  username: 'preprov01',
  clientId: 'client-9',
  customerName: 'Cliente Pendiente',
  contractId: 'contract-9',
  nasId: null,
  nasName: null,
  remoteAddress: null,
  ipMode: 'fixed',
});

/** DTO devuelto por el move al adoptar manualmente el pendiente (S3/W3). */
const ADOPTED_DTO: PppoeServiceDto = {
  id: 'pppoe-pending',
  username: 'preprov01',
  profile: 'IP-5M',
  remoteAddress: '100.64.36.7',
  status: 'active',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'contract-9',
  createdAt: '2026-01-01T00:00:00.000Z',
  ipMode: 'fixed',
  ipTypePreference: 'cgnat',
};

const mockListResult: PppoeServiceListResult = {
  data: [normalItem, pendingItem],
  total: 2,
  page: 1,
  limit: 25,
};

// ── helpers ───────────────────────────────────────────────────────────────────
function makeMutationMock(mutateAsync = vi.fn().mockResolvedValue({})) {
  return { mutate: vi.fn(), mutateAsync, isPending: false, isError: false, isSuccess: false };
}

function makeQueryMock<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(), isSuccess: true };
}

function setup(canManage = true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    can: () => canManage,
    isLoading: false,
    isError: false,
    user: null as never,
    roles: [],
    permissions: [],
  });
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  vi.mocked(useNasServers).mockReturnValue(makeQueryMock(mockNasServers) as never);
  vi.mocked(usePlans).mockReturnValue(makeQueryMock(mockPlans) as never);
  vi.mocked(useAllPppoe).mockReturnValue(makeQueryMock(mockListResult) as never);
  vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useRenamePppoe).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useUpdatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useMovePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useDeactivatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(usePppoeCredentials).mockReturnValue(makeQueryMock(null) as never);
  vi.mocked(useBulkChangePppoePlan).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useListPppoeIds).mockReturnValue(
    makeMutationMock(vi.fn().mockResolvedValue({ ids: [], total: 0 })) as never,
  );
}

/** Espía del query string para verificar el round-trip del filtro en la URL. */
function LocationProbe() {
  const location = useLocation();
  // W6: 'REPLACE' tras el toggle = el chip no apila entradas en el historial.
  const navType = useNavigationType();
  return (
    <>
      <div data-testid="location-search">{location.search}</div>
      <div data-testid="nav-type">{navType}</div>
    </>
  );
}

function renderTab(initialEntries: string[] = ['/']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>
        <PppoeManagementTab />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ─────────────────────────────────────────────────────────────────────────────
// S5.3 — fila pendiente: NAS "—" + badge
// ─────────────────────────────────────────────────────────────────────────────
describe('S5.3: fila pendiente en el tab PPPoE', () => {
  it('la fila con nasId null muestra "—" y el badge "Pendiente de instalación" en la columna NAS', () => {
    renderTab();
    const row = screen.getByText('preprov01').closest('tr') as HTMLTableRowElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText('Pendiente de instalación')).toBeInTheDocument();
    // La celda NAS muestra el em dash (no el nasId crudo ni un crash)
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('la fila con NAS asignado NO muestra el badge', () => {
    renderTab();
    const row = screen.getByText('cliente01').closest('tr') as HTMLTableRowElement;
    expect(within(row).queryByText('Pendiente de instalación')).toBeNull();
    expect(within(row).getByText('NAS Central')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S5.3 — filtro rápido "Pendientes" con round-trip en URL
// ─────────────────────────────────────────────────────────────────────────────
// v2 (pending server-side): los asserts de filas ocultas/visibles del diseño
// client-side original se reemplazan por asserts de WIRE — el chip ahora manda
// pending=true en el filtro del hook y es el SERVER quien decide qué filas van.
describe('S5.3: filtro rápido "Pendientes" (server-side, round-trip URL)', () => {
  it('click en el chip manda pending=true al listado (page 1) y escribe pppoe_pending=1 en la URL', async () => {
    renderTab();

    const chip = screen.getByRole('button', { name: /pendientes/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(vi.mocked(useAllPppoe).mock.lastCall?.[0]?.pending).toBeUndefined();

    await userEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-search')).toHaveTextContent('pppoe_pending=1');
    expect(useAllPppoe).toHaveBeenLastCalledWith(
      expect.objectContaining({ pending: true, page: 1 }),
    );
  });

  it('round-trip: entrar con ?pppoe_pending=1 restaura el chip y el request ya viaja con pending=true', () => {
    renderTab(['/?pppoe_pending=1']);

    expect(screen.getByRole('button', { name: /pendientes/i })).toHaveAttribute('aria-pressed', 'true');
    expect(useAllPppoe).toHaveBeenLastCalledWith(expect.objectContaining({ pending: true }));
  });

  it('apagar el chip saca el param de la URL y el request vuelve a ir SIN pending', async () => {
    renderTab(['/?pppoe_pending=1']);

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    expect(screen.getByTestId('location-search')).not.toHaveTextContent('pppoe_pending');
    expect(vi.mocked(useAllPppoe).mock.lastCall?.[0]?.pending).toBeUndefined();
  });

  it('togglear el chip resetea a la página 1 (mismo flujo de cambio de filtro que NAS/estado)', async () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: [normalItem], total: 60, page: 1, limit: 25 } as PppoeServiceListResult) as never,
    );
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(useAllPppoe).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));
    expect(useAllPppoe).toHaveBeenLastCalledWith(
      expect.objectContaining({ pending: true, page: 1 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal Crear PPPoE — S5.1 / S5.2 / S5.4
// ─────────────────────────────────────────────────────────────────────────────
async function openCreateModal() {
  await userEvent.click(screen.getByRole('button', { name: /crear pppoe/i }));
  return screen.getByRole('dialog');
}

describe('S5.1 (modal crear): tipo de IP obligatorio sin preselección', () => {
  it('ninguno de los dos botones arranca activo y el submit está deshabilitado con hint', async () => {
    renderTab();
    const dialog = await openCreateModal();

    expect(within(dialog).getByRole('button', { name: 'Privada' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(dialog).getByRole('button', { name: 'Pública' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'nuevo01');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass123');

    expect(within(dialog).getByRole('button', { name: /^crear$/i })).toBeDisabled();
    expect(within(dialog).getByText('Elegí el tipo de IP')).toBeInTheDocument();
  });

  it('elegir un tipo habilita el submit y quita el hint', async () => {
    renderTab();
    const dialog = await openCreateModal();

    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'nuevo01');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Privada' }));

    expect(within(dialog).getByRole('button', { name: /^crear$/i })).not.toBeDisabled();
    expect(within(dialog).queryByText('Elegí el tipo de IP')).toBeNull();
  });
});

describe('S5.2 (modal crear): "Sin router — auto-instalación"', () => {
  it('es la PRIMERA opción del selector NAS, sin romper la preselección del flujo con router', async () => {
    renderTab();
    const dialog = await openCreateModal();

    const nasSelect = within(dialog).getByLabelText(/nas/i) as HTMLSelectElement;
    expect(nasSelect.options[0].text).toMatch(/Sin router — auto-instalación/);
    // S5.4: sin regresión — el flujo con router sigue preseleccionando el primer NAS real
    expect(nasSelect.value).toBe('nas-1');
  });

  it('elegirla oculta los campos de IP y muestra el hint de auto-instalación', async () => {
    renderTab();
    const dialog = await openCreateModal();

    const nasSelect = within(dialog).getByLabelText(/nas/i) as HTMLSelectElement;
    await userEvent.selectOptions(nasSelect, nasSelect.options[0].value);

    expect(within(dialog).queryByLabelText(/modo ip/i)).toBeNull();
    expect(within(dialog).queryByLabelText(/ip fija/i)).toBeNull();
    expect(
      within(dialog).getByText(/El sistema asigna el NAS y la IP fija automáticamente cuando el cliente se conecta por primera vez/i),
    ).toBeInTheDocument();
  });

  it('submit sin router: payload SIN nasId/ipMode/framedIp, CON ipTypePreference', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock(mutateAsync) as never);
    renderTab();
    const dialog = await openCreateModal();

    const nasSelect = within(dialog).getByLabelText(/nas/i) as HTMLSelectElement;
    await userEvent.selectOptions(nasSelect, nasSelect.options[0].value);
    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'preprov02');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass456');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Privada' }));

    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(body.username).toBe('preprov02');
    expect(body.password).toBe('pass456');
    expect(body.plan).toBe('IP-5M');
    expect(body.ipTypePreference).toBe('cgnat');
    expect(body).not.toHaveProperty('nasId');
    expect(body).not.toHaveProperty('ipMode');
    expect(body).not.toHaveProperty('framedIp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C1 — el chip "Pendientes" debe respetar el invariante anti-TOCTOU de la
// selección: mismo patrón que handleSearch/handleNas/handleStatus (limpiar
// `selected` + avanzar la generación). v2: como el chip ahora es server-side
// (pending=true en listado + ids), el select-all YA NO se oculta con chip ON —
// congela exactamente el universo de pendientes que el BE resuelve.
// ─────────────────────────────────────────────────────────────────────────────
describe('C1: chip "Pendientes" y el invariante anti-TOCTOU de la selección', () => {
  it('(a) seleccionar la página y togglear el chip deja la selección VACÍA', async () => {
    renderTab();

    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i }));
    expect(screen.getByText(/2 seleccionados/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    // El bulk ya no puede operar sobre filas ocultas: la selección se limpió.
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });

  // ACTUALIZADO (chip server-side): antes el botón se OCULTABA con chip ON porque
  // el endpoint de ids ignoraba pendingOnly (habría congelado no-pendientes
  // invisibles). Ahora el BE honra pending=true (D6.7) → el botón queda visible.
  it('(b) con el chip ON el botón "Seleccionar los N del filtro" SIGUE visible; apagarlo (con el NAS ya limpiado por el chip) lo saca por falta de filtro', async () => {
    renderTab();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    expect(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));
    expect(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeInTheDocument();

    // Apagar el chip: activarlo LIMPIÓ el filtro de NAS (ver W4 v2), así que ya
    // no queda ningún filtro de narrowing → el botón desaparece (guard del BE).
    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));
    expect(screen.queryByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeNull();
  });

  it('(c) togglear el chip avanza la generación: un fetch viejo en vuelo NO repuebla la selección al resolver', async () => {
    let resolveIds!: (v: { ids: string[]; total: number }) => void;
    const mutateAsync = vi.fn().mockImplementation(
      () => new Promise<{ ids: string[]; total: number }>(resolve => { resolveIds = resolve; }),
    );
    vi.mocked(useListPppoeIds).mockReturnValue({
      mutateAsync,
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as never);
    renderTab();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    await userEvent.click(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    // Toggle del chip MIENTRAS el fetch está en vuelo.
    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    // Resuelve el fetch VIEJO (ids del universo sin pendingOnly).
    resolveIds({ ids: ['old-1', 'old-2', 'old-3'], total: 3 });
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    // Anti-TOCTOU: la selección NO se repuebla con ids de un subconjunto que ya no se ve.
    expect(screen.queryByText(/seleccionado/i)).toBeNull();
  });

  // ACTUALIZADO (chip server-side): antes el contador era per-página ("N pendientes
  // en esta página") porque el total del server MENTÍA (incluía no-pendientes).
  // Con pending=true el total del server ES el total de pendientes → se muestra.
  it('(d) con el chip ON el contador muestra el TOTAL del server (ahora honesto)', async () => {
    renderTab();
    expect(screen.getByText('2 servicios')).toBeInTheDocument();

    // El server resuelve el filtro: con pending=true devuelve SOLO pendientes.
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: [pendingItem], total: 1, page: 1, limit: 25 } as PppoeServiceListResult) as never,
    );
    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    expect(screen.getByText('1 pendiente')).toBeInTheDocument();
    expect(screen.queryByText('2 servicios')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v2 — select-all y bulk con el chip "Pendientes" server-side: el fetch de ids
// viaja con pending=true (el BE lo cuenta como filtro de narrowing, D6.7) y la
// selección congela EXACTAMENTE el universo de pendientes. El bulk "Cambiar
// plan" queda deshabilitado con chip ON: los pendientes fallan ese bulk per-item
// (PPPOE_PENDING_INSTALL) — no se invita un bulk 100% fallido.
// ─────────────────────────────────────────────────────────────────────────────
describe('v2: select-all y bulk con el chip "Pendientes" (pending server-side)', () => {
  it('con el chip ON como ÚNICO filtro el botón aparece; el fetch de ids viaja con pending=true (wire campo por campo) y congela los ids del server', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ids: ['pppoe-pending', 'pppoe-pending-2'], total: 2 });
    vi.mocked(useListPppoeIds).mockReturnValue(makeMutationMock(mutateAsync) as never);
    renderTab();

    // Sin ningún filtro el botón NO está (guard FILTER_REQUIRED del BE).
    expect(screen.queryByRole('button', { name: /seleccionar los \d+ del filtro/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    // D6.7: pending cuenta como narrowing → el botón aparece con el chip solo.
    await userEvent.click(screen.getByRole('button', { name: /seleccionar los \d+ del filtro/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      includeUnassigned: true,
      search: undefined,
      nasId: undefined,
      status: undefined,
      pending: true,
    });
    expect(await screen.findByText(/2 seleccionados/i)).toBeInTheDocument();
  });

  it('con el chip ON el bulk "Cambiar plan" queda deshabilitado con title honesto; chip OFF → habilitado', async () => {
    renderTab();

    // Chip OFF: seleccionar la página habilita el bulk como siempre.
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i }));
    expect(screen.getByRole('button', { name: /cambiar plan/i })).not.toBeDisabled();

    // Chip ON: la selección se limpió (C1a) — rearmarla y verificar el disable.
    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar todos de esta página/i }));
    const bulkBtn = screen.getByRole('button', { name: /cambiar plan/i });
    expect(bulkBtn).toBeDisabled();
    expect(bulkBtn).toHaveAttribute('title', 'Los pendientes de instalación no admiten cambio de plan');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W2 — la fila pendiente no muestra el artefacto "— fija" (el BE persiste
// ipMode 'fixed' pero la IP recién existe cuando la adopción asigna el NAS).
// ─────────────────────────────────────────────────────────────────────────────
describe('W2: fila pendiente sin el artefacto "— fija"', () => {
  it('la celda IP del pendiente (ipMode fixed del BE) muestra "—" limpio, SIN badge "fija"', () => {
    renderTab();
    const row = screen.getByText('preprov01').closest('tr') as HTMLTableRowElement;
    expect(within(row).queryByText('fija')).toBeNull();
  });

  it('una fila CON router e ipMode fixed sigue mostrando el badge "fija"', () => {
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({
        data: [makePppoeListItem({ id: 'pppoe-fixed', username: 'confija01', ipMode: 'fixed' })],
        total: 1,
        page: 1,
        limit: 25,
      } as PppoeServiceListResult) as never,
    );
    renderTab();
    const row = screen.getByText('confija01').closest('tr') as HTMLTableRowElement;
    expect(within(row).getByText('fija')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W4 v2 — chip "Pendientes" vs filtro de NAS. Activar el chip con NAS filtrado
// LIMPIA el filtro de NAS (decisión UX: pendiente = sin NAS, mandar ambos params
// sería un AND contradictorio con vacío GARANTIZADO — más honesto limpiar).
// El combo inverso (elegir NAS con el chip YA activo) sí viaja al BE, que
// devuelve vacío → empty state con el copy específico.
// ─────────────────────────────────────────────────────────────────────────────
describe('W4 v2: chip "Pendientes" vs filtro de NAS', () => {
  it('activar el chip con NAS filtrado LIMPIA el filtro de NAS (no viaja el AND contradictorio)', async () => {
    renderTab();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');
    expect(useAllPppoe).toHaveBeenLastCalledWith(expect.objectContaining({ nasId: 'nas-1' }));

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    // El select vuelve a "Todos los NAS" y el request va con pending SIN nasId.
    expect(
      (screen.getByRole('combobox', { name: /filtrar por nas/i }) as HTMLSelectElement).value,
    ).toBe('');
    const lastFilter = vi.mocked(useAllPppoe).mock.lastCall?.[0];
    expect(lastFilter?.pending).toBe(true);
    expect(lastFilter?.nasId).toBeUndefined();
  });

  it('elegir un NAS con el chip YA activo → vacío del server con el copy específico', async () => {
    // El BE resuelve pending=true AND nasId → vacío garantizado (los pendientes
    // no tienen NAS por definición).
    vi.mocked(useAllPppoe).mockReturnValue(
      makeQueryMock({ data: [], total: 0, page: 1, limit: 25 } as PppoeServiceListResult) as never,
    );
    renderTab();

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));
    // Chip ON sin NAS y cero resultados: copy de pendientes (ya no existe el
    // "cambiá de página" del diseño client-side — la paginación es server-side).
    expect(screen.getByText('No hay PPPoE pendientes de instalación.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /filtrar por nas/i }), 'nas-1');

    expect(screen.getByText(/los pendientes no tienen router asignado/i)).toBeInTheDocument();
    expect(screen.getByText(/quitá el filtro de router para verlos/i)).toBeInTheDocument();
    expect(screen.queryByText(/cambiá de página/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W6 — round-trip URL del chip: params ajenos sobreviven al toggle y la
// navegación es replace (no ensucia el historial).
// ─────────────────────────────────────────────────────────────────────────────
describe('W6: round-trip URL del chip "Pendientes"', () => {
  it('entrar con ?foo=bar&pppoe_pending=1 activa el chip; el toggle off preserva foo y navega con replace', async () => {
    renderTab(['/?foo=bar&pppoe_pending=1']);

    const chip = screen.getByRole('button', { name: /pendientes/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(chip);

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('foo=bar');
    expect(search).not.toContain('pppoe_pending');
    // replace:true — lo observable: el tipo de navegación es REPLACE, no PUSH.
    expect(screen.getByTestId('nav-type')).toHaveTextContent('REPLACE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S3 — copy honesto para pendientes: el move no promete desconectar una sesión
// que no existe; la baja no habla "del router" (nunca se instaló en uno).
// ─────────────────────────────────────────────────────────────────────────────
describe('S3: copy del move/baja para pendientes', () => {
  async function openPendingMoveModal() {
    const row = screen.getByText('preprov01').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Acciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /mover nas/i }));
    return screen.getByRole('dialog');
  }

  it('el modal Mover NAS de un pendiente NO dice "se desconectará la sesión" — usa la variante de asignación', async () => {
    renderTab();
    const dialog = await openPendingMoveModal();

    expect(
      within(dialog).getByText(/se asignará al router elegido con ip fija de su pool/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/se desconectará la sesión/i)).toBeNull();
  });

  it('W3(c): submit de la adopción manual → mutateAsync {id, nasId}; el resultado tampoco habla de sesión desconectada', async () => {
    const moveMutateAsync = vi.fn().mockResolvedValue(ADOPTED_DTO);
    vi.mocked(useMovePppoeGlobal).mockReturnValue(makeMutationMock(moveMutateAsync) as never);
    renderTab();
    const dialog = await openPendingMoveModal();

    await userEvent.selectOptions(within(dialog).getByLabelText(/nas destino/i), 'nas-1');
    await userEvent.click(within(dialog).getByRole('button', { name: /^mover$/i }));

    await waitFor(() => expect(moveMutateAsync).toHaveBeenCalledTimes(1));
    expect(moveMutateAsync.mock.calls[0][0]).toMatchObject({ id: 'pppoe-pending', nasId: 'nas-1' });

    await waitFor(() =>
      expect(within(dialog).getByRole('status')).toHaveTextContent(/100\.64\.36\.7/),
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent(/ip fija asignada/i);
    expect(within(dialog).queryByText(/la sesión fue desconectada/i)).toBeNull();
  });

  it('la Baja de un pendiente no dice "del router"; la de un item con router sí', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false); // solo inspeccionamos el copy
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    renderTab();

    const pendingRow = screen.getByText('preprov01').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(pendingRow).getByRole('button', { name: 'Acciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^baja$/i }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    const pendingMsg = (confirmFn.mock.calls[0][0] as { message: string }).message;
    expect(pendingMsg).toMatch(/dar de baja "preprov01"/i);
    expect(pendingMsg).not.toMatch(/del router/i);

    const normalRow = screen.getByText('cliente01').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(normalRow).getByRole('button', { name: 'Acciones' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^baja$/i }));
    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(2));
    const normalMsg = (confirmFn.mock.calls[1][0] as { message: string }).message;
    expect(normalMsg).toMatch(/se eliminará del router/i);
  });
});

describe('S5.4 (modal crear): flujo con NAS sin regresión + wire exacto', () => {
  it('wire test campo por campo: el payload con router incluye nasId + ipTypePreference', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock(mutateAsync) as never);
    renderTab();
    const dialog = await openCreateModal();

    await userEvent.selectOptions(within(dialog).getByLabelText(/nas/i), 'nas-1');
    await userEvent.selectOptions(within(dialog).getByLabelText(/plan/i), 'IP-5M');
    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'nuevo01');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Pública' }));

    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      username: 'nuevo01',
      password: 'pass123',
      nasId: 'nas-1',
      plan: 'IP-5M',
      ipMode: 'pool',
      ipTypePreference: 'public',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W1 — cruzar router↔"Sin router" limpia ipMode/framedIp: una IP fija tipeada
// para el pool de NAS-1 no puede viajar en el submit hacia NAS-2.
// ─────────────────────────────────────────────────────────────────────────────
describe('W1 (modal crear): cruce router↔"Sin router" limpia modo IP e IP fija', () => {
  it('NAS-1 + fija + IP → "Sin router" → NAS-2: el modo vuelve a pool y la IP vieja NO se envía', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock(mutateAsync) as never);
    vi.mocked(useNasServers).mockReturnValue(
      makeQueryMock([
        ...mockNasServers,
        makeNasServer({ id: 'nas-2', name: 'NAS Norte', type: 'radius_orchestrator' }),
      ]) as never,
    );
    renderTab();
    const dialog = await openCreateModal();

    // NAS-1 (preseleccionado) + Modo IP fija + IP tipeada del pool de NAS-1.
    await userEvent.selectOptions(within(dialog).getByLabelText(/modo ip/i), 'fixed');
    await userEvent.type(within(dialog).getByLabelText(/^ip fija$/i), '100.64.13.9');

    // Cruce: entrar al sentinel y salir hacia un router DISTINTO.
    const nasSelect = within(dialog).getByLabelText(/nas/i) as HTMLSelectElement;
    await userEvent.selectOptions(nasSelect, nasSelect.options[0].value); // Sin router
    await userEvent.selectOptions(nasSelect, 'nas-2');

    // El modo volvió a pool y el campo IP fija no reaparece con el valor viejo.
    expect((within(dialog).getByLabelText(/modo ip/i) as HTMLSelectElement).value).toBe('pool');
    expect(within(dialog).queryByLabelText(/^ip fija$/i)).toBeNull();

    await userEvent.type(within(dialog).getByLabelText(/usuario/i), 'nuevo03');
    await userEvent.type(within(dialog).getByLabelText(/contraseña/i), 'pass789');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Privada' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const body = mutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(body.nasId).toBe('nas-2');
    expect(body.ipMode).toBe('pool');
    expect(body).not.toHaveProperty('framedIp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W5 — el hint "Elegí el tipo de IP" también describe el botón de submit
// deshabilitado (un SR parado en el botón sabe por qué no puede enviar).
// ─────────────────────────────────────────────────────────────────────────────
describe('W5 (modal crear): hint accesible en el botón de submit', () => {
  it('sin tipo elegido, el submit lleva aria-describedby → hint; al elegir, se quita', async () => {
    renderTab();
    const dialog = await openCreateModal();

    const submit = within(dialog).getByRole('button', { name: /^crear$/i });
    const hint = within(dialog).getByText('Elegí el tipo de IP');
    expect(hint.id).toBeTruthy();
    expect(submit).toHaveAttribute('aria-describedby', hint.id);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Privada' }));
    expect(submit).not.toHaveAttribute('aria-describedby');
  });
});
