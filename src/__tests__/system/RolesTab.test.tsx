/**
 * Integration tests for the Roles & Permissions tab in AdminPage.
 * Verifies that the new RolesMatrixBody is wired up correctly.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as AdminPage } from '@/pages/system/AdminPage';
import * as useAdminsModule from '@/hooks/useAdmins';
import type { Admin, AdminActivityLog, Admin2FA } from '@/types/admin';

vi.mock('@/hooks/useAdmins');

// Mock the RBAC hooks used by RolesMatrixBody sub-components
vi.mock('@/hooks/useRbacRoles', () => ({
  useRbacRoles: vi.fn(() => ({
    data: [
      { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
      { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
    ],
    isLoading: false,
    isSuccess: true,
  })),
  useCreateRbacRole: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteRbacRole: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/useRbacPermissions', () => ({
  useRbacPermissions: vi.fn(() => ({
    permissions: [],
    modules: [
      {
        moduleId: 'm1',
        moduleCode: 'clients',
        moduleLabel: 'Clientes',
        actions: ['read', 'write'],
        actionToId: { read: 'p1', write: 'p2' },
      },
    ],
    isLoading: false,
    isSuccess: true,
    isError: false,
  })),
}));

vi.mock('@/hooks/useRolePermissions', () => ({
  useRolePermissions: vi.fn(() => ({ data: undefined, isLoading: false, isSuccess: false })),
  useSetRolePermissions: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

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
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Roles y Permisos tab (RolesMatrixBody)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAdminsModule.useAdmins).mockReturnValue({
      data: mockAdmins,
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdmins>);

    vi.mocked(useAdminsModule.useAdminActivityLog).mockReturnValue({
      data: [] as AdminActivityLog[],
      isLoading: false,
    } as ReturnType<typeof useAdminsModule.useAdminActivityLog>);

    vi.mocked(useAdminsModule.useCreateAdmin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useCreateAdmin>);

    vi.mocked(useAdminsModule.useUpdateAdmin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useUpdateAdmin>);

    vi.mocked(useAdminsModule.useDeleteAdmin).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminsModule.useDeleteAdmin>);

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

  it('shows empty state before any role is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    expect(screen.getByText(/seleccioná un rol/i)).toBeInTheDocument();
  });

  it('shows the roles list rail with role names', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    expect(screen.getByText('Super Administrador')).toBeInTheDocument();
    expect(screen.getByText('NOC')).toBeInTheDocument();
  });

  it('"Nuevo rol" button exists in Roles tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    expect(screen.getByRole('button', { name: /nuevo rol/i })).toBeInTheDocument();
  });
});
