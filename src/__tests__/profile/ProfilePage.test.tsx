import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProfilePage from '@/pages/profile/ProfilePage';
import * as useProfileModule from '@/hooks/useProfile';

vi.mock('@/hooks/useProfile');

const mockProfile = {
  id: 1,
  name: 'Admin Principal',
  email: 'admin@ipnext.com.ar',
  phone: '+54 11 4567-8901',
  role: 'Superadministrador',
  language: 'es',
  timezone: 'America/Argentina/Buenos_Aires',
  twoFactorEnabled: false,
  avatarInitials: 'AP',
  createdAt: '2023-01-15',
  lastLogin: '2026-04-28T11:00:00Z',
};

const mockMutate = vi.fn();

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/profile']}>
        <Routes>
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProfileModule.useProfile).mockReturnValue({
      data: mockProfile,
      isLoading: false,
    } as ReturnType<typeof useProfileModule.useProfile>);

    vi.mocked(useProfileModule.useUpdateProfile).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useProfileModule.useUpdateProfile>);

    vi.mocked(useProfileModule.useChangePassword).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useProfileModule.useChangePassword>);

    vi.mocked(useProfileModule.useToggle2FA).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useProfileModule.useToggle2FA>);
  });

  it('renders "Mi perfil" title', () => {
    renderPage();
    expect(screen.getByText('Mi perfil')).toBeInTheDocument();
  });

  it('pre-fills name field with profile data', () => {
    renderPage();
    const nameInput = screen.getByLabelText(/nombre completo/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Admin Principal');
  });

  it('renders "Seguridad" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /seguridad/i })).toBeInTheDocument();
  });

  it('clicking "Seguridad" tab shows password fields', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /seguridad/i }));
    expect(screen.getByLabelText(/contraseña actual/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
  });

  it('renders "Cambiar contraseña" section when on Seguridad tab', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /seguridad/i }));
    const matches = screen.getAllByText(/cambiar contraseña/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('2FA toggle button is present on Seguridad tab', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /seguridad/i }));
    expect(screen.getByRole('button', { name: /activar 2fa/i })).toBeInTheDocument();
  });

  it('renders "Preferencias" tab button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /preferencias/i })).toBeInTheDocument();
  });
});
