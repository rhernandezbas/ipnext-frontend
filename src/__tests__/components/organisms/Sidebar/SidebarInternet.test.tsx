/**
 * Sidebar — "Internet" (servicios de Internet, espejo de TV) bajo Clientes.
 *
 * SB-INET1: "Internet" aparece como hijo de Clientes cuando can(pppoe.read)
 * SB-INET2: "Internet" se oculta cuando el usuario NO tiene pppoe.read
 * SB-INET3: el item linkea a /admin/customers/internet
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

function renderSidebar(path = '/admin/customers/list') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar — Internet bajo Clientes', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
    permHandles.result.can = () => true;
  });

  // SB-INET1: visible con pppoe.read
  it('shows the Internet child under Clientes when has pppoe.read', () => {
    renderSidebar('/admin/customers/list');
    expect(screen.getByRole('link', { name: /^internet$/i })).toBeInTheDocument();
  });

  // SB-INET2: oculto sin pppoe.read
  it('hides the Internet child when the user lacks pppoe.read', () => {
    permHandles.result.can = (p) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((x) => x !== 'pppoe.read');
    };
    renderSidebar('/admin/customers/list');
    expect(screen.queryByRole('link', { name: /^internet$/i })).not.toBeInTheDocument();
  });

  // SB-INET3: href correcto
  it('Internet child links to /admin/customers/internet', () => {
    renderSidebar('/admin/customers/list');
    const link = screen.getByRole('link', { name: /^internet$/i });
    expect(link).toHaveAttribute('href', '/admin/customers/internet');
  });
});
