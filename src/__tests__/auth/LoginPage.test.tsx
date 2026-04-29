import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import * as useAuthModule from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

const mockLogin = vi.fn();
const mockLogout = vi.fn();

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/customers/list" element={<div>Clientes</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: mockLogin,
      logout: mockLogout,
    });
  });

  it('renders username and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('shows IPNEXT branding', () => {
    renderLogin();
    expect(screen.getByText('IPNEXT')).toBeInTheDocument();
    expect(screen.getByText(/acceso de administradores/i)).toBeInTheDocument();
  });

  it('calls login with username and password on submit', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    renderLogin();

    await user.type(screen.getByLabelText(/usuario/i), 'admin');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'password123');
    });
  });

  it('navigates to /admin/customers/list after successful login (no redirect param)', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    renderLogin();

    await user.type(screen.getByLabelText(/usuario/i), 'admin');
    await user.type(screen.getByLabelText(/contraseña/i), 'pass');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Clientes')).toBeInTheDocument();
    });
  });

  it('navigates to redirect param after successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    renderLogin(`/login?redirect=${encodeURIComponent('/dashboard')}`);

    await user.type(screen.getByLabelText(/usuario/i), 'admin');
    await user.type(screen.getByLabelText(/contraseña/i), 'pass');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('shows error message on failed login', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();

    await user.type(screen.getByLabelText(/usuario/i), 'wrong');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    });
  });

  it('disables inputs and button while submitting', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValueOnce(new Promise<void>((res) => (resolveLogin = res)));

    renderLogin();
    const submitBtn = screen.getByRole('button', { name: /ingresar/i });

    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass' } });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(screen.getByLabelText(/usuario/i)).toBeDisabled();
      expect(screen.getByLabelText(/contraseña/i)).toBeDisabled();
    });

    resolveLogin();
  });
});
