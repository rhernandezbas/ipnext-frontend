/**
 * Rutas /admin/technicians/* — gate de permisos (change iclass-gps-audit).
 *
 *  TLR-1  technicians.location_read  → monta el mapa en vivo
 *  TLR-2  sin ese permiso            → NoPermissionPage
 *  TLR-3  technicians.location_audit → monta la auditoría
 *  TLR-4  SOLO location_read         → la auditoría queda bloqueada
 *         (despachar NO arrastra el poder de auditar el historial de una persona)
 *
 * Las claves llevan PUNTO en el separador de recurso y GUION BAJO en la acción:
 * `technicians.location_read`. Es exactamente lo que emite el BE
 * (prisma/migrations/20261023000100_technicians_location_permissions). Inventar
 * la clave deja la página invisible sin que nadie se entere.
 */
import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 1, username: 'admin', email: 'a@a.com', displayName: 'Admin', role: 'admin', permissions: [] },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

vi.mock('@/components/ProtectedRoute', async () => {
  const { Outlet } = await import('react-router-dom');
  return { ProtectedRoute: () => React.createElement(Outlet) };
});

vi.mock('@/components/templates/AdminLayout/AdminLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { AdminLayout: () => React.createElement(Outlet) };
});

vi.mock('@/pages/technicians/TechniciansLiveMapPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TechniciansLiveMap]'),
}));

vi.mock('@/pages/technicians/TechniciansAuditPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:TechniciansAudit]'),
}));

import { App } from '@/App';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

function mockPerms(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      if (perms.includes('*')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x));
    },
  } as UseMyPermissionsResult);
}

function renderAt(url: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Suspense fallback={<div>loading</div>}>
          <App />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TLR-1/2: mapa en vivo — technicians.location_read', () => {
  it('con el permiso monta la page', async () => {
    mockPerms(['technicians.location_read']);
    renderAt('/admin/technicians/live');
    expect(await screen.findByText('[PAGE:TechniciansLiveMap]')).toBeInTheDocument();
  });

  it('sin el permiso bloquea', async () => {
    mockPerms(['inventory.read']);
    renderAt('/admin/technicians/live');
    expect(await screen.findByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('[PAGE:TechniciansLiveMap]')).not.toBeInTheDocument();
  });
});

describe('TLR-3/4: auditoría — technicians.location_audit', () => {
  it('con el permiso de auditoría monta la page', async () => {
    mockPerms(['technicians.location_audit']);
    renderAt('/admin/technicians/audit');
    expect(await screen.findByText('[PAGE:TechniciansAudit]')).toBeInTheDocument();
  });

  it('despachar (location_read) NO habilita auditar', async () => {
    mockPerms(['technicians.location_read']);
    renderAt('/admin/technicians/audit');
    expect(await screen.findByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('[PAGE:TechniciansAudit]')).not.toBeInTheDocument();
  });
});
