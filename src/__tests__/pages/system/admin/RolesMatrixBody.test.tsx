import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useRbacRoles', () => ({
  useRbacRoles: vi.fn(),
  useCreateRbacRole: vi.fn(),
  useDeleteRbacRole: vi.fn(),
}));

vi.mock('@/hooks/useRbacPermissions', () => ({
  useRbacPermissions: vi.fn(),
}));

vi.mock('@/hooks/useRolePermissions', () => ({
  useRolePermissions: vi.fn(),
  useSetRolePermissions: vi.fn(),
}));

import { useRbacRoles, useCreateRbacRole, useDeleteRbacRole } from '@/hooks/useRbacRoles';
import { useRbacPermissions } from '@/hooks/useRbacPermissions';
import { useRolePermissions, useSetRolePermissions } from '@/hooks/useRolePermissions';
import { RolesMatrixBody } from '@/pages/system/admin/RolesMatrixBody';
import type { RbacRoleDto } from '@/types/rbacRole';
import type { PermissionModule } from '@/types/rolePermissions';

const mockRoles: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
];

const mockModules: PermissionModule[] = [
  {
    moduleId: 'm1',
    moduleCode: 'clients',
    moduleLabel: 'Clientes',
    actions: ['read', 'write'],
    actionToId: { read: 'p1', write: 'p2' },
  },
];

const mockSaveMutate = vi.fn();

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, null, children)
    );
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useRbacRoles).mockReturnValue({
    data: mockRoles,
    isLoading: false,
    isSuccess: true,
  } as ReturnType<typeof useRbacRoles>);

  vi.mocked(useCreateRbacRole).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateRbacRole>);

  vi.mocked(useDeleteRbacRole).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteRbacRole>);

  vi.mocked(useRbacPermissions).mockReturnValue({
    permissions: [],
    modules: mockModules,
    isLoading: false,
    isSuccess: true,
    isError: false,
  });

  vi.mocked(useRolePermissions).mockReturnValue({
    data: ['p1'],
    isLoading: false,
    isSuccess: true,
  } as ReturnType<typeof useRolePermissions>);

  vi.mocked(useSetRolePermissions).mockReturnValue({
    mutateAsync: mockSaveMutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSetRolePermissions>);
});

describe('RolesMatrixBody', () => {
  it('shows empty state message when no role is selected', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    expect(screen.getByText(/seleccioná un rol/i)).toBeInTheDocument();
  });

  it('renders the PermissionMatrix when a role is selected via rail click', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('NOC'));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('shows loading skeleton when permissions are loading', () => {
    vi.mocked(useRolePermissions).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    } as ReturnType<typeof useRolePermissions>);

    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('NOC'));

    expect(screen.getAllByTestId('perm-skeleton')).toHaveLength(3);
  });

  it('save bar is hidden when no role is selected', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('save bar is hidden when super_admin is selected', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('Super Administrador'));

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });

  it('save button is disabled when not dirty', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('NOC'));

    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    expect(saveBtn).toBeDisabled();
  });

  it('discard button resets staged changes to saved state', () => {
    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('NOC'));

    // Toggle a checkbox to make it dirty
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Now discard
    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('calls save mutation with staged permission IDs', async () => {
    mockSaveMutate.mockResolvedValue(['p1', 'p2']);

    const wrapper = createWrapper();
    render(createElement(RolesMatrixBody, null), { wrapper });

    fireEvent.click(screen.getByText('NOC'));

    // Toggle p2 to make it dirty
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // p2

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: 'r2', permissionIds: expect.arrayContaining(['p1', 'p2']) })
      );
    });
  });
});
