/**
 * Sidebar — Cortes PPPoE migration from Clientes to Gestión de Red
 *
 * SB-CORTES-1: "Cortes PPPoE" appears under Gestión de red (networking) with pppoe.cut
 * SB-CORTES-2: "Cortes PPPoE" is hidden when user lacks pppoe.cut
 * SB-CORTES-3: "Cortes PPPoE" no longer appears under the Clientes group
 * SB-CORTES-4: Cortes PPPoE child links to the new /admin/networking/pppoe-cortes path
 * SB-CORTES-5: Gestión de red auto-expands when on /admin/networking/pppoe-cortes
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const permHandles = vi.hoisted(() => ({
  result: {
    can: (_: string | string[]) => true,
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

/** Render sidebar at a given path */
function renderSidebar(path = '/admin/networking/pppoe-cortes') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

/** Returns the "Gestión de red" L2 item button */
function getGestionRedBtn() {
  return screen.getByRole('button', { name: /gestión de red/i });
}

describe('Sidebar — Cortes PPPoE bajo Gestión de Red', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
    // Default: user has every permission (including network.read + pppoe.cut)
    permHandles.result.can = () => true;
  });

  // SB-CORTES-1: visible under Gestión de red when user has pppoe.cut
  it('shows Cortes PPPoE child under Gestión de red when has pppoe.cut', () => {
    renderSidebar('/admin/networking/pppoe-cortes');
    // Gestión de red is auto-expanded at this path
    expect(screen.getByRole('link', { name: /^cortes pppoe$/i })).toBeInTheDocument();
  });

  // SB-CORTES-2: hidden without pppoe.cut
  it('hides Cortes PPPoE child when user lacks pppoe.cut', () => {
    permHandles.result.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((x) => x !== 'pppoe.cut');
    };
    renderSidebar('/admin/networking/pppoe-cortes');
    expect(screen.queryByRole('link', { name: /^cortes pppoe$/i })).not.toBeInTheDocument();
  });

  // SB-CORTES-3: no longer a child of the Clientes group
  it('does not render Cortes PPPoE under the Clientes group', () => {
    // Clientes auto-expands at this path; its children render but Cortes PPPoE is gone.
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('link', { name: /^cortes pppoe$/i })).not.toBeInTheDocument();
  });

  // SB-CORTES-4: correct href (new networking path)
  it('Cortes PPPoE child links to /admin/networking/pppoe-cortes', () => {
    renderSidebar('/admin/networking/pppoe-cortes');
    const link = screen.getByRole('link', { name: /^cortes pppoe$/i });
    expect(link).toHaveAttribute('href', '/admin/networking/pppoe-cortes');
  });

  // SB-CORTES-5: Gestión de red auto-expands on the new path
  it('auto-expands Gestión de red when on /admin/networking/pppoe-cortes', () => {
    renderSidebar('/admin/networking/pppoe-cortes');
    expect(getGestionRedBtn()).toHaveAttribute('aria-expanded', 'true');
  });
});
