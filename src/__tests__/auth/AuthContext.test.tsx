import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import * as authApi from '@/api/auth.api';
import type { AuthUser } from '@/types/auth';

vi.mock('@/api/auth.api');

const mockUser: AuthUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin',
  permissions: ['read', 'write'],
};

function TestConsumer() {
  const { user, isLoading } = useAuthContext();
  if (isLoading) return <div>loading</div>;
  return <div>{user ? user.displayName : 'no user'}</div>;
}

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getMe on mount and sets user on success', async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

    renderWithRouter(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });
  });

  it('sets user to null when getMe fails', async () => {
    vi.mocked(authApi.getMe).mockRejectedValueOnce(new Error('401'));

    renderWithRouter(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('no user')).toBeInTheDocument();
    });
  });

  it('login sets user in context', async () => {
    vi.mocked(authApi.getMe).mockRejectedValueOnce(new Error('401'));
    vi.mocked(authApi.login).mockResolvedValueOnce(mockUser);

    let loginFn: ((u: string, p: string) => Promise<void>) | undefined;

    function LoginConsumer() {
      const { user, login } = useAuthContext();
      loginFn = login;
      return <div>{user ? user.displayName : 'no user'}</div>;
    }

    renderWithRouter(
      <AuthProvider>
        <LoginConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('no user')).toBeInTheDocument();
    });

    await act(async () => {
      await loginFn!('admin', 'pass');
    });

    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('throws when useAuthContext is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(
        <MemoryRouter>
          <TestConsumer />
        </MemoryRouter>
      );
    }).toThrow('useAuthContext must be used within AuthProvider');
    consoleError.mockRestore();
  });

  it('dispatches auth:unauthorized event and resets user', async () => {
    vi.mocked(authApi.getMe).mockResolvedValueOnce(mockUser);

    renderWithRouter(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText('Admin User'));

    act(() => {
      window.dispatchEvent(new Event('auth:unauthorized'));
    });

    await waitFor(() => {
      expect(screen.getByText('no user')).toBeInTheDocument();
    });
  });
});
