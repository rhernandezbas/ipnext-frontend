import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import { Can } from '@/components/auth/Can';
import {
  useCreateStoreProduct,
  useUpdateStoreProduct,
  useUploadStoreProductImage,
  useDeleteStoreProductImage,
  useStoreProducts,
} from '@/hooks/useStore';
import { deriveProductStatus } from '@/utils/productStatus';
import { formatMoney } from '@/utils/formatMoney';
import { toDecimalNumber } from '@/utils/decimal';
import type { CreateStoreProductInput } from '@/api/store.api';
import type { StoreProductDto } from '@/types/store';
import { ProductStatusBadge } from './ProductStatusBadge';
import { ProductFormModal, type ProductImageAction } from './ProductFormModal';
import { ProductActivateConfirmModal } from './ProductActivateConfirmModal';
import styles from './ProductsTab.module.css';

type OpenModal = 'create' | 'edit' | 'activate' | null;

const TOAST_MS = 4000;

/**
 * ProductsTab (store-admin) — ABM de los productos de la Tienda de la app de
 * clientes. Molde EXACTO de `PromosPage` (lista con estado derivado + form
 * modal + publicación/activación consciente + gating de escritura). Sin esto
 * la tienda de la app nace inerte (no hay otro lugar donde cargar productos).
 *
 * El estado (Borrador/Activo/Archivado) NO es un campo del BE — se deriva acá
 * con `deriveProductStatus` a partir de `active`/`archivedAt`.
 *
 * Sin DELETE en el contrato: archivar/desarchivar es un PATCH de `archivedAt`,
 * activar/desactivar es un PATCH de `active` — ambos vía `useUpdateStoreProduct`,
 * sin endpoints dedicados.
 *
 * Imagen: el BE SÍ tiene upload/delete dedicados (`POST`/`DELETE
 * /products/:id/image`) — el submit del form crea/actualiza el producto
 * PRIMERO (necesita el `id`) y DESPUÉS ejecuta la acción de imagen pendiente
 * (`ProductImageAction`), en ese orden, dentro de `handleFormSubmit`.
 */
export function ProductsTab() {
  const { data, isLoading, isError, refetch } = useStoreProducts();
  const createProduct = useCreateStoreProduct();
  const updateProduct = useUpdateStoreProduct();
  const uploadImage = useUploadStoreProductImage();
  const deleteImage = useDeleteStoreProductImage();

  const [modal, setModal] = useState<OpenModal>(null);
  const [target, setTarget] = useState<StoreProductDto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  function closeModal() {
    setModal(null);
    setTarget(null);
    createProduct.reset();
    updateProduct.reset();
  }

  function openCreate() {
    createProduct.reset();
    setTarget(null);
    setModal('create');
  }

  function openEdit(product: StoreProductDto) {
    updateProduct.reset();
    setTarget(product);
    setModal('edit');
  }

  function openActivate(product: StoreProductDto) {
    setTarget(product);
    setModal('activate');
  }

  async function handleFormSubmit(input: CreateStoreProductInput, imageAction: ProductImageAction) {
    setSubmitting(true);

    // Paso 1: crear/actualizar el producto. Si falla, el `serverError` de
    // `useCreateStoreProduct`/`useUpdateStoreProduct` ya queda actualizado
    // (mismo mecanismo que PromosPage) y el modal NO se cierra — se corta acá
    // en vez de depender del estado stale de la mutation dentro de un catch
    // compartido.
    let product: StoreProductDto;
    try {
      product =
        modal === 'edit' && target
          ? await updateProduct.updateAsync({ id: target.id, data: input })
          : await createProduct.createAsync(input);
    } catch {
      setSubmitting(false);
      return;
    }

    // Paso 2 (opcional): la acción de imagen pendiente. El producto YA quedó
    // persistido acá — si esto falla, se informa aparte y se cierra igual
    // (reintentar la imagen se hace editando el producto).
    if (imageAction.type !== 'none') {
      try {
        if (imageAction.type === 'upload') {
          await uploadImage.uploadAsync({ id: product.id, file: imageAction.file });
        } else {
          await deleteImage.removeAsync(product.id);
        }
      } catch {
        showToast('El producto se guardó, pero la imagen no se pudo subir. Reintentá desde Editar.');
        closeModal();
        setSubmitting(false);
        return;
      }
    }

    showToast(modal === 'edit' ? 'Producto actualizado.' : 'Producto creado como borrador.');
    closeModal();
    setSubmitting(false);
  }

  function handleActivateConfirm() {
    if (!target) return;
    updateProduct.update(
      { id: target.id, data: { active: true } },
      {
        onSuccess: () => {
          showToast('Producto activado — ya es visible en la tienda de la app.');
          closeModal();
        },
      },
    );
  }

  function handleDeactivate(product: StoreProductDto) {
    updateProduct.update(
      { id: product.id, data: { active: false } },
      { onSuccess: () => showToast('Producto desactivado.') },
    );
  }

  function handleArchive(product: StoreProductDto) {
    updateProduct.update(
      { id: product.id, data: { archivedAt: new Date().toISOString() } },
      { onSuccess: () => showToast('Producto archivado.') },
    );
  }

  function handleUnarchive(product: StoreProductDto) {
    updateProduct.update(
      { id: product.id, data: { archivedAt: null } },
      { onSuccess: () => showToast('Producto desarchivado.') },
    );
  }

  const products = data ?? [];
  const showEmpty = !isLoading && !isError && products.length === 0;

  const columns = [
    {
      label: 'Imagen',
      key: 'image',
      render: (row: StoreProductDto) =>
        row.imageStorageKey ? (
          <span className={styles.imageIndicator} data-variant="has-image" aria-label="Tiene imagen cargada">
            <ImageIcon />
          </span>
        ) : (
          <span className={styles.imageIndicator} data-variant="no-image" aria-label="Sin imagen">
            <ImageOffIcon />
          </span>
        ),
    },
    { label: 'Título', key: 'title' },
    {
      label: 'Estado',
      key: 'status',
      render: (row: StoreProductDto) => <ProductStatusBadge status={deriveProductStatus(row)} />,
    },
    {
      label: 'Precio',
      key: 'priceArs',
      render: (row: StoreProductDto) => formatMoney(toDecimalNumber(row.priceArs), 'ARS'),
    },
    {
      label: 'Cuotas',
      key: 'maxInstallments',
      render: (row: StoreProductDto) => `hasta ${row.maxInstallments}`,
    },
    { label: 'Orden', key: 'sortOrder' },
    {
      label: 'Acciones',
      key: 'actions',
      render: (row: StoreProductDto) => (
        <Can permission="store.manage">
          <KebabMenu items={buildRowActions(row)} />
        </Can>
      ),
    },
  ];

  function buildRowActions(row: StoreProductDto) {
    const status = deriveProductStatus(row);
    const items: { label: string; onClick: () => void }[] = [{ label: 'Editar', onClick: () => openEdit(row) }];
    if (status === 'archived') {
      items.push({ label: 'Desarchivar', onClick: () => handleUnarchive(row) });
      return items;
    }
    if (status === 'draft') {
      items.push({ label: 'Activar', onClick: () => openActivate(row) });
    } else {
      items.push({ label: 'Desactivar', onClick: () => handleDeactivate(row) });
    }
    items.push({ label: 'Archivar', onClick: () => handleArchive(row) });
    return items;
  }

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <Can permission="store.manage">
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            Crear producto
          </button>
        </Can>
      </div>

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {isError ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar los productos. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Todavía no hay productos.</p>
          <p className={styles.emptyText}>Creá el primer producto para que aparezca en la tienda de la app.</p>
          <Can permission="store.manage">
            <button type="button" className={styles.primaryBtn} onClick={openCreate}>
              Crear producto
            </button>
          </Can>
        </div>
      ) : (
        <DataTable<StoreProductDto>
          columns={columns}
          data={products}
          loading={isLoading}
          emptyMessage="Todavía no hay productos."
        />
      )}

      <ProductFormModal
        key={modal === 'edit' ? target?.id : 'create'}
        open={modal === 'create' || modal === 'edit'}
        mode={modal === 'edit' ? 'edit' : 'create'}
        initial={modal === 'edit' ? target : null}
        busy={submitting}
        serverError={modal === 'edit' ? updateProduct.serverError : createProduct.serverError}
        onSubmit={handleFormSubmit}
        onCancel={closeModal}
      />

      <ProductActivateConfirmModal
        open={modal === 'activate'}
        product={target}
        activating={updateProduct.isPending}
        onConfirm={handleActivateConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function ImageOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
    </svg>
  );
}
