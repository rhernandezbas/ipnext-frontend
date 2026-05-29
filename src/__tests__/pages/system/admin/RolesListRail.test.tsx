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

import { useRbacRoles, useDeleteRbacRole, useCreateRbacRole } from '@/hooks/useRbacRoles';
import { useConfirm } from '@/context/ConfirmContext';
import { RolesListRail } from '@/pages/system/admin/RolesListRail';
import type { RbacRoleDto } from '@/types/rbacRole';

const mockRoles: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
  { id: 'r3', code: 'operaciones', label: 'Operaciones', isSystem: false },
];

const mockDeleteMutate = vi.fn();
const confirmFn = vi.fn().mockResolvedValue(true);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, null, children)
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  confirmFn.mockResolvedValue(true);
  vi.mocked(useConfirm).mockReturnValue(confirmFn);
  vi.mocked(useRbacRoles).mockReturnValue({
    data: mockRoles,
    isLoading: false,
    isSuccess: true,
  } as ReturnType<typeof useRbacRoles>);

  vi.mocked(useDeleteRbacRole).mockReturnValue({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useDeleteRbacRole>);

  vi.mocked(useCreateRbacRole).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateRbacRole>);
});

describe('RolesListRail', () => {
  it('renders list of all roles', () => {
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    expect(screen.getByText('Super Administrador')).toBeInTheDocument();
    expect(screen.getByText('NOC')).toBeInTheDocument();
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
  });

  it('shows "Sistema" badge on system roles', () => {
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    const sistemaBadges = screen.getAllByText('Sistema');
    expect(sistemaBadges).toHaveLength(2); // super_admin + noc
  });

  it('calls onSelect with roleId when a role item is clicked', () => {
    const onSelect = vi.fn();
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect }), { wrapper });

    fireEvent.click(screen.getByText('NOC'));
    expect(onSelect).toHaveBeenCalledWith('r2');
  });

  it('applies selected style to the active role', () => {
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: 'r2', onSelect: vi.fn() }), { wrapper });

    const nocItem = screen.getByText('NOC').closest('[data-role-item]');
    expect(nocItem).toHaveAttribute('aria-selected', 'true');
  });

  it('shows delete button on custom roles', () => {
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    // Custom role should have a delete button
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    expect(deleteButtons).toHaveLength(1); // only "Operaciones" is custom
  });

  it('confirms and deletes custom role on delete click', async () => {
    confirmFn.mockResolvedValue(true);
    mockDeleteMutate.mockResolvedValue(undefined);

    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));

    await waitFor(() => {
      expect(confirmFn).toHaveBeenCalled();
      expect(mockDeleteMutate).toHaveBeenCalledWith('r3');
    });
  });

  it('renders "Nuevo rol" button', () => {
    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    expect(screen.getByRole('button', { name: /nuevo rol/i })).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading', () => {
    vi.mocked(useRbacRoles).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    } as ReturnType<typeof useRbacRoles>);

    const wrapper = createWrapper();
    render(createElement(RolesListRail, { selectedRoleId: null, onSelect: vi.fn() }), { wrapper });

    expect(screen.getAllByTestId('role-skeleton')).toHaveLength(4);
  });
});
