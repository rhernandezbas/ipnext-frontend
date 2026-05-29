import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RbacUsersBody } from '@/pages/system/admin/RbacUsersBody';

// Mock all hooks at vi.mock level
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
import { useConfirm } from '@/context/ConfirmContext';

const ROLES = [
  { id: 'r1', code: 'super_admin', label: 'Super Admin', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
];

const USERS = [
  {
    id: 'u1',
    name: 'Alice Admin',
    email: 'alice@example.com',
    login: 'alice',
    status: 'active' as const,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-05-01T10:00:00Z',
    roles: [ROLES[0]],
  },
  {
    id: 'u2',
    name: 'Bob NOC',
    email: 'bob@example.com',
    login: 'bob',
    status: 'disabled' as const,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    lastLoginAt: null,
    roles: [ROLES[1]],
  },
];

const idleMutation = { mutateAsync: vi.fn(), isPending: false };
const confirmFn = vi.fn().mockResolvedValue(true);

function renderBody() {
  return render(
    <MemoryRouter>
      <RbacUsersBody />
    </MemoryRouter>,
  );
}

describe('RbacUsersBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmFn.mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    vi.mocked(useRbacUsers).mockReturnValue({
      data: USERS,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);
    vi.mocked(useRbacRoles).mockReturnValue({
      data: ROLES,
      isLoading: false,
    } as unknown as ReturnType<typeof useRbacRoles>);
    vi.mocked(useCreateRbacUser).mockReturnValue(idleMutation as unknown as ReturnType<typeof useCreateRbacUser>);
    vi.mocked(useUpdateRbacUser).mockReturnValue(idleMutation as unknown as ReturnType<typeof useUpdateRbacUser>);
    vi.mocked(useDeleteRbacUser).mockReturnValue(idleMutation as unknown as ReturnType<typeof useDeleteRbacUser>);
    vi.mocked(useSetUserRoles).mockReturnValue(idleMutation as unknown as ReturnType<typeof useSetUserRoles>);
  });

  it('renders heading "Usuarios" and create button', () => {
    renderBody();
    expect(screen.getByRole('heading', { name: /usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo usuario/i })).toBeInTheDocument();
  });

  it('renders a row per user with name and email', () => {
    renderBody();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob NOC')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('renders role chips with human labels from SYSTEM_ROLE_META', () => {
    renderBody();
    // Alice has super_admin → "Super Administrador"
    expect(screen.getByText('Super Administrador')).toBeInTheDocument();
    // Bob has noc → "NOC"
    expect(screen.getByText('NOC')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    vi.mocked(useRbacUsers).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);
    renderBody();
    const skeletons = document.querySelectorAll('[data-testid="skeleton-row"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when user list is empty', () => {
    vi.mocked(useRbacUsers).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);
    renderBody();
    expect(screen.getByText(/no hay usuarios/i)).toBeInTheDocument();
  });

  it('shows error state when isError', () => {
    vi.mocked(useRbacUsers).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useRbacUsers>);
    renderBody();
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('opens RbacUserModal in create mode when "+ Nuevo usuario" is clicked', async () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nuevo usuario/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Modal title h2 contains "Nuevo usuario"
      expect(screen.getByRole('heading', { name: /nuevo usuario/i })).toBeInTheDocument();
    });
  });

  it('opens RbacUserModal in edit mode when "Editar" is clicked', async () => {
    renderBody();
    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Edit title includes user name
      expect(screen.getByText(/editar alice admin/i)).toBeInTheDocument();
    });
  });

  it('calls delete mutation after confirm dialog', async () => {
    // confirm resolves true via the injected useConfirm mock (see beforeEach)
    const deleteMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false };
    vi.mocked(useDeleteRbacUser).mockReturnValue(deleteMutation as unknown as ReturnType<typeof useDeleteRbacUser>);

    renderBody();
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteMutation.mutateAsync).toHaveBeenCalledWith('u1');
    });
  });

  it('shows error toast when delete returns CANNOT_DELETE_SELF', async () => {
    const serverError = Object.assign(new Error('self delete'), {
      response: { data: { code: 'CANNOT_DELETE_SELF' } },
    });
    const deleteMutation = {
      mutateAsync: vi.fn().mockRejectedValue(serverError),
      isPending: false,
    };
    vi.mocked(useDeleteRbacUser).mockReturnValue(deleteMutation as unknown as ReturnType<typeof useDeleteRbacUser>);

    renderBody();
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/no podés borrar tu propio usuario/i)).toBeInTheDocument();
    });
  });

  it('shows error when delete returns CANNOT_REMOVE_LAST_SUPER_ADMIN', async () => {
    const serverError = Object.assign(new Error('last super admin'), {
      response: { data: { code: 'CANNOT_REMOVE_LAST_SUPER_ADMIN' } },
    });
    const deleteMutation = {
      mutateAsync: vi.fn().mockRejectedValue(serverError),
      isPending: false,
    };
    vi.mocked(useDeleteRbacUser).mockReturnValue(deleteMutation as unknown as ReturnType<typeof useDeleteRbacUser>);

    renderBody();
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/quedaría el sistema sin super administradores/i),
      ).toBeInTheDocument();
    });
  });
});
