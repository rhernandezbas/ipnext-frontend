import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

// Import before the file exists — RED
import { RequirePermission } from '@/components/auth/RequirePermission';

function mockPerms(overrides: Partial<UseMyPermissionsResult>) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => false,
  };
  vi.mocked(useMyPermissions).mockReturnValue({ ...base, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
});

function renderGuard(
  permission: string,
  options: { loadingFallback?: React.ReactNode } = {}
) {
  return render(
    <MemoryRouter>
      <RequirePermission permission={permission} {...options}>
        <span data-testid="protected-content">Protected Content</span>
      </RequirePermission>
    </MemoryRouter>
  );
}

describe('<RequirePermission>', () => {
  it('RP1 — loading: renders loadingFallback, not children', () => {
    mockPerms({ isLoading: true, can: () => false });
    renderGuard('scheduling.read', {
      loadingFallback: <span data-testid="skeleton">Loading skeleton</span>,
    });
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('RP2 — loading with no loadingFallback prop: renders nothing (null)', () => {
    mockPerms({ isLoading: true, can: () => false });
    renderGuard('scheduling.read');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('RP3 — denied: renders <NoPermissionPage>', () => {
    mockPerms({ permissions: [], can: () => false });
    renderGuard('scheduling.read');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // NoPermissionPage heading
    expect(screen.getByRole('heading', { name: /no tenés permisos/i })).toBeInTheDocument();
  });

  it('RP4 — allowed: renders children', () => {
    mockPerms({ permissions: ['scheduling.read'], can: () => true });
    renderGuard('scheduling.read');
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /no tenés permisos/i })).not.toBeInTheDocument();
  });

  it('RP5 — sentinel "*": renders children for any permission', () => {
    mockPerms({ permissions: ['*'], can: () => true });
    renderGuard('any.unknown.permission');
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('RP6 — error state: renders <NoPermissionPage> (fail-safe deny)', () => {
    mockPerms({ isError: true, can: () => false });
    renderGuard('scheduling.read');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no tenés permisos/i })).toBeInTheDocument();
  });
});
