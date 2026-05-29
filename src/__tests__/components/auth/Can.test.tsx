import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// The global setup.ts mock covers useMyPermissions.
// We use vi.mocked() to control the return value per scenario.
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/auth/Can';

import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

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

describe('<Can>', () => {
  it('C1 — granted: renders children when user has the permission', () => {
    const has = ['scheduling.delete'];
    mockPerms({
      permissions: has,
      can: (p) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(x => has.includes(x));
      },
    });
    render(<Can permission="scheduling.delete"><span>Delete Button</span></Can>);
    expect(screen.getByText('Delete Button')).toBeInTheDocument();
  });

  it('C2 — denied: renders null (default fallback) when user lacks the permission', () => {
    mockPerms({ permissions: [], can: () => false });
    render(<Can permission="scheduling.delete"><span>Delete Button</span></Can>);
    expect(screen.queryByText('Delete Button')).not.toBeInTheDocument();
  });

  it('C3 — sentinel "*": renders children for any permission', () => {
    mockPerms({ permissions: ['*'], can: () => true });
    render(<Can permission="any.random.permission"><span>Protected Content</span></Can>);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('C4 — loading state: renders fallback (NOT children), default fallback is null', () => {
    mockPerms({ isLoading: true, can: () => false });
    render(<Can permission="scheduling.delete"><span>Delete Button</span></Can>);
    expect(screen.queryByText('Delete Button')).not.toBeInTheDocument();
  });

  it('C5 — mode="any": renders children when any of the permissions matches', () => {
    mockPerms({
      permissions: ['scheduling.delete'],
      can: (p, mode) => {
        const perms = Array.isArray(p) ? p : [p];
        if (mode === 'all') return perms.every(x => ['scheduling.delete'].includes(x));
        return perms.some(x => ['scheduling.delete'].includes(x));
      },
    });
    render(
      <Can permissions={['scheduling.delete', 'unknown.perm']} mode="any">
        <span>Content</span>
      </Can>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('C6 — mode="all": renders children only when all permissions match', () => {
    const has = ['scheduling.delete', 'scheduling.bulk_delete'];
    mockPerms({
      permissions: has,
      can: (p, mode) => {
        const perms = Array.isArray(p) ? p : [p];
        if (mode === 'all') return perms.every(x => has.includes(x));
        return perms.some(x => has.includes(x));
      },
    });
    render(
      <Can permissions={['scheduling.delete', 'scheduling.bulk_delete']} mode="all">
        <span>Full Access</span>
      </Can>
    );
    expect(screen.getByText('Full Access')).toBeInTheDocument();
  });

  it('C6b — mode="all": renders fallback when not all permissions match', () => {
    mockPerms({ permissions: ['scheduling.delete'], can: () => false });
    render(
      <Can permissions={['scheduling.delete', 'unknown.perm']} mode="all">
        <span>Full Access</span>
      </Can>
    );
    expect(screen.queryByText('Full Access')).not.toBeInTheDocument();
  });

  it('C7 — custom fallback prop: renders fallback node when denied', () => {
    mockPerms({ permissions: [], can: () => false });
    render(
      <Can permission="scheduling.delete" fallback={<span>No Access</span>}>
        <span>Delete Button</span>
      </Can>
    );
    expect(screen.queryByText('Delete Button')).not.toBeInTheDocument();
    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('C8 — custom fallback during loading: shows fallback instead of children', () => {
    mockPerms({ isLoading: true, can: () => false });
    render(
      <Can permission="scheduling.delete" fallback={<span>Loading…</span>}>
        <span>Delete Button</span>
      </Can>
    );
    expect(screen.queryByText('Delete Button')).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});
