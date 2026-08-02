import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import { Can } from '@/components/auth/Can';
import { useCreatePromo, useUpdatePromo, usePromos } from '@/hooks/usePromos';
import { derivePromoStatus } from '@/utils/promoStatus';
import { formatDateShort } from '@/utils/formatDate';
import type { CreatePromoInput } from '@/api/promos.api';
import type { PromoAdminDto } from '@/types/promos';
import { PromoStatusBadge } from './components/PromoStatusBadge';
import { PromoFormModal } from './components/PromoFormModal';
import { PromoPublishConfirmModal } from './components/PromoPublishConfirmModal';
import styles from './PromosPage.module.css';

type OpenModal = 'create' | 'edit' | 'publish' | null;

const TOAST_MS = 4000;

/**
 * PromosPage (promos-admin) — ABM de las promociones que ven los clientes en
 * la app. Página gateada `promos.read` (RequirePermission en la ruta); las
 * acciones de ESCRITURA (crear/editar/publicar/archivar) van gateadas con
 * `<Can permission="promos.manage">` (doble capa: leer ≠ escribir, mismo
 * molde que `WhatsappTemplatesPage`/`messaging.templates` vs `messaging.bulk`).
 *
 * El estado (Borrador/Publicada/Vencida/Archivada) NO es un campo del BE — se
 * deriva acá con `derivePromoStatus` (`utils/promoStatus.ts`) a partir de
 * `publishedAt`/`archivedAt`/`endsAt` contra "ahora".
 *
 * No hay DELETE en el contrato del BE: archivar/desarchivar es un PATCH de
 * `archivedAt` (`useUpdatePromo`), publicar es un PATCH de `publishedAt` —
 * ambos vía la MISMA mutation genérica, sin endpoints dedicados.
 */
export default function PromosPage() {
  const { data, isLoading, isError, refetch } = usePromos();
  const createPromo = useCreatePromo();
  const updatePromo = useUpdatePromo();

  const [modal, setModal] = useState<OpenModal>(null);
  const [target, setTarget] = useState<PromoAdminDto | null>(null);

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
    createPromo.reset();
    updatePromo.reset();
  }

  function openCreate() {
    createPromo.reset();
    setTarget(null);
    setModal('create');
  }

  function openEdit(promo: PromoAdminDto) {
    updatePromo.reset();
    setTarget(promo);
    setModal('edit');
  }

  function openPublish(promo: PromoAdminDto) {
    setTarget(promo);
    setModal('publish');
  }

  function handleFormSubmit(input: CreatePromoInput) {
    if (modal === 'edit' && target) {
      updatePromo.update(
        { id: target.id, data: input },
        {
          onSuccess: () => {
            showToast('Promoción actualizada.');
            closeModal();
          },
        },
      );
      return;
    }
    createPromo.create(input, {
      onSuccess: () => {
        showToast('Promoción creada como borrador.');
        closeModal();
      },
    });
  }

  function handlePublishConfirm() {
    if (!target) return;
    updatePromo.update(
      { id: target.id, data: { publishedAt: new Date().toISOString() } },
      {
        onSuccess: () => {
          showToast('Promoción publicada — ya es visible en la app para quien matchee el segmento.');
          closeModal();
        },
      },
    );
  }

  function handleArchive(promo: PromoAdminDto) {
    updatePromo.update(
      { id: promo.id, data: { archivedAt: new Date().toISOString() } },
      { onSuccess: () => showToast('Promoción archivada.') },
    );
  }

  function handleUnarchive(promo: PromoAdminDto) {
    updatePromo.update(
      { id: promo.id, data: { archivedAt: null } },
      { onSuccess: () => showToast('Promoción desarchivada.') },
    );
  }

  const promos = data ?? [];
  const showEmpty = !isLoading && !isError && promos.length === 0;

  const columns = [
    { label: 'Título', key: 'title' },
    {
      label: 'Estado',
      key: 'status',
      render: (row: PromoAdminDto) => <PromoStatusBadge status={derivePromoStatus(row)} />,
    },
    {
      label: 'Vigencia',
      key: 'vigencia',
      render: (row: PromoAdminDto) => `${formatDateShort(row.startsAt)} – ${formatDateShort(row.endsAt)}`,
    },
    {
      label: 'Autor',
      key: 'authorName',
      render: (row: PromoAdminDto) => row.authorName ?? '—',
    },
    {
      label: 'Acciones',
      key: 'actions',
      render: (row: PromoAdminDto) => (
        <Can permission="promos.manage">
          <KebabMenu items={buildRowActions(row)} />
        </Can>
      ),
    },
  ];

  function buildRowActions(row: PromoAdminDto) {
    const status = derivePromoStatus(row);
    const items: { label: string; onClick: () => void }[] = [
      { label: 'Editar', onClick: () => openEdit(row) },
    ];
    if (status === 'draft') {
      items.push({ label: 'Publicar', onClick: () => openPublish(row) });
    }
    if (status === 'archived') {
      items.push({ label: 'Desarchivar', onClick: () => handleUnarchive(row) });
    } else {
      items.push({ label: 'Archivar', onClick: () => handleArchive(row) });
    }
    return items;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Portal /</span>
          <h1 className={styles.title}>Promociones</h1>
        </div>
        <Can permission="promos.manage">
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            Crear promoción
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
          <p className={styles.errorText}>No se pudieron cargar las promociones. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Todavía no hay promociones.</p>
          <p className={styles.emptyText}>Creá la primera promoción para que la vean los clientes en la app.</p>
          <Can permission="promos.manage">
            <button type="button" className={styles.primaryBtn} onClick={openCreate}>
              Crear promoción
            </button>
          </Can>
        </div>
      ) : (
        <DataTable<PromoAdminDto>
          columns={columns}
          data={promos}
          loading={isLoading}
          emptyMessage="Todavía no hay promociones."
        />
      )}

      <PromoFormModal
        key={modal === 'edit' ? target?.id : 'create'}
        open={modal === 'create' || modal === 'edit'}
        mode={modal === 'edit' ? 'edit' : 'create'}
        initial={modal === 'edit' ? target : null}
        busy={modal === 'edit' ? updatePromo.isPending : createPromo.isPending}
        serverError={modal === 'edit' ? updatePromo.serverError : createPromo.serverError}
        onSubmit={handleFormSubmit}
        onCancel={closeModal}
      />

      <PromoPublishConfirmModal
        open={modal === 'publish'}
        promo={target}
        publishing={updatePromo.isPending}
        onConfirm={handlePublishConfirm}
        onCancel={closeModal}
      />
    </div>
  );
}
