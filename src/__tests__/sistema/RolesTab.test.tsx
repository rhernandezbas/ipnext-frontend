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

const mockActivityLog: AdminActivityLog[] = [];

const mockRoles: AdminRole_Definition[] = [
  {
    id: '1',
    name: 'superadmin',
    description: 'Acceso total',
    isSystem: true,
    permissions: [{ module: 'clients', actions: ['read', 'write', 'delete'] }],
  },
  {
    id: '2',
    name: 'viewer',
    description: 'Solo lectura',
    isSystem: true,
    permissions: [{ module: 'clients', actions: ['read'] }],
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <AdministracionPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RolesTab', () => {
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

  it('shows permission matrix with module rows when a role is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));
    // Click first role card to select it
    const roleCards = screen.getAllByText(/superadmin|viewer/i);
    await user.click(roleCards[0]);

    // Should see module rows in permission matrix
    expect(screen.getByText(/clientes/i)).toBeInTheDocument();
  });

  it('shows "Guardar cambios" button when a role is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));
    const roleCards = screen.getAllByText(/superadmin|viewer/i);
    await user.click(roleCards[0]);

    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('"Nuevo rol" button exists in Roles tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /roles y permisos/i }));

    expect(screen.getByRole('button', { name: /nuevo rol/i })).toBeInTheDocument();
  });
});
