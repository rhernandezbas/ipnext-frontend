/**
 * Sidebar — grupo "Gestión de App" (change gestion-app).
 *
 * El grupo que antes se llamaba "Portal" pasa a llamarse "Gestión de App" y
 * suma dos ítems: "Resumen" (portada) y "Avisos push". Los `requiredPermission`
 * de los ítems que ya existían NO se tocan — este test es el candado.
 *
 *  GA-1 el grupo se llama "Gestión de App" y ya no "Portal"
 *  GA-2 con `*` están los 6 ítems, y "Resumen" va primero
 *  GA-3 sólo `portal.read` ⇒ Resumen/Usuarios/Configuración; NO Promociones/Tienda/Avisos push
 *  GA-4 sólo `push.send` ⇒ SÓLO Avisos push (el grupo no tiene permiso propio)
 *  GA-5 sólo `promos.read` ⇒ SÓLO Promociones (regresión: gate propio, no heredado)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function mockPerms(permissions: string[]) {
  const result: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p) => {
      if (permissions.includes('*')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => permissions.includes(x));
    },
  };
  vi.mocked(useMyPermissions).mockReturnValue(result);
}

function renderSidebar(path = '/admin/portal/resumen') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open onToggle={() => {}} />
    </MemoryRouter>
  );
}

/**
 * Abre un acordeón SÓLO si está cerrado. Ojo: el sidebar auto-expande la
 * sección/ítem que contiene la ruta activa, así que un `click` incondicional
 * la CIERRA — ese era el bug de la primera versión de este helper.
 */
async function expand(user: ReturnType<typeof userEvent.setup>, button: HTMLElement) {
  if (button.getAttribute('aria-expanded') === 'false') await user.click(button);
}

/** El grupo vive en la sección "Empresa" — hay que abrirla para que sus ítems entren al DOM. */
async function openGestionApp() {
  const user = userEvent.setup();
  const empresa = screen.queryByRole('button', { name: /^empresa$/i });
  if (empresa) await expand(user, empresa);
  const group = screen.getByRole('button', { name: /gestión de app/i });
  await expand(user, group);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GA-1: el grupo se llama "Gestión de App"', () => {
  it('renderiza el acordeón "Gestión de App" y ya no uno llamado "Portal"', async () => {
    mockPerms(['*']);
    renderSidebar();
    const user = userEvent.setup();
    await expand(user, screen.getByRole('button', { name: /^empresa$/i }));

    expect(screen.getByRole('button', { name: /gestión de app/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^portal$/i })).not.toBeInTheDocument();
  });
});

describe('GA-2: los 6 ítems con permisos totales', () => {
  it('muestra Resumen, Promociones, Tienda, Avisos push, Usuarios y Configuración', async () => {
    mockPerms(['*']);
    renderSidebar();
    await openGestionApp();

    const esperados: [RegExp, string][] = [
      [/^resumen$/i, '/admin/portal/resumen'],
      [/^promociones$/i, '/admin/portal/promos'],
      [/^tienda$/i, '/admin/portal/store'],
      [/^avisos push$/i, '/admin/portal/push'],
      [/^usuarios$/i, '/admin/portal/users'],
      [/^configuración$/i, '/admin/portal'],
    ];
    for (const [name, href] of esperados) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('"Resumen" es el PRIMER ítem del grupo', async () => {
    mockPerms(['*']);
    renderSidebar();
    await openGestionApp();

    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .filter((h): h is string => !!h && h.startsWith('/admin/portal'));
    expect(hrefs[0]).toBe('/admin/portal/resumen');
  });
});

describe('GA-3: sólo portal.read', () => {
  it('ve Resumen/Usuarios/Configuración y NO Promociones/Tienda/Avisos push', async () => {
    mockPerms(['portal.read']);
    renderSidebar();
    await openGestionApp();

    expect(screen.getByRole('link', { name: /^resumen$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^usuarios$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^configuración$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^promociones$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^tienda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^avisos push$/i })).not.toBeInTheDocument();
  });
});

describe('GA-4: sólo push.send', () => {
  it('ve SÓLO Avisos push dentro del grupo', async () => {
    mockPerms(['push.send']);
    renderSidebar();
    await openGestionApp();

    expect(screen.getByRole('link', { name: /^avisos push$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^resumen$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^promociones$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^tienda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^usuarios$/i })).not.toBeInTheDocument();
  });
});

describe('GA-5: sólo promos.read (regresión del gate propio)', () => {
  it('ve SÓLO Promociones dentro del grupo', async () => {
    mockPerms(['promos.read']);
    renderSidebar();
    await openGestionApp();

    expect(screen.getByRole('link', { name: /^promociones$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^resumen$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^avisos push$/i })).not.toBeInTheDocument();
  });
});
