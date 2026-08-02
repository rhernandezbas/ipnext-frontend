/**
 * OrdersTab (store-admin) — pedidos de la tienda, read-only.
 *
 *  OT-1 renderiza filas con producto/cliente/contrato/cuotas/precio/fecha
 *  OT-2 el link va al ID REAL (/admin/tickets/{ticketId}) y MUESTRA #{ticketNumber}
 *       — la ruta del panel resuelve por getById, un link por numero daria 404
 *  OT-3 sin ticketNumber muestra "—" (no rompe, no linkea a nada)
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

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

import { storeApi } from '@/api/store.api';
import { OrdersTab } from '@/pages/portal/StorePage/components/OrdersTab';
import type { StoreOrderDto } from '@/types/store';

const ORDER_WITH_TICKET: StoreOrderDto = {
  id: 'order-1',
  product: { title: 'Router WiFi 6' },
  client: { id: 'client-1', name: 'Juan Pérez' },
  contractId: 'contract-1',
  installments: 3,
  priceArsAtOrder: 45000.5,
  ticketId: 'ticket-uuid-128',
  ticketNumber: 128,
  createdAt: '2026-06-01T00:00:00.000Z',
};

const ORDER_WITHOUT_TICKET: StoreOrderDto = {
  ...ORDER_WITH_TICKET,
  id: 'order-2',
  ticketId: null,
  ticketNumber: null,
};

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<OrdersTab />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OT-1: renderiza filas', () => {
  it('muestra producto/cliente/contrato/cuotas/precio', async () => {
    vi.mocked(storeApi.listOrders).mockResolvedValue([ORDER_WITH_TICKET]);
    renderTab();

    await screen.findByText('Router WiFi 6');
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('contract-1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('OT-2: link al reclamo', () => {
  it('linkea al ID real y muestra el numero', async () => {
    vi.mocked(storeApi.listOrders).mockResolvedValue([ORDER_WITH_TICKET]);
    renderTab();

    const link = await screen.findByRole('link', { name: '#128' });
    expect(link).toHaveAttribute('href', '/admin/tickets/ticket-uuid-128');
  });
});

describe('OT-3: sin ticket', () => {
  it('muestra "—" sin link', async () => {
    vi.mocked(storeApi.listOrders).mockResolvedValue([ORDER_WITHOUT_TICKET]);
    renderTab();

    await screen.findByText('Router WiFi 6');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
