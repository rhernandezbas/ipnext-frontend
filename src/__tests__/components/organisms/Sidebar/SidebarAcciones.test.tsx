/**
 * Sidebar — entrada "Acciones" bajo Clientes (actions-worklist F2).
 *
 *  SBA-1 con actions.read → link "Acciones" a /admin/customers/acciones, antes de Configuración
 *  SBA-2 sin actions.read → la entrada NO se renderiza (el resto del grupo sigue)
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Gate configurable: el grupo Clientes exige clients.read (siempre true acá);
// el caso denegado solo saca actions.read.
let deniedPerms: string[] = [];
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    can: (p: string | string[]) => {
      const list = Array.isArray(p) ? p : [p];
      return !list.some((x) => deniedPerms.includes(x));
    },
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: ['*'],
  }),
}));

import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/admin/customers/acciones']}>
      <Sidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  deniedPerms = [];
});

describe('SBA-1: entrada Acciones visible con actions.read', () => {
  it('linkea a /admin/customers/acciones dentro del grupo Clientes', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: 'Acciones' });
    expect(link).toHaveAttribute('href', '/admin/customers/acciones');
  });

  it('aparece antes de Configuración (orden del grupo)', () => {
    renderSidebar();
    const links = screen.getAllByRole('link').map((el) => el.textContent?.trim() ?? '');
    const accionesIdx = links.indexOf('Acciones');
    const configuracionIdx = links.indexOf('Configuración');
    expect(accionesIdx).toBeGreaterThan(-1);
    expect(configuracionIdx).toBeGreaterThan(-1);
    expect(accionesIdx).toBeLessThan(configuracionIdx);
  });
});

describe('SBA-2: sin actions.read no hay entrada', () => {
  it('oculta Acciones pero mantiene el resto del grupo Clientes', () => {
    deniedPerms = ['actions.read'];
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'Acciones' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recaptación' })).toBeInTheDocument();
  });
});
