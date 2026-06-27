import { render, screen } from '@testing-library/react';
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

function renderSidebar() {
  // Start inside /admin/customers so the Clientes group is active and expanded,
  // exposing its children (CollapsibleNavItem opens when the parent path matches).
  return render(
    <MemoryRouter initialEntries={['/admin/customers/list']}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar — Clientes Configuración child', () => {
  beforeEach(() => {
    permHandles.result.isLoading = false;
  });

  it('shows a "Configuración" child linking to /admin/customers/settings when can(clients.read)', () => {
    permHandles.result.can = (p) => (Array.isArray(p) ? p.includes('clients.read') : p === 'clients.read');
    renderSidebar();
    const link = screen.getByRole('link', { name: 'Configuración' });
    expect(link).toHaveAttribute('href', '/admin/customers/settings');
  });

  it('hides the entire Clientes group (and its Configuración child) when can(clients.read) is false', () => {
    permHandles.result.can = () => false;
    renderSidebar();
    expect(screen.queryByRole('button', { name: /clientes/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Configuración' }),
    ).not.toBeInTheDocument();
  });
});
