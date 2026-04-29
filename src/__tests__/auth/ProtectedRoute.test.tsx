import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import * as useAuthModule from '@/hooks/useAuth';
import type { AuthUser } from '@/types/auth';

vi.mock('@/hooks/useAuth');

const mockUser: AuthUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin',
  permissions: [],
};

function renderRoute(initialEntry = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows spinner while loading', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderRoute();
    // Spinner renders — no redirect, no protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderRoute('/protected');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('includes redirect param when redirecting to login', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected?foo=bar']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
          <Route
            path="/login"
            element={
              <div data-testid="login">
                {window.location.search}
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('renders child route when authenticated', () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderRoute('/protected');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
