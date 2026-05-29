import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as AdminPage } from '@/pages/system/AdminPage';
import * as useAdminsModule from '@/hooks/useAdmins';
import type { Admin, AdminActivityLog, Admin2FA } from '@/types/admin';
import type { AdminRole_Definition } from '@/types/role';

// ── RbacUsers/RbacRoles hooks — mocked so RbacUsersBody (admins tab) renders ─
vi.mock('@/hooks/useRbacUsers', () => ({
  useRbacUsers: vi.fn(),
  useCreateRbacUser: vi.fn(),
  useUpdateRbacUser: vi.fn(),
  useDeleteRbacUser: vi.fn(),
  useSetUserRoles: vi.fn(),
}));
vi.mock('@/hooks/useRbacRoles', () => ({
  useRbacRoles: vi.fn(),
}));

import {
  useRbacUsers,
  useCreateRbacUser,
  useUpdateRbacUser,
  useDeleteRbacUser,
  useSetUserRoles,
} from '@/hooks/useRbacUsers';
import { useRbacRoles } from '@/hooks/useRbacRoles';

vi.mock('@/hooks/useAdmins');

const mockRoles: AdminRole_Definition[] = [
  {
    id: '1',
    name: 'superadmin',
    description: 'Acceso total',
    isSystem: true,
    permissions: [{ module: 'clients', actions: ['read', 'write', 'delete'] }],
  },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockAdmins: Admin[] = [
  {
    id: '1',
    name: 'Super Admin',
    email: 'admin@ipnext.com.ar',
    role: 'superadmin',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2026-04-28T07:00:00Z',
  },
  {
    id: '2',
    name: 'Carlos López',
    email: 'carlos@ipnext.com.ar',
    role: 'admin',
    status: 'active',
    createdAt: '2024-03-15T00:00:00Z',
    lastLogin: '2026-04-27T15:30:00Z',
  },
  {
    id: '3',
    name: 'María Fernández',
    email: 'maria@ipnext.com.ar',
    role: 'viewer',
    status: 'inactive',
    createdAt: '2024-06-01T00:00:00Z',
    lastLogin: null,
  },
];

const mockActivityLog: AdminActivityLog[] = [
  {
    id: 'log-1',
    adminId: '1',
    adminName: 'Super Admin',
    category: 'auth',
    action: 'Inicio de sesión',
    details: 'Sesión iniciada desde IP 192.168.1.1',
    ip: '192.168.1.1',
    timestamp: '2026-04-28T07:00:00Z',
  },
  {
    id: 'log-2',
    adminId: '2',
    adminName: 'Carlos López',
    category: 'clients',
    action: 'Creó cliente',
    details: 'Creó cliente ID 1001',
    ip: '192.168.1.20',
    timestamp: '2026-04-27T16:00:00Z',
  },
];

const mockMutate = vi.fn();
const mockUpdateMutate = vi.fn();

const idleRbacMutation = { mutateAsync: vi.fn(), isPending: false };

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAdminsModule.useAdmins).mockReturnValue({
      data: mockAdmins,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdmins>);

    vi.mocked(useAdminsModule.useAdminActivityLog).mockReturnValue({
      data: mockActivityLog,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdminActivityLog>);

    vi.mocked(useAdminsModule.useCreateAdmin).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useCreateAdmin>);

    vi.mocked(useAdminsModule.useUpdateAdmin).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useUpdateAdmin>);

    vi.mocked(useAdminsModule.useDeleteAdmin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useDeleteAdmin>);

    vi.mocked(useAdminsModule.useRoles).mockReturnValue({
      data: mockRoles,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useRoles>);

    vi.mocked(useAdminsModule.useCreateRole).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useCreateRole>);

    vi.mocked(useAdminsModule.useUpdateRole).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useUpdateRole>);

    vi.mocked(useAdminsModule.useAdmin2FAStatus).mockReturnValue({
      data: { adminId: '1', enabled: false, method: null, backupCodesCount: 0, enabledAt: null, lastUsedAt: null } as Admin2FA,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdmin2FAStatus>);

    vi.mocked(useAdminsModule.useEnable2FA).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useEnable2FA>);

    vi.mocked(useAdminsModule.useDisable2FA).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useDisable2FA>);

    // ── RbacUsersBody (replaces admins tab content) ─────────────────────────
    vi.mocked(useRbacUsers).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);
    vi.mocked(useRbacRoles).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useRbacRoles>);
    vi.mocked(useCreateRbacUser).mockReturnValue(idleRbacMutation as unknown as ReturnType<typeof useCreateRbacUser>);
    vi.mocked(useUpdateRbacUser).mockReturnValue(idleRbacMutation as unknown as ReturnType<typeof useUpdateRbacUser>);
    vi.mocked(useDeleteRbacUser).mockReturnValue(idleRbacMutation as unknown as ReturnType<typeof useDeleteRbacUser>);
    vi.mocked(useSetUserRoles).mockReturnValue(idleRbacMutation as unknown as ReturnType<typeof useSetUserRoles>);
  });

  it('renders "Usuarios" tab button (previously "Administradores")', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('renders "Actividad" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Actividad' })).toBeInTheDocument();
  });

  it('renders RbacUsersBody heading "Usuarios" in the admins tab (h2)', () => {
    renderPage();
    // The RbacUsersBody renders an h2 "Usuarios" heading (level 2)
    expect(screen.getByRole('heading', { name: /^usuarios$/i, level: 2 })).toBeInTheDocument();
  });

  it('renders "Nuevo usuario" button in admins tab', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument();
  });

  it('clicking "Nuevo usuario" shows RbacUserModal', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /nuevo usuario/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/login/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('admins tab shows empty state when no users', () => {
    renderPage();
    expect(screen.getByText(/no hay usuarios/i)).toBeInTheDocument();
  });

  it('clicking "Actividad" tab shows activity log table', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument();
    expect(screen.getByText('Creó cliente')).toBeInTheDocument();
  });

  it('activity log table shows "Administrador" and "Acción" columns', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByRole('columnheader', { name: 'Administrador' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Acción' })).toBeInTheDocument();
  });

  it('renders "Roles y Permisos" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /roles y permisos/i })).toBeInTheDocument();
  });

  it('switching to Roles tab shows role list', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    // The roles panel should be visible
    expect(screen.getByText('superadmin')).toBeInTheDocument();
  });

  it('role list shows at least one role name from mock', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    expect(screen.getByText('superadmin')).toBeInTheDocument();
  });

  it('Activity tab shows category filter tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    const filterContainer = screen.getByTestId('category-filter-tabs');
    expect(filterContainer).toBeInTheDocument();
  });

  it('Category filter shows "Todos" option', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
  });

  it('DataTable has "Categoría" column', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByRole('columnheader', { name: 'Categoría' })).toBeInTheDocument();
  });

  it('admins tab does not show legacy "2FA" column (replaced by RbacUsersBody)', () => {
    renderPage();
    // The new RbacUsersBody table does not have a "2FA" column
    expect(screen.queryByRole('columnheader', { name: '2FA' })).toBeNull();
  });

  it('admins tab "Editar" button opens RbacUserModal pre-filled with user data', async () => {
    const user = userEvent.setup();
    // Set up one RBAC user so Editar buttons appear
    const rbacUser = {
      id: 'u1',
      name: 'Super Admin',
      email: 'admin@ipnext.com.ar',
      login: 'superadmin',
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      lastLoginAt: null,
      roles: [{ id: 'r1', code: 'super_admin', label: 'Super Admin', isSystem: true }],
    };
    vi.mocked(useRbacUsers).mockReturnValue({
      data: [rbacUser],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);

    renderPage();

    const editButtons = screen.getAllByRole('button', { name: 'Editar' });
    await user.click(editButtons[0]);

    const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Super Admin');
  });

  // Batch 1 — new tests

  it('admins tab renders table headings from RbacUsersBody', () => {
    // RbacUsersBody table has: Nombre, Email, Login, Roles, Estado, Última sesión, Acciones
    renderPage();
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Roles' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
  });

  it('Activity tab has "Desde" date input', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
  });

  it('Activity tab has "Hasta" date input', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Actividad' }));

    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  });

  it('Roles tab "Guardar cambios" button calls onSave when non-system role selected', async () => {
    const user = userEvent.setup();
    const updateRoleMutate = vi.fn();
    vi.mocked(useAdminsModule.useUpdateRole).mockReturnValue({
      mutate: updateRoleMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useUpdateRole>);

    // Override roles with a non-system role
    const editableRole: AdminRole_Definition = {
      id: 'r2',
      name: 'editor',
      description: 'Puede editar',
      isSystem: false,
      permissions: [{ module: 'clients', actions: ['read'] }],
    };
    vi.mocked(useAdminsModule.useRoles).mockReturnValue({
      data: [editableRole],
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useRoles>);

    renderPage();
    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    // Click the editable role
    const roleItem = screen.getByText('editor');
    await user.click(roleItem);

    // Click save
    const saveBtn = screen.getByRole('button', { name: 'Guardar cambios' });
    await user.click(saveBtn);

    // updateRole mutate should have been called
    expect(updateRoleMutate).toHaveBeenCalled();
  });

  // Batch 2 — Seguridad + Sesiones tabs

  it('renders "Seguridad" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Seguridad' })).toBeInTheDocument();
  });

  it('renders "Sesiones" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Sesiones' })).toBeInTheDocument();
  });

  it('switching to Seguridad tab shows "Política de contraseñas" section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Seguridad' }));

    expect(screen.getByText('Política de contraseñas')).toBeInTheDocument();
  });

  it('Seguridad tab shows "Política 2FA" section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Seguridad' }));

    expect(screen.getByText('Política 2FA')).toBeInTheDocument();
  });

  it('Seguridad tab shows "IP Whitelist" section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Seguridad' }));

    expect(screen.getByText('IP Whitelist')).toBeInTheDocument();
  });

  it('Seguridad tab shows min password length input', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Seguridad' }));

    expect(screen.getByLabelText(/longitud mínima/i)).toBeInTheDocument();
  });

  it('switching to Sesiones tab shows "Sesiones activas" heading', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(screen.getByText('Sesiones activas')).toBeInTheDocument();
  });

  it('Sesiones tab shows "Historial de acceso" section', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(screen.getByText('Historial de acceso')).toBeInTheDocument();
  });

  it('Sesiones tab shows session config duration field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(screen.getByLabelText(/duración máxima/i)).toBeInTheDocument();
  });
});
