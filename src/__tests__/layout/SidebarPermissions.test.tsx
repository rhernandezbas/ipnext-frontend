import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

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

function renderSidebar(path = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidebar — permission filtering', () => {
  it('SP1 — super_admin (*): all nav groups render', () => {
    mockPerms({ permissions: ['*'], can: () => true });
    renderSidebar();
    // spot-check a few sections
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finanzas/i })).toBeInTheDocument();
  });

  it('SP2 — no permissions: CRM groups are hidden', () => {
    mockPerms({ permissions: [], can: () => false });
    renderSidebar();
    // Clientes (clients.read) should be hidden
    expect(screen.queryByRole('button', { name: /^clientes$/i })).not.toBeInTheDocument();
    // Finanzas (billing.read) should be hidden
    expect(screen.queryByRole('button', { name: /finanzas/i })).not.toBeInTheDocument();
  });

  it('SP3 — has scheduling.read: Scheduling group renders', () => {
    mockPerms({
      permissions: ['scheduling.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'scheduling.read';
      },
    });
    renderSidebar();
    expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument();
  });

  it('SP4 — has scheduling.read but NOT clients.read: Clientes hidden', () => {
    mockPerms({
      permissions: ['scheduling.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'scheduling.read';
      },
    });
    renderSidebar();
    expect(screen.queryByRole('button', { name: /^clientes$/i })).not.toBeInTheDocument();
  });

  it('SP5 — loading state: all items visible (no layout shift while loading)', () => {
    mockPerms({ isLoading: true, can: () => false });
    renderSidebar();
    // While loading we show all items to avoid flicker
    expect(screen.getAllByRole('button', { name: /clientes/i }).length).toBeGreaterThan(0);
  });

  it('SP6 — top-level links (dashboard, monitoring, notifications) always visible (no permission guard on links)', () => {
    // The singleton top links (Panel de control etc) are always shown — no permission guard
    mockPerms({ permissions: [], can: () => false });
    renderSidebar();
    // They are NavLinks (not collapsible groups), no permission filter needed per design
    expect(screen.getByRole('link', { name: /panel de control/i })).toBeInTheDocument();
  });

  it('SP7 — has contracts.read: Contratos group renders', () => {
    mockPerms({
      permissions: ['contracts.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'contracts.read';
      },
    });
    renderSidebar();
    expect(screen.getByRole('button', { name: /contratos/i })).toBeInTheDocument();
  });

  it('SP8 — without contracts.read: Contratos group is hidden', () => {
    mockPerms({
      permissions: [],
      can: () => false,
    });
    renderSidebar();
    expect(screen.queryByRole('button', { name: /contratos/i })).not.toBeInTheDocument();
  });

  it('SP9 — has contracts.read: both sub-items (Contratos, Tecnologías) render', () => {
    mockPerms({
      permissions: ['contracts.read'],
      can: (p) => {
        const perm = Array.isArray(p) ? p[0] : p;
        return perm === 'contracts.read';
      },
    });
    renderSidebar('/admin/contracts/list');
    expect(screen.getByRole('link', { name: /^contratos$/i })).toHaveAttribute(
      'href',
      '/admin/contracts/list'
    );
    expect(screen.getByRole('link', { name: /tecnologías/i })).toHaveAttribute(
      'href',
      '/admin/contracts/technologies'
    );
  });
});
