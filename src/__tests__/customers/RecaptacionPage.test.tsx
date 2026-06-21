/**
 * RecaptacionPage — tests for:
 *   source tabs (CSV / Bajas)
 *   admin multi-select + bulk-assign toolbar (recapture.assign)
 *   agent view has no admin surface (manage, no assign)
 *   re-gated ingest / CSV / assignment filter to recapture.assign
 *   self-take ("Tomar siguiente") removed
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useRecaptacion', () => ({
  useRecaptacionLeads:       vi.fn(),
  useIngestChurned:          vi.fn(),
  useAddContact:             vi.fn(),
  useUpdateLeadStatus:       vi.fn(),
  useAssignLead:             vi.fn(),
  useAssignBulk:             vi.fn(),
  useRecaptacionLead:        vi.fn(),
  useImportCsvLeads:         vi.fn(),
  downloadRecaptureCsvTemplate: vi.fn(),
}));

vi.mock('@/api/recaptacion.api', () => ({
  listRecaptureLeads:     vi.fn(),
  importCsvLeads:         vi.fn(),
  downloadCsvTemplate:    vi.fn(),
}));

vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(),
}));

import {
  useRecaptacionLeads,
  useIngestChurned,
  useImportCsvLeads,
  useAssignBulk,
  useAssignLead,
} from '@/hooks/useRecaptacion';
import { useRbacUsers } from '@/hooks/useRbacUsers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import RecaptacionPage from '@/pages/customers/RecaptacionPage';
import type { RecaptureLeadsQuery, RecaptureLeadDto } from '@/types/recaptacion';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

// ── Helpers ───────────────────────────────────────────────────────────────────

const lead = (id: string): RecaptureLeadDto => ({
  id,
  source: 'churned_client',
  clientId: null,
  contactName: `Lead ${id}`,
  phone: null,
  email: null,
  status: 'nuevo',
  assigneeId: null,
  assigneeName: null,
  claimedAt: null,
  createdAt: '2026-06-13T00:00:00Z',
  updatedAt: '2026-06-13T00:00:00Z',
});

// Sales role — only users carrying this role can be assignees in Recaptación.
const VENTAS_ROLE: RbacRoleDto = { id: 'role-ventas', code: 'ventas', label: 'Ventas', isSystem: true };
// A non-sales system role used to prove non-ventas users are excluded.
const ADMIN_ROLE: RbacRoleDto = { id: 'role-admin', code: 'administrador', label: 'Administrador', isSystem: true };

// Operators come from RbacUser (GET /admin/rbac/users) — NOT the Admin table.
// Only users with the 'ventas' role belong in the assignee pool.
const RBAC_USERS: RbacUserWithRolesDto[] = [
  { id: 'op-1', name: 'Operador Uno', email: 'op1@test.com', login: 'op1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [VENTAS_ROLE] },
  { id: 'op-2', name: 'Operador Dos', email: 'op2@test.com', login: 'op2', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [VENTAS_ROLE] },
];

// A disabled RbacUser (with ventas role) — must NEVER show up in the operator
// pool (inline or bulk) because they are not active.
const DISABLED_USER: RbacUserWithRolesDto = {
  id: 'op-off', name: 'Operador Baja', email: 'off@test.com', login: 'off', status: 'disabled', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [VENTAS_ROLE],
};

// An active RbacUser WITHOUT the ventas role — must be excluded from the pool.
const NO_VENTAS_USER: RbacUserWithRolesDto = {
  id: 'op-noventas', name: 'Sin Ventas', email: 'nv@test.com', login: 'nv', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [],
};

// An active admin WITHOUT the ventas role — must be excluded from the pool.
const ADMIN_NO_VENTAS_USER: RbacUserWithRolesDto = {
  id: 'op-admin', name: 'Admin Solo', email: 'adm@test.com', login: 'adm', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', lastLoginAt: null, roles: [ADMIN_ROLE],
};

const EMPTY_RESULT = { data: [], total: 0, page: 1, limit: 25 };

/** Permission stub. `perms` is the granted set; '*' grants everything. */
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

const bulkMutateAsync = vi.fn().mockResolvedValue({ assigned: 0 });
const singleMutateAsync = vi.fn().mockResolvedValue({ id: 'lead-x' });

function mockHooks(opts?: { leads?: RecaptureLeadDto[]; rbacUsers?: RbacUserWithRolesDto[] }) {
  let capturedQuery: RecaptureLeadsQuery = {};
  const leads = opts?.leads ?? [];
  const rbacUsers = opts?.rbacUsers ?? RBAC_USERS;

  vi.mocked(useRecaptacionLeads).mockImplementation((q) => {
    capturedQuery = q;
    return {
      data: { ...EMPTY_RESULT, data: leads, total: leads.length },
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRecaptacionLeads>;
  });

  vi.mocked(useIngestChurned).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    isPending: false,
  } as unknown as ReturnType<typeof useIngestChurned>);

  vi.mocked(useImportCsvLeads).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({ created: 0, errors: [] }),
    isPending: false,
    isError: false,
    data: undefined,
  } as unknown as ReturnType<typeof useImportCsvLeads>);

  vi.mocked(useAssignBulk).mockReturnValue({
    mutateAsync: bulkMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useAssignBulk>);

  vi.mocked(useAssignLead).mockReturnValue({
    mutateAsync: singleMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useAssignLead>);

  vi.mocked(useRbacUsers).mockReturnValue({
    data: rbacUsers,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useRbacUsers>);

  return { getCapturedQuery: () => capturedQuery };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RecaptacionPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  bulkMutateAsync.mockResolvedValue({ assigned: 0 });
  singleMutateAsync.mockResolvedValue({ id: 'lead-x' });
  mockPerms(['*']); // admin by default
});

// ── source tabs ─────────────────────────────────────────────────────────────

describe('RecaptacionPage — source tabs', () => {
  it('P1 — renders both "Bajas" and "CSV" tabs', () => {
    mockHooks();
    renderPage();
    expect(screen.getByRole('button', { name: 'Bajas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument();
  });

  it('P2 — default tab is "Bajas" and query receives source=churned_client', () => {
    const { getCapturedQuery } = mockHooks();
    renderPage();
    expect(getCapturedQuery().source).toBe('churned_client');
  });

  it('P3 — clicking "CSV" sets source=csv in the query', async () => {
    const user = userEvent.setup();
    const { getCapturedQuery } = mockHooks();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() => expect(getCapturedQuery().source).toBe('csv'));
  });
});

// ── self-take removed ─────────────────────────────────────────────────────────

describe('RecaptacionPage — self-take removed', () => {
  it('ST1 — no "Tomar siguiente" button for admin', () => {
    mockHooks();
    renderPage();
    expect(screen.queryByRole('button', { name: /tomar siguiente/i })).not.toBeInTheDocument();
  });

  it('ST2 — no "Tomar siguiente" button for agent', () => {
    mockPerms(['recapture.read', 'recapture.manage']);
    mockHooks();
    renderPage();
    expect(screen.queryByRole('button', { name: /tomar siguiente/i })).not.toBeInTheDocument();
  });
});

// ── admin surface gated by recapture.assign ───────────────────────────────────

describe('RecaptacionPage — admin (recapture.assign)', () => {
  beforeEach(() => mockPerms(['recapture.read', 'recapture.manage', 'recapture.assign']));

  it('A1 — shows selection checkboxes', () => {
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();
    expect(screen.getByLabelText('Seleccionar todos')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar fila a')).toBeInTheDocument();
  });

  it('A2 — shows the bulk toolbar after selecting a lead', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    expect(screen.queryByRole('region', { name: /asignación masiva/i })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Seleccionar fila a'));
    expect(await screen.findByRole('region', { name: /asignación masiva/i })).toBeInTheDocument();
    expect(screen.getByText(/1 seleccionados/i)).toBeInTheDocument();
  });

  it('A3 — Asignar calls useAssignBulk with selected ids + operatorId', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    await user.click(screen.getByLabelText('Seleccionar fila b'));
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'op-1');
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(bulkMutateAsync).toHaveBeenCalledWith({ leadIds: ['a', 'b'], operatorId: 'op-1' });
  });

  it('A4 — success toasts the returned assigned count and clears selection', async () => {
    const user = userEvent.setup();
    bulkMutateAsync.mockResolvedValue({ assigned: 2 });
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    await user.click(screen.getByLabelText('Seleccionar fila b'));
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'op-1');
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(await screen.findByText(/2/)).toBeInTheDocument();
    // selection cleared → toolbar gone
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /asignación masiva/i })).not.toBeInTheDocument(),
    );
  });

  it('A5 — shows Ingestar bajas, Importar CSV, and the Asignación filter', () => {
    mockHooks();
    renderPage();
    expect(screen.getByRole('button', { name: /ingestar bajas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar csv/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /asignación/i })).toBeInTheDocument();
  });

  it('A6 — changing the source tab clears the selection', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    expect(await screen.findByRole('region', { name: /asignación masiva/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CSV' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /asignación masiva/i })).not.toBeInTheDocument(),
    );
  });

  it('A7 — operator options come from RbacUser (the assignees pool)', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    const select = await screen.findByRole('combobox', { name: /asignar a/i });
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
  });

  it('A8 — fetches the RbacUser pool (enabled) for an admin who can assign', () => {
    mockHooks();
    renderPage();
    expect(useRbacUsers).toHaveBeenCalledWith(true);
  });

  it('A10 — disabled RbacUsers are excluded from the bulk-assign operator pool', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a')], rbacUsers: [...RBAC_USERS, DISABLED_USER] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    const select = await screen.findByRole('combobox', { name: /asignar a/i });
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    // The disabled user must NOT be assignable.
    expect(within(select).queryByRole('option', { name: 'Operador Baja' })).not.toBeInTheDocument();
  });

  it('A11 — disabled RbacUsers are excluded from the inline-assign operator pool', () => {
    mockHooks({ leads: [lead('a')], rbacUsers: [...RBAC_USERS, DISABLED_USER] });
    renderPage();

    const select = screen.getByRole('combobox', { name: /asignar lead lead a/i });
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Operador Baja' })).not.toBeInTheDocument();
  });

  it('A12 — active users WITHOUT the ventas role are excluded from the bulk pool', async () => {
    const user = userEvent.setup();
    mockHooks({
      leads: [lead('a')],
      rbacUsers: [...RBAC_USERS, NO_VENTAS_USER, ADMIN_NO_VENTAS_USER],
    });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    const select = await screen.findByRole('combobox', { name: /asignar a/i });
    // ventas users present…
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
    // …non-ventas active user and admin-without-ventas excluded.
    expect(within(select).queryByRole('option', { name: 'Sin Ventas' })).not.toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Admin Solo' })).not.toBeInTheDocument();
  });

  it('A13 — active users WITHOUT the ventas role are excluded from the inline pool', () => {
    mockHooks({
      leads: [lead('a')],
      rbacUsers: [...RBAC_USERS, NO_VENTAS_USER, ADMIN_NO_VENTAS_USER],
    });
    renderPage();

    const select = screen.getByRole('combobox', { name: /asignar lead lead a/i });
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Sin Ventas' })).not.toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: 'Admin Solo' })).not.toBeInTheDocument();
  });

  it('A14 — a lead assigned to a user OUTSIDE the ventas pool still shows their name (phantom intact)', () => {
    // The lead is assigned to an admin who lacks the ventas role, so they are NOT
    // in the operator pool. The inline select must still reflect the real
    // assignee via the phantom <option> — the filter must not erase history.
    mockHooks({
      leads: [{ ...lead('a'), assigneeId: 'op-admin', assigneeName: 'Admin Solo' }],
      rbacUsers: [...RBAC_USERS, ADMIN_NO_VENTAS_USER],
    });
    renderPage();

    const select = screen.getByRole('combobox', { name: /asignar lead lead a/i }) as HTMLSelectElement;
    // The phantom keeps the real assignee visible even though they're out of pool.
    expect(select.value).toBe('op-admin');
    const phantom = within(select).getByRole('option', { name: 'Admin Solo' }) as HTMLOptionElement;
    expect(phantom.value).toBe('op-admin');
  });

  it('A9 — bulk-assign failure shows an error toast and keeps the selection', async () => {
    const user = userEvent.setup();
    bulkMutateAsync.mockRejectedValue(new Error('boom'));
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'op-1');
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    // Error toast surfaces…
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo completar la asignación/i);
    // …and the selection is NOT cleared (toolbar stays so the admin can retry).
    expect(screen.getByRole('region', { name: /asignación masiva/i })).toBeInTheDocument();
  });
});

// ── inline single-assign (column "Asignado") ─────────────────────────────────

describe('RecaptacionPage — inline single-assign', () => {
  beforeEach(() => mockPerms(['recapture.read', 'recapture.manage', 'recapture.assign']));

  it('IS1 — changing the inline select fires useAssignLead with (leadId, operatorId) and toasts success', async () => {
    const user = userEvent.setup();
    mockHooks({ leads: [lead('a')] });
    renderPage();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /asignar lead lead a/i }),
      'op-1',
    );

    expect(singleMutateAsync).toHaveBeenCalledWith({ leadId: 'a', operatorId: 'op-1' });
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('IS2 — choosing "— Sin asignar —" fires with operatorId null', async () => {
    const user = userEvent.setup();
    mockHooks({
      leads: [{ ...lead('a'), assigneeId: 'op-1', assigneeName: 'Operador Uno' }],
    });
    renderPage();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /asignar lead lead a/i }),
      '',
    );

    expect(singleMutateAsync).toHaveBeenCalledWith({ leadId: 'a', operatorId: null });
  });

  it('IS3 — single-assign failure surfaces an error toast', async () => {
    const user = userEvent.setup();
    singleMutateAsync.mockRejectedValue(new Error('boom'));
    mockHooks({ leads: [lead('a')] });
    renderPage();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /asignar lead lead a/i }),
      'op-1',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo asignar/i);
  });
});

// ── reload button removed ─────────────────────────────────────────────────────

describe('RecaptacionPage — reload button removed', () => {
  it('RB1 — no "Recargar" button for admin', () => {
    mockHooks();
    renderPage();
    expect(screen.queryByRole('button', { name: /recargar/i })).not.toBeInTheDocument();
  });

  it('RB2 — no "Recargar" button for agent', () => {
    mockPerms(['recapture.read', 'recapture.manage']);
    mockHooks();
    renderPage();
    expect(screen.queryByRole('button', { name: /recargar/i })).not.toBeInTheDocument();
  });
});

// ── multi-select hint ─────────────────────────────────────────────────────────

describe('RecaptacionPage — multi-select hint', () => {
  it('MH1 — admin with no selection sees the hint', () => {
    mockPerms(['recapture.read', 'recapture.manage', 'recapture.assign']);
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();
    expect(screen.getByText(/asignarlos en lote/i)).toBeInTheDocument();
  });

  it('MH2 — hint disappears once a lead is selected, toolbar appears', async () => {
    const user = userEvent.setup();
    mockPerms(['recapture.read', 'recapture.manage', 'recapture.assign']);
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();

    await user.click(screen.getByLabelText('Seleccionar fila a'));

    await waitFor(() =>
      expect(screen.queryByText(/asignarlos en lote/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('region', { name: /asignación masiva/i })).toBeInTheDocument();
  });

  it('MH3 — agent does NOT see the hint', () => {
    mockPerms(['recapture.read', 'recapture.manage']);
    mockHooks({ leads: [lead('a')] });
    renderPage();
    expect(screen.queryByText(/asignarlos en lote/i)).not.toBeInTheDocument();
  });
});

// ── agent surface (manage, no assign) ─────────────────────────────────────────

describe('RecaptacionPage — agent (manage, no assign)', () => {
  beforeEach(() => mockPerms(['recapture.read', 'recapture.manage']));

  it('AG1 — no selection checkboxes', () => {
    mockHooks({ leads: [lead('a'), lead('b')] });
    renderPage();
    expect(screen.queryByLabelText('Seleccionar todos')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Seleccionar fila/)).not.toBeInTheDocument();
  });

  it('AG2 — no Ingestar bajas / Importar CSV', () => {
    mockHooks();
    renderPage();
    expect(screen.queryByRole('button', { name: /ingestar bajas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /importar csv/i })).not.toBeInTheDocument();
  });

  it('AG3 — no Asignación filter, but the Estado filter is present', () => {
    mockHooks();
    renderPage();
    expect(screen.queryByRole('combobox', { name: /asignación/i })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /estado/i })).toBeInTheDocument();
  });

  it('AG4 — still renders the lead list', () => {
    mockHooks({ leads: [lead('a')] });
    renderPage();
    expect(screen.getByText('Lead a')).toBeInTheDocument();
  });

  it('AG5 — does NOT fetch the RbacUser pool (enabled=false) for an agent who cannot assign', () => {
    mockHooks();
    renderPage();
    // The agent lacks admin/rbac; GET /admin/rbac/users must stay disabled.
    expect(useRbacUsers).toHaveBeenCalledWith(false);
  });
});
