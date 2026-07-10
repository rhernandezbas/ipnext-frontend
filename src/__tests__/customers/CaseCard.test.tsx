/**
 * CaseCard — card de un caso de cambio de titularidad (actions-worklist F2).
 *
 *  CC-1  header: origen → destino, motivo, estado como pill en español
 *  CC-2  checkbox manual → PATCH {equipmentReviewed}
 *  CC-3  ambiguo: candidatos con radio + "Elegir" → PATCH {targetContractId}
 *  CC-4  pick 422 INVALID_CANDIDATE_PICK → error visible
 *  CC-5  descarte: exige motivo (modal) → PATCH {status:'dismissed', reason}
 *  CC-6  dismissed: muestra motivo + "Reabrir" → PATCH {status:'pending'}
 *  CC-7  1-click Transferir TV: abre el modal con destino precargado; al cerrar invalida ['actions']
 *  CC-8  gates del botón Transferir TV: tv==='ok' / tv===null (no aplica) /
 *        sin target / caso cerrado (done) / sin tv.transfer → oculto (M1)
 *  CC-9  sin actions.manage → no hay checkbox / Descartar / Elegir
 *  CC-10 GAP 1: "Asignar destino" en pending-sin-target (con manage) →
 *        CustomerPicker + select de contratos → PATCH {targetContractId};
 *        422 INVALID_TARGET_ASSIGNMENT → mensaje curado (GAP 3)
 *  CC-11 GAP 2: re-pick en pending CON candidates — título "Cambiar destino",
 *        candidato actual marcado, elegir otro → PATCH
 *  CC-12 M2: casos cerrados (done/dismissed) → check manual read-only
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import type { OwnershipCaseDto } from '@/types/actions';

vi.mock('@/hooks/useActions', () => ({
  useUpdateOwnershipCase: vi.fn(),
}));
vi.mock('@/components/molecules/TransferServiceModal/TransferServiceModal', () => ({
  TransferServiceModal: vi.fn(() => <div data-testid="transfer-modal">[TransferServiceModal]</div>),
}));
// GAP 1 — el AssignTargetPanel usa el CustomerPicker (useClientList) + el
// select de contratos del cliente elegido (useClientContracts).
vi.mock('@/hooks/useCustomers', () => ({
  useClientList: vi.fn(),
  useClientContracts: vi.fn(),
}));

import { useUpdateOwnershipCase } from '@/hooks/useActions';
import { useClientList, useClientContracts } from '@/hooks/useCustomers';
import { TransferServiceModal } from '@/components/molecules/TransferServiceModal/TransferServiceModal';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CaseCard } from '@/pages/customers/AccionesPage/components/CaseCard';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CASE: OwnershipCaseDto = {
  id: 'case-1',
  status: 'pending',
  sourceContractId: 'ct-old',
  sourceClientId: 'cl-old',
  sourceClientName: 'Juan Viejo',
  motivoBaja: 'CAMBIO DE TITULARIDAD',
  bajaDate: '01-07-2026',
  targetContractId: 'ct-new',
  targetClientId: 'cl-new',
  targetClientName: 'María Nueva',
  candidates: null,
  dismissReason: null,
  checks: {
    tv: 'pending',
    pppoe: 'ok',
    equipment: { sourceActive: 2, targetActive: 0, reviewed: false, reviewedAt: null, reviewedByName: null },
  },
  detectedAt: '2026-07-08T10:00:00Z',
  updatedAt: '2026-07-08T10:00:00Z',
};

const AMBIGUOUS_CASE: OwnershipCaseDto = {
  ...BASE_CASE,
  id: 'case-2',
  status: 'ambiguous',
  targetContractId: null,
  targetClientId: null,
  targetClientName: null,
  candidates: [
    { contractId: 'ct-a', clientId: 'cl-a', clientName: 'Ana Candidata' },
    { contractId: 'ct-b', clientId: 'cl-b', clientName: 'Beto Candidato' },
  ],
  checks: {
    tv: null,
    pppoe: null,
    equipment: { sourceActive: 2, targetActive: null, reviewed: false, reviewedAt: null, reviewedByName: null },
  },
};

const DISMISSED_CASE: OwnershipCaseDto = {
  ...BASE_CASE,
  id: 'case-3',
  status: 'dismissed',
  dismissReason: 'Era un duplicado del caso anterior',
};

/** GAP 1 — pending nacido sin candidatos: sin target NI candidates. */
const PENDING_NO_TARGET: OwnershipCaseDto = {
  ...BASE_CASE,
  id: 'case-5',
  targetContractId: null,
  targetClientId: null,
  targetClientName: null,
  candidates: null,
  checks: {
    tv: null,
    pppoe: null,
    equipment: { sourceActive: 2, targetActive: null, reviewed: false, reviewedAt: null, reviewedByName: null },
  },
};

/** GAP 2 — pending que salió de un pick: target elegido + candidates persistidos. */
const PENDING_WITH_CANDIDATES: OwnershipCaseDto = {
  ...BASE_CASE,
  id: 'case-6',
  targetContractId: 'ct-a',
  targetClientId: 'cl-a',
  targetClientName: 'Ana Candidata',
  candidates: [
    { contractId: 'ct-a', clientId: 'cl-a', clientName: 'Ana Candidata' },
    { contractId: 'ct-b', clientId: 'cl-b', clientName: 'Beto Candidato' },
  ],
};

// GAP 1 — resultados del picker y contratos del cliente elegido.
const PICKER_CLIENTS = [{ id: 'cl-picked', name: 'Carla Destino', email: 'carla@test.com' }];
const PICKED_CONTRACTS = [
  { id: 'ct-t1', plan: 'Plan 50M', name: null, status: 'active', address: 'Calle Falsa 123', services: [] },
  { id: 'ct-baja', plan: 'Plan 10M', name: null, status: 'baja', address: null, services: [] },
];

function mockPerms(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      if (perms.includes('*')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x));
    },
  } as UseMyPermissionsResult);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutateFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;
let mutateAsync: MutateFn;
let qc: QueryClient;

function renderCard(caso: OwnershipCaseDto) {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CaseCard caso={caso} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['*']);
  mutateAsync = vi.fn().mockResolvedValue(BASE_CASE);
  vi.mocked(useUpdateOwnershipCase).mockReturnValue(mockMutation({ mutateAsync }) as never);
  vi.mocked(useClientList).mockReturnValue(
    mockQuery({ data: { data: PICKER_CLIENTS, total: 1, page: 1, pageSize: 20, totalPages: 1 } }) as never,
  );
  vi.mocked(useClientContracts).mockReturnValue(
    mockQuery({ data: PICKED_CONTRACTS, isLoading: false }) as never,
  );
});

// ── CC-1: header ─────────────────────────────────────────────────────────────

describe('CC-1: header del caso', () => {
  it('muestra origen → destino, motivo y estado en español', () => {
    renderCard(BASE_CASE);
    expect(screen.getByText('Juan Viejo')).toBeInTheDocument();
    expect(screen.getByText('María Nueva')).toBeInTheDocument();
    expect(screen.getByText(/cambio de titularidad/i)).toBeInTheDocument();
    // El pill de estado lleva aria-label propio (el checklist también dice "Pendiente").
    expect(screen.getByLabelText('Estado del caso: Pendiente')).toBeInTheDocument();
  });

  it('sin destino → lo dice explícitamente', () => {
    renderCard({ ...BASE_CASE, targetContractId: null, targetClientId: null, targetClientName: null });
    expect(screen.getByText(/sin destino/i)).toBeInTheDocument();
  });

  it('bajaDate del raw GR (dd-mm-yyyy) → formateada con la util canónica', () => {
    renderCard(BASE_CASE); // bajaDate: '01-07-2026'
    expect(screen.getByText(/baja \(gr\): 01 jul 2026/i)).toBeInTheDocument();
  });
});

// ── CC-2: checkbox manual → PATCH ────────────────────────────────────────────

describe('CC-2: check manual de equipos', () => {
  it('marca el checkbox → PATCH {equipmentReviewed: true}', async () => {
    const user = userEvent.setup();
    renderCard(BASE_CASE);
    await user.click(screen.getByRole('checkbox', { name: /revisión física/i }));
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-1',
      body: { equipmentReviewed: true },
    });
  });
});

// ── CC-3/4: pick de candidato ────────────────────────────────────────────────

describe('CC-3: caso ambiguo → pick de candidato', () => {
  it('lista candidatos con radio; Elegir deshabilitado sin selección', () => {
    renderCard(AMBIGUOUS_CASE);
    expect(screen.getByRole('radio', { name: /ana candidata/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /beto candidato/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elegir/i })).toBeDisabled();
  });

  it('elegir un candidato → PATCH {targetContractId}', async () => {
    const user = userEvent.setup();
    renderCard(AMBIGUOUS_CASE);
    await user.click(screen.getByRole('radio', { name: /beto candidato/i }));
    await user.click(screen.getByRole('button', { name: /elegir/i }));
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-2',
      body: { targetContractId: 'ct-b' },
    });
  });
});

describe('CC-4: 422 INVALID_CANDIDATE_PICK visible', () => {
  it('muestra el error cuando el BE rechaza el pick', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue({
      response: { status: 422, data: { code: 'INVALID_CANDIDATE_PICK', error: 'invalid pick' } },
    });
    renderCard(AMBIGUOUS_CASE);
    await user.click(screen.getByRole('radio', { name: /ana candidata/i }));
    await user.click(screen.getByRole('button', { name: /elegir/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/candidato/i);
  });
});

// ── CC-5: descarte con motivo obligatorio ────────────────────────────────────

describe('CC-5: descarte exige motivo', () => {
  it('abre el modal, no confirma sin motivo, y PATCHea {status:dismissed, reason}', async () => {
    const user = userEvent.setup();
    renderCard(BASE_CASE);

    await user.click(screen.getByRole('button', { name: /descartar/i }));
    const dialog = await screen.findByRole('dialog');

    // Sin motivo → el confirm del modal queda deshabilitado.
    const confirmBtn = within(dialog).getByRole('button', { name: /descartar/i });
    expect(confirmBtn).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/motivo/i), 'No corresponde, es homónimo');
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-1',
      body: { status: 'dismissed', reason: 'No corresponde, es homónimo' },
    });
  });
});

// ── CC-6: dismissed → motivo + Reabrir ───────────────────────────────────────

describe('CC-6: caso descartado', () => {
  it('muestra el motivo del descarte y Reabrir → PATCH {status:pending}', async () => {
    const user = userEvent.setup();
    renderCard(DISMISSED_CASE);
    expect(screen.getByText(/era un duplicado/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Estado del caso: Descartado')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reabrir/i }));
    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-3',
      body: { status: 'pending' },
    });
  });
});

// ── CC-7: 1-click Transferir TV ──────────────────────────────────────────────

describe('CC-7: 1-click Transferir TV', () => {
  it('abre el TransferServiceModal con origen + destino precargados', async () => {
    const user = userEvent.setup();
    renderCard(BASE_CASE);

    await user.click(screen.getByRole('button', { name: /transferir tv/i }));

    expect(screen.getByTestId('transfer-modal')).toBeInTheDocument();
    const props = vi.mocked(TransferServiceModal).mock.calls[0][0];
    expect(props.variant).toEqual({ kind: 'tv' });
    expect(props.sourceClientId).toBe('cl-old');
    expect(props.sourceClientName).toBe('Juan Viejo');
    expect(props.sourceContractId).toBe('ct-old');
    expect(props.initialTarget).toEqual({ id: 'cl-new', name: 'María Nueva' });
    expect(props.initialTargetContractId).toBe('ct-new');
  });

  it('al cerrar el modal invalida la raíz ["actions"]', async () => {
    const user = userEvent.setup();
    renderCard(BASE_CASE);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: /transferir tv/i }));
    const props = vi.mocked(TransferServiceModal).mock.calls[0][0];
    props.onClose();

    expect(spy).toHaveBeenCalledWith({ queryKey: ['actions'] });
  });
});

// ── CC-8: visibilidad del botón Transferir TV ────────────────────────────────

describe('CC-8: gates del botón Transferir TV', () => {
  it('oculto cuando la TV ya está transferida (tv === ok)', () => {
    renderCard({ ...BASE_CASE, checks: { ...BASE_CASE.checks, tv: 'ok' } });
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });

  it('oculto cuando no hay contrato destino', () => {
    renderCard({ ...BASE_CASE, targetContractId: null, targetClientId: null, targetClientName: null });
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });

  it('oculto sin tv.transfer', () => {
    mockPerms(['actions.read', 'actions.manage']);
    renderCard(BASE_CASE);
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });

  // M1 — tv === null significa "no aplica" (el origen no tiene TV): sin botón.
  it('oculto cuando tv === null (no aplica) aunque haya destino', () => {
    renderCard({ ...BASE_CASE, checks: { ...BASE_CASE.checks, tv: null } });
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });

  // M1 — un caso cerrado no ofrece acciones de transferencia.
  it('oculto en un caso done aunque tv siga pending', () => {
    renderCard({ ...BASE_CASE, status: 'done' });
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });

  it('oculto en un caso dismissed aunque tv siga pending', () => {
    renderCard(DISMISSED_CASE);
    expect(screen.queryByRole('button', { name: /transferir tv/i })).not.toBeInTheDocument();
  });
});

// ── CC-9: sin actions.manage no hay superficie de gestión ────────────────────

describe('CC-9: sin actions.manage', () => {
  it('no hay checkbox, ni Descartar, ni Elegir', () => {
    mockPerms(['actions.read', 'tv.transfer']);
    renderCard(AMBIGUOUS_CASE);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /elegir/i })).not.toBeInTheDocument();
  });

  it('tampoco hay Reabrir en un caso descartado', () => {
    mockPerms(['actions.read']);
    renderCard(DISMISSED_CASE);
    expect(screen.queryByRole('button', { name: /reabrir/i })).not.toBeInTheDocument();
  });
});

// ── CC-10: GAP 1 — Asignar destino en pending-sin-target ────────────────────

describe('CC-10: Asignar destino (pending sin target)', () => {
  it('pending sin target con actions.manage → control visible', () => {
    renderCard(PENDING_NO_TARGET);
    expect(screen.getByRole('button', { name: /asignar destino/i })).toBeInTheDocument();
  });

  it('oculto con target, en ambiguous y en dismissed-sin-target', () => {
    const r1 = renderCard(BASE_CASE);
    expect(screen.queryByRole('button', { name: /asignar destino/i })).not.toBeInTheDocument();
    r1.unmount();

    const r2 = renderCard(AMBIGUOUS_CASE);
    expect(screen.queryByRole('button', { name: /asignar destino/i })).not.toBeInTheDocument();
    r2.unmount();

    renderCard({
      ...DISMISSED_CASE,
      targetContractId: null,
      targetClientId: null,
      targetClientName: null,
    });
    expect(screen.queryByRole('button', { name: /asignar destino/i })).not.toBeInTheDocument();
  });

  it('oculto sin actions.manage', () => {
    mockPerms(['actions.read', 'tv.transfer']);
    renderCard(PENDING_NO_TARGET);
    expect(screen.queryByRole('button', { name: /asignar destino/i })).not.toBeInTheDocument();
  });

  it('abrir → elegir cliente y contrato → Asignar → PATCH {targetContractId}', async () => {
    const user = userEvent.setup();
    renderCard(PENDING_NO_TARGET);

    await user.click(screen.getByRole('button', { name: /asignar destino/i }));
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Carla' } });
    fireEvent.click(await screen.findByText('Carla Destino'));

    const select = await screen.findByLabelText(/contrato destino/i);
    fireEvent.change(select, { target: { value: 'ct-t1' } });

    const confirm = screen.getByRole('button', { name: /^asignar$/i });
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-5',
      body: { targetContractId: 'ct-t1' },
    });
  });

  it('Asignar deshabilitado hasta elegir contrato; contratos en baja deshabilitados', async () => {
    const user = userEvent.setup();
    renderCard(PENDING_NO_TARGET);

    await user.click(screen.getByRole('button', { name: /asignar destino/i }));
    expect(screen.getByRole('button', { name: /^asignar$/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Carla' } });
    fireEvent.click(await screen.findByText('Carla Destino'));

    const bajaOption = await screen.findByRole('option', { name: /plan 10m/i });
    expect(bajaOption).toBeDisabled();
  });

  it('422 INVALID_TARGET_ASSIGNMENT → mensaje curado visible (GAP 3)', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue({
      response: { status: 422, data: { code: 'INVALID_TARGET_ASSIGNMENT', error: 'invalid target' } },
    });
    renderCard(PENDING_NO_TARGET);

    await user.click(screen.getByRole('button', { name: /asignar destino/i }));
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Carla' } });
    fireEvent.click(await screen.findByText('Carla Destino'));
    fireEvent.change(await screen.findByLabelText(/contrato destino/i), { target: { value: 'ct-t1' } });
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no puede ser el destino: no existe, está de baja o pertenece al mismo cliente/i,
    );
  });
});

// ── CC-11: GAP 2 — re-pick en pending con candidates ────────────────────────

describe('CC-11: re-pick en pending con candidates', () => {
  it('muestra "Cambiar destino" con el candidato actual marcado', () => {
    renderCard(PENDING_WITH_CANDIDATES);
    expect(screen.getByText(/cambiar destino/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ana candidata/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /beto candidato/i })).not.toBeChecked();
  });

  it('con el candidato actual marcado el botón queda deshabilitado; elegir otro → PATCH', async () => {
    const user = userEvent.setup();
    renderCard(PENDING_WITH_CANDIDATES);
    expect(screen.getByRole('button', { name: /elegir/i })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /beto candidato/i }));
    const btn = screen.getByRole('button', { name: /elegir/i });
    expect(btn).toBeEnabled();
    await user.click(btn);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'case-6',
      body: { targetContractId: 'ct-b' },
    });
  });

  it('el título "Elegí el contrato destino" se mantiene en ambiguous', () => {
    renderCard(AMBIGUOUS_CASE);
    expect(screen.getByText(/elegí el contrato destino/i)).toBeInTheDocument();
    expect(screen.queryByText(/cambiar destino/i)).not.toBeInTheDocument();
  });

  it('dismissed con candidates NO muestra el picker', () => {
    renderCard({ ...PENDING_WITH_CANDIDATES, status: 'dismissed', dismissReason: 'pick errado' });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

// ── CC-12: M2 — check manual read-only en casos cerrados ────────────────────

describe('CC-12: check manual read-only en casos cerrados', () => {
  it('dismissed → sin checkbox aunque tenga actions.manage; estado visible', () => {
    renderCard(DISMISSED_CASE);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/sin revisar/i)).toBeInTheDocument();
  });

  it('done → sin checkbox', () => {
    renderCard({ ...BASE_CASE, status: 'done' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('pending sigue editable', () => {
    renderCard(BASE_CASE);
    expect(screen.getByRole('checkbox', { name: /revisión física/i })).toBeInTheDocument();
  });
});
