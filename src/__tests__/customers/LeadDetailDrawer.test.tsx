/**
 * LeadDetailDrawer — tests for:
 *   #3a  status selector (6 options, change calls useUpdateLeadStatus, gated by recapture.manage)
 *   #3b  assignee name (assigneeName shown in the meta grid)
 *   operator select re-gated to recapture.assign; claim/release removed
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock the hooks this component uses ────────────────────────────────────────

vi.mock('@/hooks/useRecaptacion', () => ({
  useRecaptacionLead:   vi.fn(),
  useAddContact:        vi.fn(),
  useUpdateLeadStatus:  vi.fn(),
  useAssignLead:        vi.fn(),
}));

vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(),
}));

// ContractHistoryModal mounts only when contractsClientId is set — i.e. after
// a "Ver contratos" / "Ver contratos del match" click, never unconditionally
// from the lead/match having a clientId. It reads this hook internally,
// mocked the same way its own test suite does, so opening it here never
// fires a real network call.
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
}));

import {
  useRecaptacionLead,
  useAddContact,
  useUpdateLeadStatus,
  useAssignLead,
} from '@/hooks/useRecaptacion';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useClientContracts } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

import { LeadDetailDrawer } from '@/pages/customers/RecaptacionPage/components/LeadDetailDrawer';
import type { RecaptureLeadDto } from '@/types/recaptacion';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_LEAD: RecaptureLeadDto = {
  id: 'lead-42',
  source: 'churned_client',
  clientId: 'client-1',
  contactName: 'Ana García',
  phone: '+5491144556677',
  email: 'ana@example.com',
  status: 'nuevo',
  assigneeId: null,
  assigneeName: null,
  technologies: [],
  claimedAt: null,
  createdAt: '2026-06-13T10:00:00.000Z',
  updatedAt: '2026-06-13T10:00:00.000Z',
};

const LEAD_WITH_ASSIGNEE: RecaptureLeadDto = {
  ...BASE_LEAD,
  assigneeId: 'user-99',
  assigneeName: 'María López',
  claimedAt: '2026-06-13T10:05:00.000Z',
};

const mutateStatus = vi.fn();
const mutateAssign = vi.fn();

// recapture-assignable-roles: the pool is every ACTIVE user WITH ≥1 role AND
// none technical. `tecnico` is barred; every other role (ventas, administrador,
// noc) qualifies.
const VENTAS_ROLE: RbacRoleDto = { id: 'role-ventas', code: 'ventas', label: 'Ventas', isSystem: true };
// A non-sales system role — now assignable (only tecnico is excluded).
const ADMIN_ROLE: RbacRoleDto = { id: 'role-admin', code: 'administrador', label: 'Administrador', isSystem: true };
// The one excluded role.
const TECNICO_ROLE: RbacRoleDto = { id: 'role-tec', code: 'tecnico', label: 'Técnico', isSystem: true };

// Assignee pool comes from RbacUser (GET /admin/rbac/users), NOT the Admin table.
// Predicate: ACTIVE + ≥1 role + none technical.
const RBAC_USERS: RbacUserWithRolesDto[] = [
  { id: 'op-1', name: 'Operador Uno', email: 'op1@test.com', login: 'op1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [VENTAS_ROLE] },
  { id: 'op-2', name: 'Operador Dos', email: 'op2@test.com', login: 'op2', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [VENTAS_ROLE] },
];

// A disabled RbacUser (with a valid role) — must NEVER show up in the pool.
const DISABLED_USER: RbacUserWithRolesDto = {
  id: 'op-off', name: 'Operador Baja', email: 'off@test.com', login: 'off', status: 'disabled', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [VENTAS_ROLE],
};

// An active RbacUser with NO roles — must be excluded (assignable needs ≥1 role).
const NO_ROLE_USER: RbacUserWithRolesDto = {
  id: 'op-norole', name: 'Sin Roles', email: 'nr@test.com', login: 'nr', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [],
};

// An active technician — must be excluded (tecnico is the barred role).
const TECNICO_USER: RbacUserWithRolesDto = {
  id: 'op-tec', name: 'Operador Técnico', email: 'tec@test.com', login: 'tec', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [TECNICO_ROLE],
};

// An active admin (non-technical) — now INCLUDED in the pool.
const ADMIN_USER: RbacUserWithRolesDto = {
  id: 'op-admin', name: 'Admin Solo', email: 'adm@test.com', login: 'adm', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, lockedUntil: null, roles: [ADMIN_ROLE],
};

/**
 * @param opts.has predicate over a SINGLE permission string. Default: grant all.
 *   - manage-only agent: `(p) => p === 'recapture.manage'`
 *   - admin: default (all)
 * The returned `can` mirrors the real one (accepts string | string[], mode 'any').
 */
function mockHooks(opts?: { can?: (p: string) => boolean; users?: RbacUserWithRolesDto[] }) {
  const has = opts?.can ?? (() => true);
  const users = opts?.users ?? RBAC_USERS;
  const can = (perm: string | string[]) => {
    const list = Array.isArray(perm) ? perm : [perm];
    return list.some((p) => has(p));
  };

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: can as never,
  } as UseMyPermissionsResult);

  vi.mocked(useRecaptacionLead).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useRecaptacionLead>);

  vi.mocked(useAddContact).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useAddContact>);

  vi.mocked(useUpdateLeadStatus).mockReturnValue({
    mutate: mutateStatus,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUpdateLeadStatus>);

  vi.mocked(useAssignLead).mockReturnValue({
    mutate: mutateAssign,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useAssignLead>);

  vi.mocked(useRbacUsers).mockReturnValue({
    data: users,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useRbacUsers>);

  vi.mocked(useClientContracts).mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useClientContracts>);
}

function renderDrawer(lead: RecaptureLeadDto | null = BASE_LEAD) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LeadDetailDrawer lead={lead} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHooks();
});

// ── #3a — status selector ─────────────────────────────────────────────────────

describe('LeadDetailDrawer — status selector (#3a)', () => {
  it('D1 — renders a status select with 6 options', () => {
    renderDrawer();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeInTheDocument();

    // Scope to this select to avoid picking up the operator select options
    const { getAllByRole } = within(select.closest('div')!);
    const options = getAllByRole('option');
    const values = options.map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain('nuevo');
    expect(values).toContain('en_gestion');
    expect(values).toContain('contactado');
    expect(values).toContain('interesado');
    expect(values).toContain('recuperado');
    expect(values).toContain('descartado');
    expect(options.length).toBe(6);
  });

  it('D2 — current lead status is pre-selected', () => {
    renderDrawer({ ...BASE_LEAD, status: 'interesado' });
    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('interesado');
  });

  it('D3 — changing status calls useUpdateLeadStatus.mutate with {id, status}', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const select = screen.getByRole('combobox', { name: /estado/i });
    await user.selectOptions(select, 'contactado');

    expect(mutateStatus).toHaveBeenCalledWith({ id: 'lead-42', status: 'contactado' });
  });

  it('D4 — select is disabled while mutation is pending', () => {
    vi.mocked(useUpdateLeadStatus).mockReturnValue({
      mutate: mutateStatus,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useUpdateLeadStatus>);

    renderDrawer();
    const select = screen.getByRole('combobox', { name: /estado/i });
    expect(select).toBeDisabled();
  });

  it('D5 — status selector is NOT rendered when user lacks recapture.manage', () => {
    mockHooks({ can: () => false });
    renderDrawer();
    expect(screen.queryByRole('combobox', { name: /estado/i })).not.toBeInTheDocument();
  });

  it('D5b — status selector + contact form stay under recapture.manage (no assign needed)', () => {
    mockHooks({ can: (p) => p === 'recapture.manage' });
    renderDrawer();
    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar contacto/i })).toBeInTheDocument();
  });
});

// ── #3b — assignee name ───────────────────────────────────────────────────────

describe('LeadDetailDrawer — assignee name (#3b)', () => {
  it('D6 — shows assigneeName in meta grid when present', () => {
    renderDrawer(LEAD_WITH_ASSIGNEE);
    // The name appears in the meta grid value span. It may ALSO appear as the
    // phantom <option> in the operator select (assignee outside the ventas pool),
    // so scope the assertion to the non-option element.
    const matches = screen.getAllByText('María López');
    expect(matches.some((el) => el.tagName !== 'OPTION')).toBe(true);
  });

  it('D7 — shows fallback "—" when assigneeName is null', () => {
    renderDrawer({ ...BASE_LEAD, assigneeId: null, assigneeName: null });
    // The "Asignado" label must be present
    expect(screen.getByText('Asignado')).toBeInTheDocument();
    // And the fallback dash — use getAllByText because other meta fields also use '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('D8 — does NOT render raw assigneeId when assigneeName is provided', () => {
    renderDrawer(LEAD_WITH_ASSIGNEE);
    expect(screen.queryByText('user-99')).not.toBeInTheDocument();
  });
});

// ── #108 — operator reassign select ──────────────────────────────────────────

describe('LeadDetailDrawer — operator select (recapture.assign)', () => {
  it('R1 — renders operator select with RbacUser operators inside recapture.assign gate', () => {
    renderDrawer();
    const select = screen.getByRole('combobox', { name: /operador/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
  });

  it('R2 — pre-selects assigneeId when lead is already assigned', () => {
    // Use a lead assigned to op-1, which is in the mocked admins list
    const leadAssignedToKnownAdmin: RecaptureLeadDto = {
      ...BASE_LEAD,
      assigneeId: 'op-1',
      assigneeName: 'Operador Uno',
      claimedAt: '2026-06-13T10:05:00.000Z',
    };
    renderDrawer(leadAssignedToKnownAdmin);
    const select = screen.getByRole('combobox', { name: /operador/i }) as HTMLSelectElement;
    expect(select.value).toBe('op-1');
  });

  it('R3 — selecting an operator calls assignLead.mutate with { leadId, operatorId }', async () => {
    const user = userEvent.setup();
    renderDrawer();

    const select = screen.getByRole('combobox', { name: /operador/i });
    await user.selectOptions(select, 'op-1');

    expect(mutateAssign).toHaveBeenCalledWith({ leadId: 'lead-42', operatorId: 'op-1' });
  });

  it('R4 — selecting the empty option (unassign) calls assignLead.mutate with operatorId null', async () => {
    const user = userEvent.setup();
    // Use a lead assigned to a known admin so the select renders correctly
    const leadAssignedToKnownAdmin: RecaptureLeadDto = {
      ...BASE_LEAD,
      assigneeId: 'op-1',
      assigneeName: 'Operador Uno',
      claimedAt: '2026-06-13T10:05:00.000Z',
    };
    renderDrawer(leadAssignedToKnownAdmin);

    const select = screen.getByRole('combobox', { name: /operador/i });
    await user.selectOptions(select, '');

    expect(mutateAssign).toHaveBeenCalledWith({ leadId: 'lead-42', operatorId: null });
  });

  it('R5 — select is disabled while assignLead mutation is pending', () => {
    vi.mocked(useAssignLead).mockReturnValue({
      mutate: mutateAssign,
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useAssignLead>);

    renderDrawer();
    const select = screen.getByRole('combobox', { name: /operador/i });
    expect(select).toBeDisabled();
  });

  it('R6 — operator select is NOT rendered when user lacks recapture.assign', () => {
    mockHooks({ can: () => false });
    renderDrawer();
    expect(screen.queryByRole('combobox', { name: /operador/i })).not.toBeInTheDocument();
  });

  it('R7 — operator select is NOT rendered for a manage-only agent (no assign)', () => {
    mockHooks({ can: (p) => p === 'recapture.manage' });
    renderDrawer();
    expect(screen.queryByRole('combobox', { name: /operador/i })).not.toBeInTheDocument();
  });

  it('R8 — fetches the RbacUser pool (enabled) for an actor who can assign', () => {
    renderDrawer();
    expect(useRbacUsers).toHaveBeenCalledWith(true);
  });

  it('R9 — does NOT fetch the RbacUser pool (enabled=false) for a manage-only agent', () => {
    mockHooks({ can: (p) => p === 'recapture.manage' });
    renderDrawer();
    // The agent lacks admin/rbac; GET /admin/rbac/users must stay disabled.
    expect(useRbacUsers).toHaveBeenCalledWith(false);
  });
});

// ── assignable-roles filter on the drawer operator select ─────────────────────

describe('LeadDetailDrawer — operator pool = active + ≥1 role + not technical', () => {
  it('R10 — excludes technicians and role-less users; INCLUDES non-technical roles (admin)', () => {
    mockHooks({ users: [...RBAC_USERS, ADMIN_USER, TECNICO_USER, NO_ROLE_USER] });
    renderDrawer();

    const select = screen.getByRole('combobox', { name: /operador/i });
    // ventas + admin (non-technical) present…
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Admin Solo' })).toBeInTheDocument();
    // …technician and role-less user excluded.
    expect(within(select).queryByRole('option', { name: 'Operador Técnico' })).not.toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Sin Roles' })).not.toBeInTheDocument();
  });

  it('R11 — disabled users (even with a valid role) are excluded from the operator select', () => {
    mockHooks({ users: [...RBAC_USERS, DISABLED_USER] });
    renderDrawer();

    const select = screen.getByRole('combobox', { name: /operador/i });
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Operador Baja' })).not.toBeInTheDocument();
  });

  it('R12 — a lead assigned to a user OUTSIDE the pool (a technician) keeps its assignee (phantom)', () => {
    // The lead is assigned to a technician, who is NOT in the operator pool. The
    // select must STILL reflect the real assignee via a phantom <option> — the
    // filter must not erase the assignment.
    const leadOutsidePool: RecaptureLeadDto = {
      ...BASE_LEAD,
      assigneeId: 'op-tec',
      assigneeName: 'Operador Técnico',
      claimedAt: '2026-06-13T10:05:00.000Z',
    };
    mockHooks({ users: [...RBAC_USERS, TECNICO_USER] });
    renderDrawer(leadOutsidePool);

    const select = screen.getByRole('combobox', { name: /operador/i }) as HTMLSelectElement;
    // value stays on the real assignee even though they are out of pool…
    expect(select.value).toBe('op-tec');
    // …and a phantom option carries their name so the select isn't blank.
    const phantom = within(select).getByRole('option', { name: 'Operador Técnico' }) as HTMLOptionElement;
    expect(phantom.value).toBe('op-tec');
  });

  it('R13 — empty-pool hint surfaces when canAssign but only excluded users exist', () => {
    mockHooks({ users: [TECNICO_USER, NO_ROLE_USER] });
    renderDrawer();
    expect(screen.getByText(/no hay usuarios disponibles para asignar/i)).toBeInTheDocument();
  });

  it('R14 — no empty-pool hint when there IS at least one assignable operator', () => {
    mockHooks({ users: RBAC_USERS });
    renderDrawer();
    expect(screen.queryByText(/no hay usuarios disponibles para asignar/i)).not.toBeInTheDocument();
  });
});

// ── self-take removed ─────────────────────────────────────────────────────────

describe('LeadDetailDrawer — claim/release removed', () => {
  it('C1 — no "Tomar lead" button (admin, unassigned lead)', () => {
    renderDrawer({ ...BASE_LEAD, assigneeId: null });
    expect(screen.queryByRole('button', { name: /tomar lead/i })).not.toBeInTheDocument();
  });

  it('C2 — no "Liberar lead" button (admin, assigned lead)', () => {
    renderDrawer(LEAD_WITH_ASSIGNEE);
    expect(screen.queryByRole('button', { name: /liberar lead/i })).not.toBeInTheDocument();
  });
});

// ── live detail wins over prop snapshot (#recapture-drawer-live) ──────────────

import type { RecaptureLeadDetailDto, MatchedClientSummary } from '@/types/recaptacion';

describe('LeadDetailDrawer — live detail wins over prop snapshot (#recapture-drawer-live)', () => {
  it('L1 — status select reflects detail, not the stale prop (detail wins)', () => {
    // Prop has status 'nuevo'; detail comes back with 'recuperado' after a mutation.
    // The drawer must show 'recuperado' — not 'nuevo'.
    const freshDetail: RecaptureLeadDetailDto = {
      ...BASE_LEAD,
      status: 'recuperado',
      contacts: [],
    };
    vi.mocked(useRecaptacionLead).mockReturnValue({
      data: freshDetail,
      isLoading: false,
    } as ReturnType<typeof useRecaptacionLead>);

    renderDrawer({ ...BASE_LEAD, status: 'nuevo' });

    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('recuperado');
  });

  it('L1b — statusPill text reflects detail when user lacks recapture.manage', () => {
    // Without recapture.manage the pill renders instead of the select.
    mockHooks({ can: () => false });
    const freshDetail: RecaptureLeadDetailDto = {
      ...BASE_LEAD,
      status: 'recuperado',
      contacts: [],
    };
    vi.mocked(useRecaptacionLead).mockReturnValue({
      data: freshDetail,
      isLoading: false,
    } as ReturnType<typeof useRecaptacionLead>);

    renderDrawer({ ...BASE_LEAD, status: 'nuevo' });

    // The pill shows the DETAIL's label, not the stale prop's label.
    expect(screen.getByText('Recuperado')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('L2 — falls back to prop when detail is still loading (no crash)', () => {
    // detail = undefined → view = lead (the prop). No crash, renders prop status.
    vi.mocked(useRecaptacionLead).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useRecaptacionLead>);

    renderDrawer({ ...BASE_LEAD, status: 'interesado' });

    const select = screen.getByRole('combobox', { name: /estado/i }) as HTMLSelectElement;
    expect(select.value).toBe('interesado');
  });

  it('L3 — operator select and meta-grid "Asignado" reflect detail assignee, not prop', () => {
    // Prop: unassigned. Detail: assigned to op-2 (which IS in the ventas pool).
    // After a mutation + invalidation, detail has the new assignee.
    const freshDetail: RecaptureLeadDetailDto = {
      ...BASE_LEAD,
      assigneeId: 'op-2',
      assigneeName: 'Operador Dos',
      contacts: [],
    };
    vi.mocked(useRecaptacionLead).mockReturnValue({
      data: freshDetail,
      isLoading: false,
    } as ReturnType<typeof useRecaptacionLead>);

    // Prop is unassigned
    renderDrawer({ ...BASE_LEAD, assigneeId: null, assigneeName: null });

    // Operator select must reflect the DETAIL's assigneeId
    const opSelect = screen.getByRole('combobox', { name: /operador/i }) as HTMLSelectElement;
    expect(opSelect.value).toBe('op-2');

    // Meta-grid "Asignado" must show the detail's assigneeName (not '—')
    const assignedSection = screen.getByText('Asignado').closest('div')!;
    expect(within(assignedSection).getByText('Operador Dos')).toBeInTheDocument();
  });
});

// ── Possible active-client match section (S13a/S13b, recapture-active-client-match) ──

describe('LeadDetailDrawer — possible active match section (S13a/S13b)', () => {
  function detailWith(overrides: Partial<RecaptureLeadDetailDto> = {}): RecaptureLeadDetailDto {
    return { ...BASE_LEAD, contacts: [], ...overrides };
  }

  function mockDetail(overrides: Partial<RecaptureLeadDetailDto> = {}) {
    vi.mocked(useRecaptacionLead).mockReturnValue({
      data: detailWith(overrides),
      isLoading: false,
    } as ReturnType<typeof useRecaptacionLead>);
  }

  it('MS1 — section absent when possibleActiveMatch is undefined (old cached payload, no crash)', () => {
    mockDetail(); // no possibleActiveMatch key at all
    renderDrawer();
    expect(screen.queryByText('Posible cliente activo')).not.toBeInTheDocument();
  });

  it('MS2 — section absent when signals is an empty array', () => {
    mockDetail({ possibleActiveMatch: { signals: [], matchedClients: [] } });
    renderDrawer();
    expect(screen.queryByText('Posible cliente activo')).not.toBeInTheDocument();
  });

  it('MS3 (S13a) — renders a matched client (name/status/matchedBy) and opens ContractHistoryModal for THAT client id, not the lead\'s own', async () => {
    const user = userEvent.setup();
    mockDetail({
      possibleActiveMatch: {
        signals: ['phone'],
        matchedClients: [
          { clientId: 'c2', name: 'Roberto Diaz', status: 'active', matchedBy: ['phone'] },
        ],
      },
    });
    renderDrawer();

    const section = screen.getByText('Posible cliente activo').closest('section')!;
    expect(within(section).getByText('Roberto Diaz')).toBeInTheDocument();
    // Two "Teléfono" chips render inside this section: the lead-level fired
    // signal AND this client's own matchedBy — both wired to the same label map.
    expect(within(section).getAllByText('Teléfono')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /ver contratos del match/i }));

    // The drawer's own overlay ALSO has role="dialog" (aria-label "Detalle lead: …"),
    // so scope by the contract modal's own accessible name to disambiguate.
    const dialog = await screen.findByRole('dialog', { name: 'Contratos del cliente' });
    // Modal subtitle carries the MATCHED client's name — not the lead's own
    // contactName ('Ana García') — proving clientId routed to c2, not view.clientId.
    expect(within(dialog).getByText('Roberto Diaz')).toBeInTheDocument();
    expect(within(dialog).queryByText('Ana García')).not.toBeInTheDocument();
  });

  it('MS4 (S13b) — churn_reason with no matched client shows the flag, no per-match contracts button', () => {
    mockDetail({
      possibleActiveMatch: { signals: ['churn_reason'], matchedClients: [] },
    });
    renderDrawer();

    expect(screen.getByText('Posible cliente activo')).toBeInTheDocument();
    expect(screen.getByText('Motivo de baja: cambio de titularidad')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver contratos del match/i })).not.toBeInTheDocument();
  });

  it('MS5 — two matched clients each render their own name + a working contracts trigger (dedup/cardinality)', async () => {
    const user = userEvent.setup();
    mockDetail({
      possibleActiveMatch: {
        signals: ['phone', 'email'],
        matchedClients: [
          { clientId: 'c2', name: 'Roberto Diaz', status: 'active', matchedBy: ['phone'] },
          { clientId: 'c3', name: 'Lucia Fernandez', status: 'active', matchedBy: ['email'] },
        ],
      },
    });
    renderDrawer();

    expect(screen.getByText('Roberto Diaz')).toBeInTheDocument();
    expect(screen.getByText('Lucia Fernandez')).toBeInTheDocument();
    const triggers = screen.getAllByRole('button', { name: /ver contratos del match/i });
    expect(triggers).toHaveLength(2);

    await user.click(triggers[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Contratos del cliente' });
    expect(within(dialog).getByText('Lucia Fernandez')).toBeInTheDocument();
  });

  it('MS6 — the lead\'s own "Ver contratos" button is unaffected by an active match section', async () => {
    const user = userEvent.setup();
    mockDetail({
      possibleActiveMatch: {
        signals: ['phone'],
        matchedClients: [
          { clientId: 'c2', name: 'Roberto Diaz', status: 'active', matchedBy: ['phone'] },
        ],
      },
    });
    renderDrawer();

    await user.click(screen.getByRole('button', { name: /^ver contratos$/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Contratos del cliente' });
    // The lead's own contact name shows — not the matched client's.
    expect(within(dialog).getByText('Ana García')).toBeInTheDocument();
  });

  // ── Review findings hardening (recapture-active-client-match FE fix wave) ──

  it('MS7 — matchedBy chip falls back to the raw signal string for an out-of-contract value', () => {
    // `matchedBy` is typed as ('phone'|'email'|'reactivated')[], but the BE
    // wire payload isn't runtime-validated against that union. Simulate a
    // rogue value via a cast (prod types stay strict) and assert the chip
    // renders the raw string instead of an empty label.
    mockDetail({
      possibleActiveMatch: {
        signals: ['phone'],
        matchedClients: [
          {
            clientId: 'c2',
            name: 'Roberto Diaz',
            status: 'active',
            matchedBy: ['phone', 'weird_signal'] as unknown as MatchedClientSummary['matchedBy'],
          },
        ],
      },
    });
    renderDrawer();

    const section = screen.getByText('Posible cliente activo').closest('section')!;
    expect(within(section).getByText('weird_signal')).toBeInTheDocument();
  });

  it('MS8 — a malformed possibleActiveMatch without signals/matchedClients degrades to section-absent (no crash)', () => {
    // TS promises `{ signals, matchedClients }` are always present, but a
    // malformed cached/legacy payload could omit both at runtime. Cast past
    // the compiler in the fixture to simulate that and assert the component
    // degrades gracefully instead of throwing on `.length`.
    mockDetail({
      possibleActiveMatch: {} as unknown as RecaptureLeadDetailDto['possibleActiveMatch'],
    });

    expect(() => renderDrawer()).not.toThrow();
    expect(screen.queryByText('Posible cliente activo')).not.toBeInTheDocument();
  });
});

// ── contractsClientId resets on lead change (hardening) ───────────────────────

describe('LeadDetailDrawer — contractsClientId resets when the lead prop changes', () => {
  it('H1 — modal closes/state resets when a different lead is rendered while it was open', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <LeadDetailDrawer lead={BASE_LEAD} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /^ver contratos$/i }));
    expect(await screen.findByRole('dialog', { name: 'Contratos del cliente' })).toBeInTheDocument();

    const otherLead: RecaptureLeadDto = {
      ...BASE_LEAD,
      id: 'lead-99',
      clientId: 'client-2',
      contactName: 'Otro Contacto',
    };

    rerender(
      <QueryClientProvider client={qc}>
        <LeadDetailDrawer lead={otherLead} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    // The modal must NOT still be showing the previous lead's client — the
    // safe behavior is closed/reset, never carried over to the new lead.
    expect(screen.queryByRole('dialog', { name: 'Contratos del cliente' })).not.toBeInTheDocument();
  });
});
