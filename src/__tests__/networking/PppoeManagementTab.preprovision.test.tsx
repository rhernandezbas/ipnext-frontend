/**
 * PppoeManagementTab — pre-provisión / auto-instalación (pppoe-preprovision-autoinstall, REQ-FE-2)
 *
 * S5.3: fila con nasId null → columna NAS "—" + badge "Pendiente de instalación";
 *       filtro rápido "Pendientes" con round-trip en URL (param namespaced pppoe_pending).
 * S5.1 (modal crear): tipo de IP sin preselección; submit bloqueado + hint hasta elegir.
 * S5.2 (modal crear): "Sin router — auto-instalación" primera opción del selector NAS;
 *       elegirla oculta los campos de IP y el payload va SIN nasId, CON ipTypePreference.
 * S5.4 (modal crear): flujo con NAS sin regresión — wire test campo por campo.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { PppoeManagementTab } from '@/pages/networking/PppoeManagementTab';

import type { PppoeServiceListResult } from '@/types/internetService';
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
const pendingItem = makePppoeListItem({
  id: 'pppoe-pending',
  username: 'preprov01',
  clientId: 'client-9',
  customerName: 'Cliente Pendiente',
  contractId: 'contract-9',
  nasId: null,
  nasName: null,
  remoteAddress: null,
});

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
  return <div data-testid="location-search">{location.search}</div>;
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
describe('S5.3: filtro rápido "Pendientes" (round-trip URL)', () => {
  it('click en el chip filtra la lista a los pendientes y escribe pppoe_pending=1 en la URL', async () => {
    renderTab();

    const chip = screen.getByRole('button', { name: /pendientes/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-search')).toHaveTextContent('pppoe_pending=1');
    expect(screen.getByText('preprov01')).toBeInTheDocument();
    expect(screen.queryByText('cliente01')).toBeNull();
  });

  it('round-trip: entrar con ?pppoe_pending=1 restaura el filtro activo', () => {
    renderTab(['/?pppoe_pending=1']);

    expect(screen.getByRole('button', { name: /pendientes/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('preprov01')).toBeInTheDocument();
    expect(screen.queryByText('cliente01')).toBeNull();
  });

  it('apagar el chip saca el param de la URL y vuelve a mostrar todas las filas', async () => {
    renderTab(['/?pppoe_pending=1']);

    await userEvent.click(screen.getByRole('button', { name: /pendientes/i }));

    expect(screen.getByTestId('location-search')).not.toHaveTextContent('pppoe_pending');
    expect(screen.getByText('cliente01')).toBeInTheDocument();
    expect(screen.getByText('preprov01')).toBeInTheDocument();
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
