/**
 * Ruta /admin/whatsapp — gate de permisos (messaging-inbox-fe F1, FB5).
 *
 *  WRP-1 con messaging.read → la page monta
 *  WRP-2 sin messaging.read → RequirePermission bloquea con NoPermissionPage
 *
 * Mismo esquema del golden routing test (molde: AccionesRoute.permission.test.tsx):
 * layouts mockeados a Outlet, page mockeada con marker, useAuth autenticado. El
 * gate real es RequirePermission (NO mockeado) leyendo useMyPermissions.
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

vi.mock('@/pages/whatsapp/WhatsappInboxPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:Whatsapp]'),
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

describe('WRP-1: con messaging.read la page monta', () => {
  it('renderiza WhatsappInboxPage en /admin/whatsapp', async () => {
    mockPerms(['messaging.read']);
    renderAt('/admin/whatsapp');
    expect(await screen.findByText('[PAGE:Whatsapp]')).toBeInTheDocument();
  });
});

describe('WRP-2: sin messaging.read la ruta bloquea', () => {
  it('muestra NoPermissionPage y NO monta la page', async () => {
    mockPerms(['clients.read']);
    renderAt('/admin/whatsapp');
    expect(await screen.findByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('[PAGE:Whatsapp]')).not.toBeInTheDocument();
  });
});
