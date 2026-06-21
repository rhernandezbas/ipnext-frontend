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

import {
  useRecaptacionLead,
  useAddContact,
  useUpdateLeadStatus,
  useAssignLead,
} from '@/hooks/useRecaptacion';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

import { LeadDetailDrawer } from '@/pages/customers/RecaptacionPage/components/LeadDetailDrawer';
import type { RecaptureLeadDto } from '@/types/recaptacion';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';

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

// Assignee pool comes from RbacUser (GET /admin/rbac/users), NOT the Admin table.
const RBAC_USERS: RbacUserWithRolesDto[] = [
  { id: 'op-1', name: 'Operador Uno', email: 'op1@test.com', login: 'op1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [] },
  { id: 'op-2', name: 'Operador Dos', email: 'op2@test.com', login: 'op2', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [] },
];

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
    expect(screen.getByText('María López')).toBeInTheDocument();
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
