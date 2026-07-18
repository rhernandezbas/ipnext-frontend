import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
} from '@/hooks/useCannedResponses';
import type { CannedResponse, CreateCannedResponseInput } from '@/types/cannedResponses';
import { CannedResponseFormModal } from './CannedResponseFormModal';
import styles from './CannedResponsesSection.module.css';

type OpenModal = 'create' | 'edit' | 'delete' | null;

/**
 * CannedResponsesSection (Ola 4 — respuestas rápidas / macros) — ABM de
 * respuestas rápidas, sección de la Configuración de WhatsApp. Molde de
 * `WhatsappTemplatesPage` (DataTable + modales + toast local), gateada por
 * `messaging.manage` en el CALLER (`WhatsappSettingsPage`): si no tenés el
 * permiso, ni esta sección ni su encabezado se renderizan.
 *
 * 4 ramas de estado: loading (skeleton del DataTable) / empty (CTA crear) /
 * error (role=alert + reintento) / success. Toast local (role=status,
 * aria-live) — el repo no tiene un ToastProvider global (ver WhatsappInboxPage).
 *
 * Crear/editar → `CannedResponseFormModal` (shortcut+content, valida
 * client-side, muestra 409/400 legibles y NO cierra). Borrar → `ConfirmModal`
 * danger con el atajo en el mensaje.
 */
export function CannedResponsesSection() {
  const { data, isLoading, isError, refetch } = useCannedResponses();
  const createCanned = useCreateCannedResponse();
  const updateCanned = useUpdateCannedResponse();
  const deleteCanned = useDeleteCannedResponse();

  const [modal, setModal] = useState<OpenModal>(null);
  const [target, setTarget] = useState<CannedResponse | null>(null);

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
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function closeModal() {
    setModal(null);
    setTarget(null);
    createCanned.reset();
    updateCanned.reset();
    deleteCanned.reset();
  }

  function openCreate() {
    createCanned.reset();
    setTarget(null);
    setModal('create');
  }

  function openEdit(row: CannedResponse) {
    updateCanned.reset();
    setTarget(row);
    setModal('edit');
  }

  function openDelete(row: CannedResponse) {
    deleteCanned.reset();
    setTarget(row);
    setModal('delete');
  }

  function handleCreate(input: CreateCannedResponseInput) {
    createCanned.create(input, {
      onSuccess: () => {
        showToast('Respuesta rápida creada.');
        closeModal();
      },
    });
  }

  function handleEdit(input: CreateCannedResponseInput) {
    if (!target) return;
    updateCanned.update(
      { id: target.id, input },
      {
        onSuccess: () => {
          showToast('Respuesta rápida actualizada.');
          closeModal();
        },
      },
    );
  }

  function handleDelete() {
    if (!target) return;
    deleteCanned.remove(target.id, {
      onSuccess: () => {
        showToast('Respuesta rápida eliminada.');
        closeModal();
      },
      onError: () => {
        showToast('No se pudo eliminar la respuesta rápida. Reintentá.');
        closeModal();
      },
    });
  }

  const responses = data ?? [];
  const showEmpty = !isLoading && !isError && responses.length === 0;

  const columns = [
    { label: 'Atajo', key: 'shortcut' },
    {
      label: 'Contenido',
      key: 'content',
      render: (row: CannedResponse) => (
        <span className={styles.contentPreview} title={row.content}>
          {row.content}
        </span>
      ),
    },
  ];

  const actions = [
    { label: 'Editar', onClick: (row: CannedResponse) => openEdit(row) },
    { label: 'Borrar', onClick: (row: CannedResponse) => openDelete(row) },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.actionsRow}>
        <button type="button" className={styles.primaryBtn} onClick={openCreate}>
          Crear respuesta rápida
        </button>
      </div>

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {isError ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar las respuestas rápidas. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Todavía no hay respuestas rápidas.</p>
          <p className={styles.emptyText}>
            Creá tu primera respuesta rápida para insertarla desde el composer del inbox.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            Crear respuesta rápida
          </button>
        </div>
      ) : (
        <DataTable<CannedResponse>
          columns={columns}
          data={responses}
          loading={isLoading}
          actions={actions}
          emptyMessage="Todavía no hay respuestas rápidas."
        />
      )}

      <CannedResponseFormModal
        open={modal === 'create'}
        mode="create"
        busy={createCanned.isPending}
        serverError={createCanned.serverError}
        onSubmit={handleCreate}
        onCancel={closeModal}
      />

      <CannedResponseFormModal
        open={modal === 'edit'}
        mode="edit"
        initial={target ? { shortcut: target.shortcut, content: target.content } : undefined}
        busy={updateCanned.isPending}
        serverError={updateCanned.serverError}
        onSubmit={handleEdit}
        onCancel={closeModal}
      />

      <ConfirmModal
        open={modal === 'delete'}
        title="Eliminar respuesta rápida"
        message={
          target
            ? `Vas a eliminar la respuesta rápida "${target.shortcut}". Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Borrar"
        tone="danger"
        busy={deleteCanned.isPending}
        onConfirm={handleDelete}
        onCancel={closeModal}
      />
    </div>
  );
}
