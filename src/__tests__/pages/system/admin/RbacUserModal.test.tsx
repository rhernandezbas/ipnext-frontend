import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RbacUserModal } from '@/pages/system/admin/RbacUserModal';
import type { RbacUserWithRolesDto } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';

const ROLES: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Admin', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
  { id: 'r3', code: 'ventas', label: 'Ventas', isSystem: true },
];

const EXISTING_USER: RbacUserWithRolesDto = {
  id: 'u1',
  name: 'Alice Admin',
  email: 'alice@example.com',
  login: 'alice',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  lastLoginAt: null,
  roles: [ROLES[0]],
};

describe('RbacUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create form with empty fields', () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/nuevo usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('');
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByLabelText(/login/i)).toHaveValue('');
  });

  it('prefills fields in edit mode', () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RbacUserModal
        mode="edit"
        initialValues={EXISTING_USER}
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Alice Admin');
    expect(screen.getByLabelText(/email/i)).toHaveValue('alice@example.com');
    expect(screen.getByLabelText(/login/i)).toHaveValue('alice');
    // login should be disabled in edit mode (AD-FE-12)
    expect(screen.getByLabelText(/login/i)).toBeDisabled();
  });

  it('shows validation errors on submit with empty required fields', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/nombre.+obligatorio|obligatorio.+nombre/i)).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits create payload correctly', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Nuevo User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nuevo@example.com' } });
    fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'nuevo' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'password123' } });

    // Add a role via selector
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    fireEvent.click(screen.getByRole('option', { name: /noc/i }));

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Nuevo User',
        email: 'nuevo@example.com',
        login: 'nuevo',
        password: 'password123',
        roleIds: ['r2'],
      });
    });
  });

  it('shows password validation error when password < 8 chars in create mode', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'testlogin' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/mínimo 8|8 caracteres/i)).toBeInTheDocument();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('omits password key in edit when password section collapsed', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RbacUserModal
        mode="edit"
        initialValues={EXISTING_USER}
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );

    // Don't touch password — leave collapsed
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Alice Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      const payload = onSave.mock.calls[0][0];
      expect(payload).not.toHaveProperty('password');
    });
  });

  it('shows server error 409 LOGIN_TAKEN inline', async () => {
    const onClose = vi.fn();
    const serverError = Object.assign(new Error('login taken'), {
      response: { data: { code: 'LOGIN_ALREADY_TAKEN' } },
    });
    const onSave = vi.fn().mockRejectedValue(serverError);
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'taken' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'password123' } });

    // Add a role
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    fireEvent.click(screen.getByRole('option', { name: /noc/i }));

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText(/ese login ya está en uso/i)).toBeInTheDocument();
    });
  });

  it('shows 403 CANNOT_REMOVE_LAST_SUPER_ADMIN as banner', async () => {
    const onClose = vi.fn();
    const serverError = Object.assign(new Error('last super admin'), {
      response: { data: { code: 'CANNOT_REMOVE_LAST_SUPER_ADMIN' } },
    });
    const onSave = vi.fn().mockRejectedValue(serverError);
    render(
      <RbacUserModal
        mode="edit"
        initialValues={EXISTING_USER}
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/quedaría el sistema sin super administradores/i),
      ).toBeInTheDocument();
    });
  });

  it('closes on ESC key press', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking outside (clean form)', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={false}
      />,
    );
    // click the overlay (outside the dialog inner)
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('disables save button while loading', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <RbacUserModal
        mode="create"
        roles={ROLES}
        onClose={onClose}
        onSave={onSave}
        loading={true}
      />,
    );
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });
});
