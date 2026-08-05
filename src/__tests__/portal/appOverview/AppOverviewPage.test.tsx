/**
 * AppOverviewPage (gestion-app) — portada de "Gestión de App".
 *
 *  AO-1 con los endpoints OK muestra los números REALES de cada tarjeta
 *  AO-2 DEGRADACIÓN — con TODOS los endpoints caídos la página igual renderiza
 *       los accesos y NINGUNA tarjeta muestra un número (regla dura: nunca un
 *       número inventado, nunca un error que rompa la página)
 *  AO-3 la degradación es POR TARJETA: la que falla pierde su número, las
 *       demás siguen mostrando el suyo
 *  AO-4 gating por permiso: sin `promos.read` la tarjeta de Promociones no está
 *  AO-5 estado vacío (0 promos publicadas) NO se confunde con "sin datos"
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/promos.api', () => ({
  promosApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    audiencePreview: vi.fn(),
  },
}));

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

vi.mock('@/api/portalAccounts.api', () => ({
  portalAccountsApi: { list: vi.fn() },
}));

vi.mock('@/api/settings.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/settings.api')>();
  return { ...actual, getClientPortalSettings: vi.fn() };
});

import { promosApi } from '@/api/promos.api';
import { storeApi } from '@/api/store.api';
import { portalAccountsApi } from '@/api/portalAccounts.api';
import { getClientPortalSettings } from '@/api/settings.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import AppOverviewPage from '@/pages/portal/AppOverviewPage/AppOverviewPage';
import type { PromoAdminDto } from '@/types/promos';
import type { StoreProductDto, StoreOrderDto } from '@/types/store';
import type { ClientPortalSettings } from '@/types/settings';

const FUTURE = '2099-01-01T00:00:00.000Z';

function promo(id: string, overrides: Partial<PromoAdminDto> = {}): PromoAdminDto {
  return {
    id,
    title: `Promo ${id}`,
    summary: 's',
    body: 'b',
    imageStorageKey: null,
    ctaLabel: 'Ver',
    ticketAreaId: null,
    segment: { statuses: [], balanceMin: null, balanceMax: null, networkSiteId: null, accessPointId: null },
    startsAt: '2020-01-01T00:00:00.000Z',
    endsAt: FUTURE,
    publishedAt: '2020-01-02T00:00:00.000Z',
    archivedAt: null,
    authorId: null,
    authorName: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function product(id: string, overrides: Partial<StoreProductDto> = {}): StoreProductDto {
  return {
    id,
    title: `Producto ${id}`,
    summary: 's',
    description: 'd',
    priceArs: 1000,
    maxInstallments: 1,
    warrantyText: 'w',
    badge: null,
    imageStorageKey: null,
    ticketAreaId: null,
    active: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ORDER: StoreOrderDto = {
  id: 'order-1',
  product: { title: 'Router' },
  client: { id: 'c1', name: 'Juan' },
  contractId: 'ct-1',
  installments: 1,
  priceArsAtOrder: 1000,
  ticketId: null,
  ticketNumber: null,
  createdAt: '2020-01-01T00:00:00.000Z',
};

const PORTAL_SETTINGS: ClientPortalSettings = {
  enabled: true,
  portalUrl: 'https://portal.example',
  allowSelfRegistration: false,
  requireEmailVerification: false,
  allowPaymentOnline: true,
  allowTicketCreation: true,
  allowServiceManagement: false,
  welcomeMessage: 'hola',
  logoUrl: null,
  primaryColor: '#0d6efd',
  customCss: '',
};

function mockPerms(overrides: Partial<UseMyPermissionsResult> = {}) {
  const base: UseMyPermissionsResult = {
    user: null,
    roles: [],
    permissions: ['*'],
    isLoading: false,
    isError: false,
    can: () => true,
  };
  vi.mocked(useMyPermissions).mockReturnValue({ ...base, ...overrides });
}

/** Todos los endpoints respondiendo bien. */
function mockAllOk() {
  vi.mocked(promosApi.list).mockResolvedValue([
    promo('p1'),
    promo('p2'),
    promo('p3', { publishedAt: null }), // borrador — NO cuenta como publicada
  ]);
  vi.mocked(storeApi.listProducts).mockResolvedValue([
    product('s1'),
    product('s2'),
    product('s3', { active: false }), // borrador — NO cuenta como activo
  ]);
  vi.mocked(storeApi.listOrders).mockResolvedValue([ORDER]);
  vi.mocked(portalAccountsApi.list).mockResolvedValue({ data: [], total: 128, page: 1, limit: 1 });
  vi.mocked(getClientPortalSettings).mockResolvedValue(PORTAL_SETTINGS);
}

/** Todos los endpoints caídos. */
function mockAllDown() {
  const boom = () => Promise.reject(new Error('boom'));
  vi.mocked(promosApi.list).mockImplementation(boom);
  vi.mocked(storeApi.listProducts).mockImplementation(boom);
  vi.mocked(storeApi.listOrders).mockImplementation(boom);
  vi.mocked(portalAccountsApi.list).mockImplementation(boom);
  vi.mocked(getClientPortalSettings).mockImplementation(boom);
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<AppOverviewPage />, { wrapper });
}

/** Los 5 accesos que la portada DEBE ofrecer siempre, pase lo que pase con los datos. */
const ACCESOS: { name: RegExp; href: string }[] = [
  { name: /promociones/i, href: '/admin/portal/promos' },
  { name: /tienda/i, href: '/admin/portal/store' },
  { name: /avisos push/i, href: '/admin/portal/push' },
  { name: /cuentas de la app/i, href: '/admin/portal/users' },
  { name: /configuración de la app/i, href: '/admin/portal' },
];

/**
 * "¿este texto contiene EXACTAMENTE este número?" — `\b` no sirve acá: el
 * `textContent` de la métrica pega la etiqueta al valor ("Productos activos2"),
 * y entre `s` y `2` no hay frontera de palabra. Los lookaround por dígito sí
 * distinguen el `2` suelto del `2` que vive dentro de `128`.
 */
function hasNumber(text: string | null, n: number): boolean {
  return new RegExp(`(?<!\\d)${n}(?!\\d)`).test(text ?? '');
}

const METRIC_TESTIDS = [
  'metric-promos',
  'metric-store-products',
  'metric-store-orders',
  'metric-accounts',
  'metric-app-status',
];

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms();
});

describe('AO-1: datos reales', () => {
  it('muestra los números que devuelven los endpoints', async () => {
    mockAllOk();
    renderPage();

    // 2 publicadas de 3 (la tercera es borrador).
    await waitFor(() => expect(hasNumber(screen.getByTestId('metric-promos').textContent, 2)).toBe(true));
    // 2 productos activos de 3.
    expect(hasNumber(screen.getByTestId('metric-store-products').textContent, 2)).toBe(true);
    expect(hasNumber(screen.getByTestId('metric-store-orders').textContent, 1)).toBe(true);
    await waitFor(() => expect(hasNumber(screen.getByTestId('metric-accounts').textContent, 128)).toBe(true));
    await waitFor(() => expect(screen.getByTestId('metric-app-status').textContent).toMatch(/activada/i));
  });

  it('pide UNA sola fila de cuentas — sólo necesita el total, no la lista', async () => {
    mockAllOk();
    renderPage();
    await waitFor(() => expect(portalAccountsApi.list).toHaveBeenCalled());
    expect(vi.mocked(portalAccountsApi.list).mock.calls[0]?.[0]).toMatchObject({ limit: 1 });
  });
});

describe('AO-2: degradación con TODO caído', () => {
  it('renderiza igual y ofrece los 5 accesos', async () => {
    mockAllDown();
    renderPage();

    // PRESENCIA primero: si los accesos no estuvieran, la ausencia de números
    // de abajo daría verde por la razón equivocada.
    for (const acceso of ACCESOS) {
      const link = await screen.findByRole('link', { name: acceso.name });
      expect(link).toHaveAttribute('href', acceso.href);
    }
    expect(screen.getByRole('heading', { level: 1, name: /resumen/i })).toBeInTheDocument();
  });

  it('NINGUNA tarjeta muestra un número', async () => {
    mockAllDown();
    renderPage();

    for (const testId of METRIC_TESTIDS) {
      await waitFor(() => {
        expect(screen.getByTestId(testId).textContent).toMatch(/sin datos/i);
      });
      expect(screen.getByTestId(testId).textContent).not.toMatch(/\d/);
    }
  });
});

describe('AO-3: degradación POR TARJETA', () => {
  it('la tarjeta que falla pierde su número; las otras conservan el suyo', async () => {
    mockAllOk();
    vi.mocked(promosApi.list).mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => expect(screen.getByTestId('metric-promos').textContent).toMatch(/sin datos/i));
    expect(screen.getByTestId('metric-promos').textContent).not.toMatch(/\d/);
    // La tienda no se enteró de nada.
    await waitFor(() => expect(hasNumber(screen.getByTestId('metric-store-products').textContent, 2)).toBe(true));
    await waitFor(() => expect(hasNumber(screen.getByTestId('metric-accounts').textContent, 128)).toBe(true));
  });
});

describe('AO-4: gating por permiso', () => {
  it('sin promos.read la tarjeta de Promociones no se renderiza (ni se pide el endpoint)', async () => {
    mockAllOk();
    mockPerms({ permissions: ['portal.read'], can: (p) => (Array.isArray(p) ? false : p === 'portal.read') });
    renderPage();

    await screen.findByRole('link', { name: /cuentas de la app/i });
    expect(screen.queryByRole('link', { name: /promociones/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('metric-promos')).not.toBeInTheDocument();
    expect(promosApi.list).not.toHaveBeenCalled();
  });

  it('sin push.send la tarjeta de Avisos push no se renderiza', async () => {
    mockAllOk();
    mockPerms({ permissions: ['portal.read'], can: (p) => (Array.isArray(p) ? false : p === 'portal.read') });
    renderPage();

    await screen.findByRole('link', { name: /cuentas de la app/i });
    expect(screen.queryByRole('link', { name: /avisos push/i })).not.toBeInTheDocument();
  });
});

describe('AO-5: vacío ≠ sin datos', () => {
  it('0 promos publicadas dice "Ninguna publicada", no "Sin datos"', async () => {
    mockAllOk();
    vi.mocked(promosApi.list).mockResolvedValue([]);
    renderPage();

    await waitFor(() => expect(screen.getByTestId('metric-promos').textContent).toMatch(/ninguna publicada/i));
    expect(screen.getByTestId('metric-promos').textContent).not.toMatch(/sin datos/i);
  });
});
