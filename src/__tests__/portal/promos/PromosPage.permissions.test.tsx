/**
 * PromosPage — gating de escritura (promos-admin). Sin `promos.manage`, los
 * botones de crear/editar/publicar/archivar NO se renderizan — no alcanza
 * con deshabilitarlos (mismo criterio que el resto del panel, `<Can
 * permission="...">`). `useMyPermissions` mockeado directamente (molde
 * `SegmentBuilder.permissions.test.tsx`), NO el mock global permisivo de
 * setup.ts.
 *
 *  PPP-1 con promos.read pero SIN promos.manage → no hay botón "Crear
 *        promoción" ni menú de "Acciones" en las filas
 *  PPP-2 con promos.manage → el botón "Crear promoción" y "Acciones" SÍ se ven
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/hooks/useMyPermissions');

vi.mock('@/api/promos.api', () => ({
  promosApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    audiencePreview: vi.fn(),
  },
}));

vi.mock('@/api/ticketAreas.api', () => ({
  ticketAreasApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { promosApi } from '@/api/promos.api';
import { ticketAreasApi } from '@/api/ticketAreas.api';
import PromosPage from '@/pages/portal/PromosPage/PromosPage';
import type { PromoAdminDto } from '@/types/promos';

const PROMO: PromoAdminDto = {
  id: 'promo-1',
  title: 'Subí a 600MB',
  summary: 'Duplicá tu velocidad',
  body: 'Texto largo',
  imageStorageKey: null,
  ctaLabel: 'Me interesa',
  ticketAreaId: null,
  segment: { statuses: ['active'], balanceMin: null, balanceMax: null, networkSiteId: null, accessPointId: null },
  startsAt: '2026-06-01T00:00:00.000Z',
  endsAt: '2026-12-31T00:00:00.000Z',
  publishedAt: null,
  archivedAt: null,
  authorId: 'user-1',
  authorName: 'superadmin',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

/** Mockea permisos a partir de la lista concedida (molde de SegmentBuilder.permissions.test.tsx). */
function mockPerms(granted: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted,
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => {
      if (granted.includes('*')) return true;
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some((p) => granted.includes(p));
    },
  } as UseMyPermissionsResult);
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<PromosPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ticketAreasApi.list).mockResolvedValue([]);
  vi.mocked(promosApi.list).mockResolvedValue([PROMO]);
});

describe('PPP-1: sin promos.manage', () => {
  it('no renderiza "Crear promoción" ni el menú de Acciones de la fila', async () => {
    mockPerms(['promos.read']);
    renderPage();

    await screen.findByText('Subí a 600MB');
    expect(screen.queryByRole('button', { name: /crear promoción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument();
  });
});

describe('PPP-2: con promos.manage', () => {
  it('renderiza "Crear promoción" y el menú de Acciones de la fila', async () => {
    mockPerms(['promos.read', 'promos.manage']);
    renderPage();

    await screen.findByText('Subí a 600MB');
    expect(screen.getByRole('button', { name: /crear promoción/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acciones' })).toBeInTheDocument();
  });
});
