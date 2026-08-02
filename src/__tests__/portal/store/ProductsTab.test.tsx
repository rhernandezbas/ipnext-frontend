/**
 * ProductsTab (store-admin) — ABM de productos de la Tienda de la app.
 * Molde de `PromosPage.test.tsx`. Container: hooks REALES (`useStoreProducts`/
 * `useCreateStoreProduct`/`useUpdateStoreProduct`/`useUploadStoreProductImage`/
 * `useDeleteStoreProductImage`), `@/api/store.api` + `@/api/ticketAreas.api`
 * mockeadas a nivel fetch. `useMyPermissions` viene del mock global permisivo
 * (setup.ts, can:()=>true) — el gating negativo vive en
 * `ProductsTab.permissions.test.tsx`.
 *
 *  PT-1 lista deriva los 3 estados (Borrador/Activo/Archivado) desde una fixture mixta
 *  PT-2 editar: el form precarga TODOS los campos (texto, precio, cuotas, garantía, badge, orden)
 *  PT-3 crear: precio "45.000,50" tipeado es-AR → el body de la mutación lleva 45000.5 (number)
 *  PT-4 preview de cuotas: recalcula en vivo al cambiar precio/cuotas (45000/3, con decimales no redondos)
 *  PT-5 activar: pide confirmación con el resumen y NO llama a update si se cancela
 *  PT-6 activar: confirmar llama a update con active:true
 *  PT-7 imagen: archivo no-imagen o >8MB → error local, SIN llamar a la API de imagen
 *  PT-8 imagen: un archivo válido se sube DESPUÉS de crear el producto (con el id real)
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('@/api/ticketAreas.api', () => ({
  ticketAreasApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { storeApi } from '@/api/store.api';
import { ticketAreasApi } from '@/api/ticketAreas.api';
import { ProductsTab } from '@/pages/portal/StorePage/components/ProductsTab';
import type { StoreProductDto } from '@/types/store';

const DRAFT_1: StoreProductDto = {
  id: 'product-draft-1',
  title: 'Router WiFi 6',
  summary: 'Cobertura total',
  description: 'Descripción larga del router 1',
  priceArs: 45000.5,
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

const DRAFT_2: StoreProductDto = { ...DRAFT_1, id: 'product-draft-2', title: 'Repetidor WiFi' };

const ACTIVE_1: StoreProductDto = { ...DRAFT_1, id: 'product-active-1', title: 'Cámara IP', active: true };

const ARCHIVED_1: StoreProductDto = {
  ...DRAFT_1,
  id: 'product-archived-1',
  title: 'Modem viejo',
  active: true,
  archivedAt: '2026-03-01T00:00:00.000Z',
};

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
});

describe('PT-1: lista — 3 estados derivados', () => {
  it('renderiza el badge textual correcto para Borrador (x2), Activo y Archivado', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([DRAFT_1, DRAFT_2, ACTIVE_1, ARCHIVED_1]);
    renderTab();

    await screen.findByText('Router WiFi 6');
    expect(screen.getAllByText('Borrador')).toHaveLength(2);
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Archivado')).toBeInTheDocument();
  });
});

describe('PT-2: editar — precarga TODOS los campos', () => {
  it('precarga título/resumen/descripción/precio/cuotas/garantía/orden del producto original', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([ACTIVE_1]);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Cámara IP');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Editar producto')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Título')).toHaveValue(ACTIVE_1.title);
    expect(within(dialog).getByLabelText('Resumen')).toHaveValue(ACTIVE_1.summary);
    expect(within(dialog).getByLabelText('Descripción')).toHaveValue(ACTIVE_1.description);
    expect(within(dialog).getByLabelText('Cuotas máximas')).toHaveValue(3);
    expect(within(dialog).getByLabelText('Garantía')).toHaveValue(ACTIVE_1.warrantyText);
    expect(within(dialog).getByLabelText('Orden')).toHaveValue(1);
    const expectedPrice = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(
      45000.5,
    );
    expect(within(dialog).getByLabelText('Precio (ARS)')).toHaveValue(expectedPrice);
  });
});

describe('PT-3: crear — el precio es-AR se manda como number', () => {
  it('createProduct recibe priceArs: 45000.5 (number), no el string crudo', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([]);
    vi.mocked(storeApi.createProduct).mockResolvedValue({ ...DRAFT_1, id: 'product-new' });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText(/todavía no hay productos/i);
    await user.click(screen.getAllByRole('button', { name: /crear producto/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Título'), 'Producto nuevo');
    await user.type(within(dialog).getByLabelText('Resumen'), 'Resumen corto');
    await user.type(within(dialog).getByLabelText('Descripción'), 'Descripción larga');
    fireEvent.change(within(dialog).getByLabelText('Precio (ARS)'), { target: { value: '45.000,50' } });

    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }));

    await waitFor(() =>
      expect(storeApi.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Producto nuevo',
          summary: 'Resumen corto',
          description: 'Descripción larga',
          priceArs: 45000.5,
        }),
      ),
    );
  });
});

describe('PT-4: preview de cuotas en vivo', () => {
  it('recalcula "N cuotas de $X" al cambiar precio/cuotas, con decimales no redondos', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([]);
    renderTab();

    await screen.findByText(/todavía no hay productos/i);
    fireEvent.click(screen.getAllByRole('button', { name: /crear producto/i })[0]);
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Precio (ARS)'), { target: { value: '45.000,50' } });
    fireEvent.change(within(dialog).getByLabelText('Cuotas máximas'), { target: { value: '3' } });

    // 45000.50 / 3 = 15000.166... — el preview no debe mostrar un número redondo mágico.
    await waitFor(() => expect(within(dialog).getByText(/3 cuotas de/)).toBeInTheDocument());
    const preview = within(dialog).getByText(/3 cuotas de/);
    expect(preview).toHaveTextContent(/15\.000,1[67]/);
  });
});

describe('PT-5/PT-6: activar — confirmación consciente', () => {
  it('pide confirmación mostrando el resumen y NO llama a update si se cancela', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([DRAFT_1]);
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Router WiFi 6');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Activar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Activar producto')).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(DRAFT_1.title))).toBeInTheDocument();
    expect(within(dialog).getByText(/hasta 3/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(storeApi.updateProduct).not.toHaveBeenCalled();
  });

  it('confirmar llama a update con active:true', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([DRAFT_1]);
    vi.mocked(storeApi.updateProduct).mockResolvedValue({ ...DRAFT_1, active: true });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText('Router WiFi 6');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Activar' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Activar' }));

    await waitFor(() =>
      expect(storeApi.updateProduct).toHaveBeenCalledWith(DRAFT_1.id, expect.objectContaining({ active: true })),
    );
  });
});

describe('PT-7: imagen inválida — error local, SIN llamar a la API', () => {
  it('un archivo no-imagen muestra error y no dispara ninguna llamada de imagen', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([]);
    renderTab();

    await screen.findByText(/todavía no hay productos/i);
    fireEvent.click(screen.getAllByRole('button', { name: /crear producto/i })[0]);
    const dialog = await screen.findByRole('dialog');

    const fileInput = within(dialog).getByLabelText(/imagen del producto/i) as HTMLInputElement;
    const badFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    // fireEvent (no `userEvent.upload`): el `accept="image/*"` del input ya
    // filtra en el picker del SO, pero un usuario puede elegir "todos los
    // archivos" y saltearlo — exactamente el caso que la validación LOCAL
    // tiene que cazar. `userEvent.upload` respeta `accept` y jamás dispara el
    // `change` con un archivo no permitido, así que no ejercita esta rama.
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/no es una imagen/i);
    expect(storeApi.uploadProductImage).not.toHaveBeenCalled();
  });

  it('una imagen que supera 8MB muestra error y no dispara ninguna llamada de imagen', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([]);
    renderTab();

    await screen.findByText(/todavía no hay productos/i);
    fireEvent.click(screen.getAllByRole('button', { name: /crear producto/i })[0]);
    const dialog = await screen.findByRole('dialog');

    const fileInput = within(dialog).getByLabelText(/imagen del producto/i) as HTMLInputElement;
    const bigFile = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'grande.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, bigFile);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/supera el límite/i);
    expect(storeApi.uploadProductImage).not.toHaveBeenCalled();
  });
});

describe('PT-8: imagen válida — se sube DESPUÉS de crear el producto', () => {
  it('crea el producto y luego sube la imagen con el id real devuelto', async () => {
    vi.mocked(storeApi.listProducts).mockResolvedValue([]);
    vi.mocked(storeApi.createProduct).mockResolvedValue({ ...DRAFT_1, id: 'product-brand-new' });
    vi.mocked(storeApi.uploadProductImage).mockResolvedValue({ ...DRAFT_1, id: 'product-brand-new', imageStorageKey: 'k1' });
    const user = userEvent.setup();
    renderTab();

    await screen.findByText(/todavía no hay productos/i);
    await user.click(screen.getAllByRole('button', { name: /crear producto/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Título'), 'Producto con foto');
    await user.type(within(dialog).getByLabelText('Resumen'), 'Resumen');
    await user.type(within(dialog).getByLabelText('Descripción'), 'Descripción');
    fireEvent.change(within(dialog).getByLabelText('Precio (ARS)'), { target: { value: '10000' } });

    const fileInput = within(dialog).getByLabelText(/imagen del producto/i) as HTMLInputElement;
    const goodFile = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await userEvent.upload(fileInput, goodFile);

    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => expect(storeApi.createProduct).toHaveBeenCalled());
    await waitFor(() => expect(storeApi.uploadProductImage).toHaveBeenCalledWith('product-brand-new', goodFile));
  });
});
