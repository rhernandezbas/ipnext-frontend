/**
 * Sidebar — TV migrated from "Clientes potenciales" to "Clientes" (#47b).
 *
 * SB-TV1: "TV" appears as a child of Clientes (after Contratos) when can(tv.read)
 * SB-TV2: "TV" is hidden inside Clientes when the user lacks tv.read
 * SB-TV3: "TV" no longer appears under "Clientes potenciales"
 * SB-TV4: TV child links to /admin/customers/tv
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const permHandles = vi.hoisted(() => ({
  result: {
    can: (_: string | string[]): boolean => true,
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: [] as string[],
  },
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => permHandles.result,
}));

import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar — TV bajo Clientes', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
    permHandles.result.can = () => true;
  });

  // SB-TV1: TV visible under Clientes when user has tv.read
  it('shows TV child under Clientes when has tv.read', () => {
    renderSidebar('/admin/customers/list');
    // Clientes is auto-expanded at this path
    expect(screen.getByRole('link', { name: /^tv$/i })).toBeInTheDocument();
  });

  // SB-TV2: hidden without tv.read
  it('hides the TV child when the user lacks tv.read', () => {
    permHandles.result.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((x) => x !== 'tv.read');
    };
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('link', { name: /^tv$/i })).not.toBeInTheDocument();
  });

  // SB-TV3: TV no longer lives under "Clientes potenciales"
  it('does not render TV under "Clientes potenciales"', () => {
    // /admin/crm/* auto-expands the "Clientes potenciales" item.
    renderSidebar('/admin/crm/dashboard');
    const region = screen.getByRole('region', { name: /clientes potenciales/i });
    expect(within(region).queryByRole('link', { name: /^tv$/i })).not.toBeInTheDocument();
  });

  // SB-TV4: correct href for TV
  it('TV child links to /admin/customers/tv', () => {
    renderSidebar('/admin/customers/list');
    const link = screen.getByRole('link', { name: /^tv$/i });
    expect(link).toHaveAttribute('href', '/admin/customers/tv');
  });
});
