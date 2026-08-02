/**
 * ProductsTab — gating de escritura (store-admin). Sin `store.manage`, los
 * botones de crear/editar/activar/desactivar/archivar NO se renderizan — no
 * alcanza con deshabilitarlos (`<Can permission="...">`, mismo criterio que
 * `PromosPage.permissions.test.tsx`). `useMyPermissions` mockeado
 * directamente (NO el mock global permisivo de setup.ts).
 *
 *  PPT-1 con store.read pero SIN store.manage → no hay botón "Crear
 *        producto" ni menú de "Acciones" en las filas
 *  PPT-2 con store.manage → el botón "Crear producto" y "Acciones" SÍ se ven
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/hooks/useMyPermissions');

vi.mock('@/api/store.api', () => ({
  storeApi: {
    listProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    uploadProductImage: vi.fn(),
    deleteProductImage: vi.fn(),
    listOrders: vi.fn(),
  },
}));

vi.mock('@/api/ticketAreas.api', () => ({
  ticketAreasApi: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { storeApi } from '@/api/store.api';
import { ticketAreasApi } from '@/api/ticketAreas.api';
import { ProductsTab } from '@/pages/portal/StorePage/components/ProductsTab';
import type { StoreProductDto } from '@/types/store';

const PRODUCT: StoreProductDto = {
  id: 'product-1',
  title: 'Router WiFi 6',
  summary: 'Cobertura total',
  description: 'Descripción larga',
  priceArs: 45000,
  maxInstallments: 3,
  warrantyText: '6 meses legal + garantía del fabricante',
  badge: null,
  imageStorageKey: null,
  ticketAreaId: null,
  active: false,
  sortOrder: 1,
  archivedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

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

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<ProductsTab />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ticketAreasApi.list).mockResolvedValue([]);
  vi.mocked(storeApi.listProducts).mockResolvedValue([PRODUCT]);
});

describe('PPT-1: sin store.manage', () => {
  it('no renderiza "Crear producto" ni el menú de Acciones de la fila', async () => {
    mockPerms(['store.read']);
    renderTab();

    await screen.findByText('Router WiFi 6');
    expect(screen.queryByRole('button', { name: /crear producto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones' })).not.toBeInTheDocument();
  });
});

describe('PPT-2: con store.manage', () => {
  it('renderiza "Crear producto" y el menú de Acciones de la fila', async () => {
    mockPerms(['store.read', 'store.manage']);
    renderTab();

    await screen.findByText('Router WiFi 6');
    expect(screen.getByRole('button', { name: /crear producto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acciones' })).toBeInTheDocument();
  });
});
