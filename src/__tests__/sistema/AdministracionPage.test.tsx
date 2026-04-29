import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as AdministracionPage } from '@/pages/sistema/AdministracionPage';
import * as useAdminsModule from '@/hooks/useAdmins';
import type { Admin, AdminActivityLog, Admin2FA } from '@/types/admin';
import type { AdminRole_Definition } from '@/types/role';

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

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <AdministracionPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdministracionPage', () => {
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
  });

  it('renders "Administradores" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Administradores' })).toBeInTheDocument();
  });

  it('renders "Actividad" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Actividad' })).toBeInTheDocument();
  });

  it('renders admins table with seeded data', () => {
    renderPage();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
    expect(screen.getByText('María Fernández')).toBeInTheDocument();
  });

  it('renders "Nuevo administrador" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Nuevo administrador' })).toBeInTheDocument();
  });

  it('clicking "Nuevo administrador" shows form with Nombre, Email, Rol fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nuevo administrador' }));

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol')).toBeInTheDocument();
  });

  it('submitting the form calls createAdmin mutate', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Nuevo administrador' }));

    await user.type(screen.getByLabelText('Nombre'), 'Nuevo Admin');
    await user.type(screen.getByLabelText('Email'), 'nuevo@test.com');

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nuevo Admin', email: 'nuevo@test.com' })
    );
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

  it('Admin table has "2FA" column', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: '2FA' })).toBeInTheDocument();
  });

  it('2FA badge shows status from mock', () => {
    vi.mocked(useAdminsModule.useAdmin2FAStatus).mockReturnValue({
      data: { adminId: '1', enabled: false, method: null, backupCodesCount: 0, enabledAt: null, lastUsedAt: null } as Admin2FA,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdmin2FAStatus>);

    renderPage();
    const badges = screen.getAllByText('Deshabilitado');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('Clicking "Editar" on a row shows form pre-filled with admin name', async () => {
    const user = userEvent.setup();
    renderPage();

    // Click the first KebabMenu trigger (Acciones button) for Super Admin row
    const kebabButtons = screen.getAllByRole('button', { name: 'Acciones' });
    await user.click(kebabButtons[0]);

    // Click "Editar" from the dropdown
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    // Form should appear pre-filled with "Super Admin"
    const nameInput = screen.getByLabelText('Nombre') as HTMLInputElement;
    expect(nameInput.value).toBe('Super Admin');
  });

  // Batch 1 — new tests

  it('Admins tab has a search input with placeholder "Buscar por nombre o email..."', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Buscar por nombre o email...')).toBeInTheDocument();
  });

  it('Admins search filters list by name', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o email...');
    await user.type(searchInput, 'Carlos');

    // Wait for debounce
    await new Promise(r => setTimeout(r, 350));

    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();
  });

  it('Admins search filters list by email', async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar por nombre o email...');
    await user.type(searchInput, 'maria@');

    await new Promise(r => setTimeout(r, 350));

    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
    expect(screen.getByText('María Fernández')).toBeInTheDocument();
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
