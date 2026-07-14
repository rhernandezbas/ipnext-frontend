/**
 * Ruta /admin/whatsapp/bulk — gate de permisos (F2, apply chunk 1).
 *
 *  BMR-1 con messaging.bulk → la page monta
 *  BMR-2 sin messaging.bulk → RequirePermission bloquea con NoPermissionPage
 *
 * Molde: `WhatsappRoute.permission.test.tsx` (golden routing test) — layouts
 * mockeados a Outlet, page mockeada con marker, useAuth autenticado. El gate
 * real es RequirePermission (NO mockeado) leyendo useMyPermissions.
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

vi.mock('@/pages/whatsapp/BulkMessagingPage', () => ({
  default: () => React.createElement('div', null, '[PAGE:BulkMessaging]'),
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

describe('BMR-1: con messaging.bulk la page monta', () => {
  it('renderiza BulkMessagingPage en /admin/whatsapp/bulk', async () => {
    mockPerms(['messaging.bulk']);
    renderAt('/admin/whatsapp/bulk');
    expect(await screen.findByText('[PAGE:BulkMessaging]')).toBeInTheDocument();
  });
});

describe('BMR-2: sin messaging.bulk la ruta bloquea', () => {
  it('muestra NoPermissionPage y NO monta la page', async () => {
    mockPerms(['messaging.read']);
    renderAt('/admin/whatsapp/bulk');
    expect(await screen.findByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('[PAGE:BulkMessaging]')).not.toBeInTheDocument();
  });
});
