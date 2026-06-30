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
  lockedUntil: null,
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

  it('shows password validation error when password < 10 chars in create mode', async () => {
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
    // "Passw0rd" = 8 chars with a letter and a digit → only the length rule fails,
    // mirroring the backend policy (min 10). The client-side guard must block it
    // before the request leaves the browser.
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Passw0rd' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/10 caracteres/i)).toBeInTheDocument();
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

  // Fill every required field with valid values + pick a role, leaving the modal
  // ready to submit. Password satisfies the client-side policy (>=10, letter, digit)
  // so the request actually reaches onSave and we can assert on the SERVER error.
  function fillValidCreateForm() {
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Juan Mosca' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'juanmosca@ipnext.net.ar' } });
    fireEvent.change(screen.getByLabelText(/login/i), { target: { value: 'JuanM' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    fireEvent.click(screen.getByRole('option', { name: /noc/i }));
  }

  it('surfaces the backend message verbatim when the server rejects with PASSWORD_POLICY', async () => {
    const backendMessage = 'La contraseña debe tener al menos 10 caracteres, al menos un número';
    const serverError = Object.assign(new Error('bad request'), {
      response: { data: { code: 'PASSWORD_POLICY', error: backendMessage } },
    });
    const onSave = vi.fn().mockRejectedValue(serverError);
    render(
      <RbacUserModal mode="create" roles={ROLES} onClose={vi.fn()} onSave={onSave} loading={false} />,
    );

    fillValidCreateForm();
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // The real backend detail must reach the user — NOT the generic fallback.
    expect(await screen.findByText(backendMessage)).toBeInTheDocument();
    expect(screen.queryByText(/ocurrió un error\. intentá de nuevo/i)).not.toBeInTheDocument();
  });

  it('falls back to the generic banner only when the backend sends no message', async () => {
    const serverError = Object.assign(new Error('boom'), {
      response: { data: { code: 'SOME_UNKNOWN_CODE' } },
    });
    const onSave = vi.fn().mockRejectedValue(serverError);
    render(
      <RbacUserModal mode="create" roles={ROLES} onClose={vi.fn()} onSave={onSave} loading={false} />,
    );

    fillValidCreateForm();
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(await screen.findByText(/ocurrió un error\. intentá de nuevo/i)).toBeInTheDocument();
  });
});
