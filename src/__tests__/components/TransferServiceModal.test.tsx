/**
 * TransferServiceModal — modal genérico de transferencia de servicios (service-transfer W4)
 *
 * Cubre:
 *  TSM-1  TV happy path: 2 pasos (form → confirmación de-quién-a-quién) + resultado visible SIN auto-cerrar
 *  TSM-2  TV 207 parcial → detalle accionable (localSource failed) + botón Reintentar (misma mutación), no cierra
 *  TSM-3  TV 409 TV_ALREADY_LINKED → mensaje claro
 *  TSM-4  PPPoE as-is: motivo OBLIGATORIO (Continuar deshabilitado sin motivo) + payload con reason
 *  TSM-5  PPPoE recreate: subform prefilleado del PPPoE actual, exige username DISTINTO, payload newPppoe
 *  TSM-6  PPPoE 409 PPPOE_TRANSFER_PENDING_RESIDUE → muestra el mensaje del BE (id + hint) tal cual
 *  TSM-7  PPPoE 207 parcial (recreate): "viejo pendiente de borrar" visible, no cierra
 *  TSM-8  Equipos: checkboxes con default TODOS marcados; el payload respeta la deselección
 *  TSM-9  El CustomerPicker EXCLUYE al cliente origen de los resultados
 *
 * Fix wave (review service-transfer):
 *  TSM-10 FIX 1: 207 → Reintentar falla duro (503) → el error es VISIBLE en el resultView
 *  TSM-11 FIX 2: 409 PPPOE_CONTRACT_ALREADY_HAS_SERVICE (code REAL del BE) → mensaje curado
 *  TSM-12 FIX 3: assetMoved:false = informativo neutro (equipo legacy sin asset), NO alarma
 *  TSM-13 FIX 5: Escape NO cierra durante isPending (paridad con el guard del backdrop)
 *  TSM-14 FIX 6: el input del CustomerPicker es accesible por el label "Cliente destino"
 *  TSM-15 FIX 7: GIGARED_REJECTED sin detail → usa el message del BE antes del genérico
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PppoeServiceDto } from '@/types/pppoe';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useCustomers', () => ({
  useClientList: vi.fn(),
  useClientContracts: vi.fn(),
}));
vi.mock('@/hooks/useGigared', () => ({
  useTransferTv: vi.fn(),
}));
vi.mock('@/hooks/usePppoe', () => ({
  useTransferPppoe: vi.fn(),
}));
vi.mock('@/hooks/useServiceInventory', () => ({
  useTransferEquipment: vi.fn(),
}));

import { useClientList, useClientContracts } from '@/hooks/useCustomers';
import { useTransferTv } from '@/hooks/useGigared';
import { useTransferPppoe } from '@/hooks/usePppoe';
import { useTransferEquipment } from '@/hooks/useServiceInventory';
import { TransferServiceModal } from '@/components/molecules/TransferServiceModal/TransferServiceModal';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const clients = [
  { id: 'c-1', name: 'Juan Origen', email: 'juan@test.com' },
  { id: 'c-2', name: 'María López', email: 'maria@test.com' },
];

const targetContracts = [
  { id: 'ct-t1', plan: 'Plan 50M', name: null, status: 'active', address: 'Calle Falsa 123', services: [] },
  { id: 'ct-t2', plan: 'Plan 100M', name: 'Casa', status: 'baja', address: null, services: [] },
];

const PPPOE: PppoeServiceDto = {
  id: 'pppoe-1',
  username: 'juan.old',
  profile: '10M',
  remoteAddress: '100.64.28.10',
  status: 'enabled',
  enforcedState: 'active',
  nasId: 'nas-1',
  contractId: 'ct-s1',
  createdAt: '2026-06-01T00:00:00Z',
  ipMode: 'fixed',
  ipTypePreference: 'cgnat',
};

const NAS_SERVERS = [
  { id: 'nas-1', name: 'Router Central' },
  { id: 'nas-2', name: 'NE8000' },
];

const ITEMS: ServiceInstalledItem[] = [
  {
    id: 'item-1', serviceId: 'ct-s1', type: 'ANTENA', serialNumber: 'SN-001', mac: 'AA:BB:CC:00:11:22',
    model: 'LiteBeam', source: 'MANUAL', sourceTaskId: null, addedByUserId: null, addedByUserName: null,
    confirmedAt: null, status: 'active', notes: null, createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'item-2', serviceId: 'ct-s1', type: 'ROUTER', serialNumber: 'SN-002', mac: null,
    model: null, source: 'MANUAL', sourceTaskId: null, addedByUserId: null, addedByUserName: null,
    confirmedAt: null, status: 'active', notes: null, createdAt: '2026-06-01T00:00:00Z',
  },
];

const tvSuccess = {
  status: 200,
  data: { cic: '0000000009', severed: true, localSource: 'synced', localTarget: 'synced', targetCleared: true },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const onClose = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutateFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;
let tvMutateAsync: MutateFn;
let pppoeMutateAsync: MutateFn;
let equipMutateAsync: MutateFn;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useClientList).mockReturnValue(
    mockQuery({ data: { data: clients, total: 2, page: 1, pageSize: 20, totalPages: 1 } }) as never,
  );
  vi.mocked(useClientContracts).mockReturnValue(
    mockQuery({ data: targetContracts, isLoading: false }) as never,
  );
  tvMutateAsync = vi.fn().mockResolvedValue(tvSuccess);
  pppoeMutateAsync = vi.fn().mockResolvedValue({
    mode: 'recreate', oldContractId: 'ct-s1', newContractId: 'ct-t1',
    oldUsername: 'juan.old', newUsername: 'maria.nueva',
  });
  equipMutateAsync = vi.fn().mockResolvedValue({
    moved: 2,
    items: [
      { id: 'item-1', type: 'ANTENA', assetMoved: true },
      { id: 'item-2', type: 'ROUTER', assetMoved: true },
    ],
  });
  vi.mocked(useTransferTv).mockReturnValue(mockMutation({ mutateAsync: tvMutateAsync }) as never);
  vi.mocked(useTransferPppoe).mockReturnValue(mockMutation({ mutateAsync: pppoeMutateAsync }) as never);
  vi.mocked(useTransferEquipment).mockReturnValue(mockMutation({ mutateAsync: equipMutateAsync }) as never);
});

function renderModal(variant: 'tv' | 'pppoe' | 'equipment') {
  const service =
    variant === 'tv'
      ? ({ kind: 'tv' } as const)
      : variant === 'pppoe'
        ? ({ kind: 'pppoe', pppoe: PPPOE, nasServers: NAS_SERVERS } as const)
        : ({ kind: 'equipment', items: ITEMS } as const);
  return render(
    <TransferServiceModal
      variant={service}
      sourceClientId="c-1"
      sourceClientName="Juan Origen"
      sourceContractId="ct-s1"
      onClose={onClose}
    />,
  );
}

/** Busca y elige al cliente destino + contrato destino (paso 1 compartido). */
async function pickTarget() {
  fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'María' } });
  const option = await screen.findByText('María López');
  fireEvent.click(option);
  const select = screen.getByLabelText(/contrato destino/i);
  fireEvent.change(select, { target: { value: 'ct-t1' } });
}

// ── TSM-1: TV happy path ──────────────────────────────────────────────────────

describe('TSM-1: TV — dos pasos + resultado sin auto-cerrar', () => {
  it('flujo completo: elegir destino → confirmar de-quién-a-quién → transferir → resultado visible', async () => {
    const user = userEvent.setup();
    renderModal('tv');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    // Paso 2: confirmación explícita de-quién-a-quién (el nombre va en <strong>,
    // así que matcheamos por textContent del párrafo completo)
    expect(
      screen.getByText((_, el) =>
        el?.tagName === 'P' && /transferir tv de juan origen a maría lópez/i.test(el.textContent ?? ''),
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => {
      expect(tvMutateAsync).toHaveBeenCalledWith({
        targetCustomerId: 'c-2',
        targetContractId: 'ct-t1',
        sourceContractId: 'ct-s1',
      });
    });

    // Resultado visible SIN auto-cerrar
    expect(await screen.findByText(/tv transferida/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Cierre EXPLÍCITO disponible (el × del header y el "Cerrar" del resultado comparten nombre)
    expect(screen.getAllByRole('button', { name: /cerrar/i }).length).toBeGreaterThan(0);
  });
});

// ── TSM-2: TV 207 parcial ─────────────────────────────────────────────────────

describe('TSM-2: TV 207 parcial → detalle accionable + Reintentar', () => {
  it('muestra el detalle del parcial y el retry re-dispara la MISMA mutación', async () => {
    const user = userEvent.setup();
    tvMutateAsync.mockResolvedValue({
      status: 207,
      data: { cic: '0000000009', severed: true, localSource: 'failed', localTarget: 'synced', targetCleared: true },
    });
    renderModal('tv');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    // Parcial: NUNCA "éxito" plano — detalle de qué quedó pendiente
    expect(await screen.findByText(/transferencia parcial/i)).toBeInTheDocument();
    expect(screen.getByText(/registro local del origen/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Retry con el MISMO request (el BE es resumible/idempotente)
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(tvMutateAsync).toHaveBeenCalledTimes(2));
    expect(tvMutateAsync).toHaveBeenLastCalledWith({
      targetCustomerId: 'c-2',
      targetContractId: 'ct-t1',
      sourceContractId: 'ct-s1',
    });
  });
});

// ── TSM-3: TV 409 TV_ALREADY_LINKED ──────────────────────────────────────────

describe('TSM-3: TV 409 TV_ALREADY_LINKED → mensaje claro', () => {
  it('muestra un error entendible cuando el destino ya tiene TV vinculada', async () => {
    const user = userEvent.setup();
    tvMutateAsync.mockRejectedValue({
      response: { status: 409, data: { code: 'TV_ALREADY_LINKED', error: 'TV already linked' } },
    });
    renderModal('tv');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(await screen.findByText(/ya tiene otra cuenta de tv vinculada/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── TSM-4: PPPoE as-is exige motivo ──────────────────────────────────────────

describe('TSM-4: PPPoE as-is → motivo obligatorio', () => {
  it('Continuar queda deshabilitado sin motivo y el payload lleva mode + reason', async () => {
    const user = userEvent.setup();
    renderModal('pppoe');

    await pickTarget();
    await user.click(screen.getByRole('radio', { name: /transferir tal cual/i }));

    // Sin motivo → no se puede continuar
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/motivo/i), 'Sin acceso a la antena');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => {
      expect(pppoeMutateAsync).toHaveBeenCalledWith({
        id: 'pppoe-1',
        targetClientId: 'c-2',
        targetContractId: 'ct-t1',
        mode: 'as-is',
        reason: 'Sin acceso a la antena',
      });
    });
  });
});

// ── TSM-5: PPPoE recreate ─────────────────────────────────────────────────────

describe('TSM-5: PPPoE recreate → subform prefilleado + username distinto', () => {
  it('prefillea del PPPoE actual, exige username distinto y manda newPppoe', async () => {
    const user = userEvent.setup();
    renderModal('pppoe');

    await pickTarget();

    // Recreate es el modo default (recomendado). El hint del as-is también dice
    // "recrear", así que el name matchea el título completo del radio.
    expect(screen.getByRole('radio', { name: /recrear \(recomendado\)/i })).toBeChecked();

    // Prefill desde el PPPoE actual
    const usernameInput = screen.getByLabelText(/usuario nuevo/i) as HTMLInputElement;
    expect(usernameInput.value).toBe('juan.old');
    expect((screen.getByLabelText(/plan/i) as HTMLInputElement).value).toBe('10M');

    // Username igual al viejo → Continuar deshabilitado (el BE lo rechazaría con USERNAME_TAKEN)
    await user.type(screen.getByLabelText(/contraseña/i), 'secret123');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();

    await user.clear(usernameInput);
    await user.type(usernameInput, 'maria.nueva');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => {
      expect(pppoeMutateAsync).toHaveBeenCalledWith({
        id: 'pppoe-1',
        targetClientId: 'c-2',
        targetContractId: 'ct-t1',
        mode: 'recreate',
        newPppoe: {
          username: 'maria.nueva',
          password: 'secret123',
          nasId: 'nas-1',
          profile: '10M',
          ipTypePreference: 'cgnat',
        },
      });
    });
  });
});

// ── TSM-6: PPPOE_TRANSFER_PENDING_RESIDUE ────────────────────────────────────

describe('TSM-6: 409 PPPOE_TRANSFER_PENDING_RESIDUE → hint del BE visible', () => {
  it('muestra el mensaje del BE (con id y cómo recuperar) tal cual', async () => {
    const user = userEvent.setup();
    const beMessage =
      "Un intento previo de transferencia dejó el PPPoE 'maria.nueva' PENDIENTE en el contrato destino " +
      '(id pend-99) — borralo con DELETE /api/pppoe/pend-99 y reintentá, o continuá el aprovisionamiento desde la ficha';
    pppoeMutateAsync.mockRejectedValue({
      response: { status: 409, data: { code: 'PPPOE_TRANSFER_PENDING_RESIDUE', error: beMessage } },
    });
    renderModal('pppoe');

    await pickTarget();
    const usernameInput = screen.getByLabelText(/usuario nuevo/i);
    await user.clear(usernameInput);
    await user.type(usernameInput, 'maria.nueva');
    await user.type(screen.getByLabelText(/contraseña/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(await screen.findByText(new RegExp('pend-99'))).toBeInTheDocument();
    expect(screen.getByText(/intento previo de transferencia/i)).toBeInTheDocument();
  });
});

// ── TSM-7: PPPoE 207 parcial recreate ────────────────────────────────────────

describe('TSM-7: PPPoE 207 parcial (recreate) → viejo pendiente de borrar', () => {
  it('muestra el detalle del parcial y no cierra', async () => {
    const user = userEvent.setup();
    pppoeMutateAsync.mockResolvedValue({
      mode: 'recreate', oldContractId: 'ct-s1', newContractId: 'ct-t1',
      oldUsername: 'juan.old', newUsername: 'maria.nueva', partial: true,
    });
    renderModal('pppoe');

    await pickTarget();
    const usernameInput = screen.getByLabelText(/usuario nuevo/i);
    await user.clear(usernameInput);
    await user.type(usernameInput, 'maria.nueva');
    await user.type(screen.getByLabelText(/contraseña/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(await screen.findByText(/pendiente de borrar/i)).toBeInTheDocument();
    expect(screen.getByText(/juan\.old/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── TSM-8: Equipos — checkboxes ──────────────────────────────────────────────

describe('TSM-8: Equipos → checkboxes default todos marcados + deselección', () => {
  it('marca todos por default y el payload respeta lo deseleccionado', async () => {
    const user = userEvent.setup();
    renderModal('equipment');

    await pickTarget();

    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(2);
    checks.forEach((c) => expect(c).toBeChecked());
    // Muestra type/serial/mac
    expect(screen.getByText(/SN-001/)).toBeInTheDocument();
    expect(screen.getByText(/AA:BB:CC:00:11:22/)).toBeInTheDocument();

    // Desmarcar el ROUTER (item-2)
    await user.click(checks[1]);

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => {
      expect(equipMutateAsync).toHaveBeenCalledWith({
        targetContractId: 'ct-t1',
        targetClientId: 'c-2',
        itemIds: ['item-1'],
      });
    });
  });

  it('con todo deseleccionado no deja continuar', async () => {
    const user = userEvent.setup();
    renderModal('equipment');
    await pickTarget();
    const checks = screen.getAllByRole('checkbox');
    await user.click(checks[0]);
    await user.click(checks[1]);
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });
});

// ── TSM-9: excluye al cliente origen ─────────────────────────────────────────

describe('TSM-9: el picker excluye al cliente origen', () => {
  it('no ofrece al cliente origen en los resultados de búsqueda', async () => {
    renderModal('tv');
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'a' } });
    await screen.findByText('María López');
    expect(screen.queryByText('Juan Origen')).not.toBeInTheDocument();
  });
});

// ── TSM-10 (FIX 1): error visible en el retry del 207 ───────────────────────

describe('TSM-10 FIX 1: 207 → Reintentar falla duro → error visible en el resultado', () => {
  it('un 503 en el Reintentar muestra el banner de error SIN perder el detalle del parcial', async () => {
    const user = userEvent.setup();
    tvMutateAsync.mockResolvedValueOnce({
      status: 207,
      data: { cic: '0000000009', severed: true, localSource: 'failed', localTarget: 'synced', targetCleared: true },
    });
    renderModal('tv');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));
    expect(await screen.findByText(/transferencia parcial/i)).toBeInTheDocument();

    // El retry falla DURO (503) — el error tiene que ser visible en el resultView.
    tvMutateAsync.mockRejectedValueOnce({
      response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE', error: 'gigared down' } },
    });
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText(/no está disponible en este momento/i)).toBeInTheDocument();
    // El detalle del parcial sigue visible: el operador no pierde contexto para reintentar.
    expect(screen.getByText(/transferencia parcial/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── TSM-11 (FIX 2): code REAL del BE para destino ocupado ───────────────────

describe('TSM-11 FIX 2: 409 PPPOE_CONTRACT_ALREADY_HAS_SERVICE → mensaje curado', () => {
  it('matchea el code que emite el BE y muestra el mensaje curado (no el crudo con UUIDs)', async () => {
    const user = userEvent.setup();
    pppoeMutateAsync.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'PPPOE_CONTRACT_ALREADY_HAS_SERVICE',
          error: 'contract 3f2c8a10-aaaa-bbbb-cccc-000000000001 already has enabled pppoe 9d1e4f00-dddd-eeee-ffff-000000000002',
        },
      },
    });
    renderModal('pppoe');

    await pickTarget();
    const usernameInput = screen.getByLabelText(/usuario nuevo/i);
    await user.clear(usernameInput);
    await user.type(usernameInput, 'maria.nueva');
    await user.type(screen.getByLabelText(/contraseña/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(await screen.findByText(/ya tiene un servicio pppoe activo/i)).toBeInTheDocument();
    expect(screen.queryByText(/3f2c8a10/)).not.toBeInTheDocument();
  });
});

// ── TSM-12 (FIX 3): assetMoved:false = informativo, NO alarma ────────────────

describe('TSM-12 FIX 3: assetMoved:false = sin asset en el ledger (informativo neutro)', () => {
  it('no muestra warning de fallo para equipos legacy sin asset (el lote del BE es atómico)', async () => {
    const user = userEvent.setup();
    equipMutateAsync.mockResolvedValue({
      moved: 2,
      items: [
        { id: 'item-1', type: 'ANTENA', assetMoved: true },
        { id: 'item-2', type: 'ROUTER', assetMoved: false },
      ],
    });
    renderModal('equipment');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(await screen.findByText(/se movieron 2 equipos/i)).toBeInTheDocument();
    // NO alarma: assetMoved:false = ítem sin asset vinculado (caso común legacy), no un fallo.
    expect(screen.queryByText(/atención/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no quedó registrado/i)).not.toBeInTheDocument();
    // Informativo neutro con los tipos sin asset.
    expect(screen.getByText(/sin asset vinculado en el ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/ROUTER/)).toBeInTheDocument();
  });
});

// ── TSM-13 (FIX 5): Escape durante isPending ─────────────────────────────────

describe('TSM-13 FIX 5: Escape no cierra durante isPending', () => {
  it('con la mutación en vuelo, Escape NO dispara onClose', () => {
    vi.mocked(useTransferTv).mockReturnValue(
      mockMutation({ mutateAsync: tvMutateAsync, isPending: true }) as never,
    );
    renderModal('tv');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sin mutación en vuelo, Escape SÍ cierra (comportamiento base intacto)', () => {
    renderModal('tv');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── TSM-14 (FIX 6): a11y del CustomerPicker ──────────────────────────────────

describe('TSM-14 FIX 6: label "Cliente destino" asociado al input del picker', () => {
  it('el input de búsqueda es accesible por su label', () => {
    renderModal('tv');
    expect(screen.getByLabelText(/cliente destino/i)).toBe(
      screen.getByPlaceholderText(/buscar cliente/i),
    );
  });
});

// ── TSM-15 (FIX 7): GIGARED_REJECTED sin detail ──────────────────────────────

describe('TSM-15 FIX 7: GIGARED_REJECTED sin detail → cae al message del BE', () => {
  it('muestra el message del BE cuando detail viene vacío', async () => {
    const user = userEvent.setup();
    tvMutateAsync.mockRejectedValue({
      response: {
        status: 502,
        data: { code: 'GIGARED_REJECTED', error: 'CIC destino inexistente en Gigared' },
      },
    });
    renderModal('tv');

    await pickTarget();
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    expect(
      await screen.findByText(/gigared rechazó la transferencia: cic destino inexistente en gigared/i),
    ).toBeInTheDocument();
  });
});
