/**
 * TDD — Sidebar "Historial TV" child item (tv-activation-history #5 FE).
 * The item must be present in the Clientes group, gated by tv.read.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function mockPerms(overrides: Partial<UseMyPermissionsResult> = {}) {
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

function renderSidebar(path = '/admin/customers/tv/history') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar — Historial TV child item', () => {
  it('renders "Historial TV" link to /admin/customers/tv/history when tv.read is granted', () => {
    mockPerms({
      permissions: ['tv.read', 'clients.read'],
      can: (p) => p === 'tv.read' || p === 'clients.read',
    });
    renderSidebar();
    const link = screen.getByRole('link', { name: /historial tv/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/customers/tv/history');
  });

  it('does NOT render "Historial TV" when tv.read is NOT granted', () => {
    mockPerms({
      permissions: ['clients.read'],
      can: (p) => p === 'clients.read',
    });
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('link', { name: /historial tv/i })).not.toBeInTheDocument();
  });
});
