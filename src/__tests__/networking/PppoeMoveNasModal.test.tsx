/**
 * Tests — pppoe-move-nas Wave 1 FE: modal "Mover NAS" honesto (REQ-FE-1).
 *
 * S9.1 — aviso de IP nueva + desconexión antes de confirmar.
 * S9.2 — tras el move OK se muestra la IP nueva (del DTO de respuesta).
 * S9.3 — flujo force en 2 pasos: 409 PPPOE_MOVE_PUBLIC_IP → warning fuerte →
 *        confirmación explícita → reintento con force: true.
 * Errores tipados del wire contract (NO_FREE_IP, NO_POOL_FOR_NAS_TYPE,
 * ORCHESTRATOR_REJECTED, 502) → mensaje claro, nunca spinner infinito.
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { PppoeManagementTab } from '@/pages/networking/PppoeManagementTab';

import type { PppoeServiceListResult, PppoeServiceListItem } from '@/types/internetService';
import type { PppoeServiceDto } from '@/types/pppoe';
import type { NasServer } from '@/types/nas';

// ── mock modules (data hooks; permisos/confirm vienen del setup global) ───────
vi.mock('@/hooks/useInternetServices', () => ({
  useAllPppoe: vi.fn(),
}));
vi.mock('@/hooks/useNas', () => ({
  useNasServers: vi.fn(),
}));
vi.mock('@/hooks/usePlans', () => ({
  usePlans: vi.fn(),
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
const NAS_A: NasServer = {
  id: 'nas-1',
  name: 'NAS Central',
  type: 'radius_orchestrator',
  ipAddress: '10.0.0.1',
  nasIpAddress: '10.0.0.1',
  radiusSecret: 'secret',
  apiPort: null,
  apiLogin: null,
  apiPassword: null,
  status: 'active',
  lastSeen: null,
  clientCount: 10,
  description: '',
};

const NAS_B: NasServer = { ...NAS_A, id: 'nas-2', name: 'NAS Norte' };

const ITEM: PppoeServiceListItem = {
  id: 'pppoe-1',
  username: 'cliente01',
  clientId: 'client-1',
  customerName: 'Juan Pérez',
  status: 'active',
  profile: 'IP-5M',
  nasId: 'nas-1',
  nasName: 'NAS Central',
  nasType: 'radius_orchestrator',
  contractId: 'contract-1',
  remoteAddress: '100.64.60.25',
  ipMode: 'fixed',
  enforcedState: 'active',
  createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
};

const LIST: PppoeServiceListResult = { data: [ITEM], total: 1, page: 1, limit: 25 };

const MOVED_DTO: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'cliente01',
  profile: 'IP-5M',
  remoteAddress: '100.64.43.7',
  status: 'active',
  enforcedState: 'active',
  nasId: 'nas-2',
  contractId: 'contract-1',
  createdAt: '2026-01-01T00:00:00Z',
  ipMode: 'fixed',
};

// ── helpers ───────────────────────────────────────────────────────────────────
function makeMutationMock(mutateAsync = vi.fn().mockResolvedValue(MOVED_DTO)) {
  return { mutate: vi.fn(), mutateAsync, isPending: false, isError: false, isSuccess: false };
}

function makeQueryMock<T>(data: T) {
  return { data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(), isSuccess: true };
}

/** Error estilo axios con el body { code, error } del wire contract. */
function httpError(status: number, body: { code?: string; error?: string } = {}) {
  const err = new Error(body.error ?? `Request failed with status code ${status}`) as Error & {
    response?: { status: number; data: { code?: string; error?: string } };
  };
  err.response = { status, data: body };
  return err;
}

function setup(moveMutateAsync = vi.fn().mockResolvedValue(MOVED_DTO)) {
  vi.mocked(useNasServers).mockReturnValue(makeQueryMock([NAS_A, NAS_B]) as never);
  vi.mocked(usePlans).mockReturnValue(makeQueryMock([]) as never);
  vi.mocked(useAllPppoe).mockReturnValue(makeQueryMock(LIST) as never);
  vi.mocked(useCreatePppoeStandalone).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useRenamePppoe).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useUpdatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useMovePppoeGlobal).mockReturnValue(makeMutationMock(moveMutateAsync) as never);
  vi.mocked(useDeactivatePppoeGlobal).mockReturnValue(makeMutationMock() as never);
  vi.mocked(usePppoeCredentials).mockReturnValue(makeQueryMock(null) as never);
  vi.mocked(useBulkChangePppoePlan).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useBulkChangePppoePlanBatch).mockReturnValue(makeMutationMock() as never);
  vi.mocked(useListPppoeIds).mockReturnValue(
    makeMutationMock(vi.fn().mockResolvedValue({ ids: [], total: 0 })) as never,
  );
  return moveMutateAsync;
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PppoeManagementTab />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function openMoveModal() {
  renderTab();
  await userEvent.click(screen.getAllByRole('button', { name: 'Acciones' })[0]);
  await userEvent.click(screen.getByRole('menuitem', { name: /mover nas/i }));
  return screen.getByRole('dialog');
}

async function selectDestinoYMover(dialog: HTMLElement) {
  await userEvent.selectOptions(within(dialog).getByLabelText(/nas destino/i), 'nas-2');
  await userEvent.click(within(dialog).getByRole('button', { name: /^mover$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ─────────────────────────────────────────────────────────────────────────────
// S9.1 — aviso IP nueva + desconexión
// ─────────────────────────────────────────────────────────────────────────────
describe('MoveNasModal — S9.1 aviso honesto', () => {
  it('muestra el aviso de IP nueva + desconexión al abrir el modal', async () => {
    const dialog = await openMoveModal();
    expect(within(dialog).getByText(/se asignará una ip nueva del pool del nas destino/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/se desconectará la sesión/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wire contract del POST — primer intento SIN force
// ─────────────────────────────────────────────────────────────────────────────
describe('MoveNasModal — primer intento sin force', () => {
  it('llama a mutateAsync con id + nasId y SIN force en el primer intento', async () => {
    const mutateAsync = setup();
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const args = mutateAsync.mock.calls[0][0];
    expect(args).toMatchObject({ id: 'pppoe-1', nasId: 'nas-2' });
    expect(args.force).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S9.2 — resultado del move: IP nueva visible, sin auto-cierre
// ─────────────────────────────────────────────────────────────────────────────
describe('MoveNasModal — S9.2 muestra la IP nueva', () => {
  it('tras el move OK muestra la IP nueva del DTO de respuesta', async () => {
    setup(vi.fn().mockResolvedValue(MOVED_DTO));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByText(/100\.64\.43\.7/)).toBeInTheDocument();
    });
    // El modal NO se cierra solo: el operador ve la IP nueva y cierra.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('el botón Cerrar del estado de éxito cierra el modal', async () => {
    setup(vi.fn().mockResolvedValue(MOVED_DTO));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => expect(within(dialog).getByText(/100\.64\.43\.7/)).toBeInTheDocument());
    await userEvent.click(within(dialog).getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S9.3 — flujo force en 2 pasos (IP pública)
// ─────────────────────────────────────────────────────────────────────────────
describe('MoveNasModal — S9.3 flujo force IP pública', () => {
  it('409 PPPOE_MOVE_PUBLIC_IP muestra el warning fuerte SIN reintentar solo', async () => {
    const mutateAsync = setup(
      vi.fn().mockRejectedValue(httpError(409, { code: 'PPPOE_MOVE_PUBLIC_IP', error: 'IP pública fija' })),
    );
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    // Copy HONESTO: el guard del BE es fail-closed — salta para toda IP no
    // clasificada positivamente como CGNAT (pública O de un pool sin cargar).
    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        /ip pública fija o no clasificada como cgnat/i,
      );
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/si era pública, se libera/i);
    // Confirmación explícita disponible, pero NO ejecutada automáticamente.
    expect(within(dialog).getByRole('button', { name: /mover igual/i })).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('la confirmación explícita reintenta con force: true y muestra la IP nueva', async () => {
    const mutateAsync = vi
      .fn()
      .mockRejectedValueOnce(httpError(409, { code: 'PPPOE_MOVE_PUBLIC_IP', error: 'IP pública fija' }))
      .mockResolvedValueOnce(MOVED_DTO);
    setup(mutateAsync);
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => expect(within(dialog).getByRole('button', { name: /mover igual/i })).toBeInTheDocument());
    await userEvent.click(within(dialog).getByRole('button', { name: /mover igual/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ id: 'pppoe-1', nasId: 'nas-2', force: true });
    await waitFor(() => expect(within(dialog).getByText(/100\.64\.43\.7/)).toBeInTheDocument());
  });

  it('cambiar el NAS destino tras el warning lo descarta (vuelve al paso 1)', async () => {
    const mutateAsync = setup(
      vi.fn().mockRejectedValue(httpError(409, { code: 'PPPOE_MOVE_PUBLIC_IP', error: 'IP pública fija' })),
    );
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);
    await waitFor(() => expect(within(dialog).getByText(/si era pública, se libera/i)).toBeInTheDocument());

    await userEvent.selectOptions(within(dialog).getByLabelText(/nas destino/i), '');
    expect(within(dialog).queryByText(/si era pública, se libera/i)).toBeNull();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('con el warning force visible, el submit del form (Enter) NO dispara POSTs nuevos', async () => {
    const mutateAsync = setup(
      vi.fn().mockRejectedValue(httpError(409, { code: 'PPPOE_MOVE_PUBLIC_IP', error: 'IP pública fija' })),
    );
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /mover igual/i })).toBeInTheDocument(),
    );
    expect(mutateAsync).toHaveBeenCalledTimes(1);

    // Enter en el select dispara el submit del form. Con el warning visible el
    // único camino válido es "Sí, mover igual" (force) o Cancelar: CERO POSTs.
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    // El warning sigue visible: no se descartó ni se reintentó nada.
    expect(within(dialog).getByRole('button', { name: /mover igual/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Errores tipados del wire contract
// ─────────────────────────────────────────────────────────────────────────────
describe('MoveNasModal — errores tipados', () => {
  it('422 NO_FREE_IP → "El pool del NAS destino no tiene IPs libres"', async () => {
    setup(vi.fn().mockRejectedValue(httpError(422, { code: 'NO_FREE_IP', error: 'no free ip' })));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/el pool del nas destino no tiene ips libres/i);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('404 NO_POOL_FOR_NAS_TYPE → "El NAS destino no tiene pool CGNAT configurado"', async () => {
    setup(vi.fn().mockRejectedValue(httpError(404, { code: 'NO_POOL_FOR_NAS_TYPE', error: 'no pool' })));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/el nas destino no tiene pool cgnat configurado/i);
    });
  });

  it('409 ORCHESTRATOR_REJECTED → muestra el mensaje del error del BE', async () => {
    setup(vi.fn().mockRejectedValue(
      httpError(409, { code: 'ORCHESTRATOR_REJECTED', error: 'El RADIUS rechazó la IP elegida' }),
    ));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/el radius rechazó la ip elegida/i);
    });
  });

  it('409 PPPOE_TERMINATED → muestra el mensaje del error del BE', async () => {
    setup(vi.fn().mockRejectedValue(
      httpError(409, { code: 'PPPOE_TERMINATED', error: 'El servicio está dado de baja' }),
    ));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/el servicio está dado de baja/i);
    });
  });

  it('404 PPPOE_NOT_FOUND → mensaje propio en español (no el crudo del BE)', async () => {
    setup(vi.fn().mockRejectedValue(httpError(404, { code: 'PPPOE_NOT_FOUND', error: 'PppoeService not found' })));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        /el servicio pppoe ya no existe \(¿fue dado de baja\?\)/i,
      );
    });
    expect(within(dialog).getByRole('alert')).not.toHaveTextContent(/not found/i);
  });

  it('404 NAS_NOT_FOUND → "El NAS destino ya no existe."', async () => {
    setup(vi.fn().mockRejectedValue(httpError(404, { code: 'NAS_NOT_FOUND', error: 'Nas not found' })));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/el nas destino ya no existe/i);
    });
    expect(within(dialog).getByRole('alert')).not.toHaveTextContent(/not found/i);
  });

  it('502 → "No se pudo contactar el RADIUS. Reintentá."', async () => {
    setup(vi.fn().mockRejectedValue(httpError(502, { error: 'Bad Gateway' })));
    const dialog = await openMoveModal();
    await selectDestinoYMover(dialog);

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/no se pudo contactar el radius/i);
    });
  });
});
