import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import { Can } from '@/components/auth/Can';
import {
  useTemplatesList,
  useCreateTemplate,
  useSubmitTemplate,
  useDeleteTemplate,
} from '@/hooks/useTemplatesAdmin';
import type {
  CreateTemplateInput,
  SubmitTemplateInput,
  TemplateDetailDto,
} from '@/types/messagingTemplates';
import { TemplateApprovalBadge } from './components/TemplateApprovalBadge';
import { TemplateFormModal } from './components/TemplateFormModal';
import { SubmitTemplateModal } from './components/SubmitTemplateModal';
import { DeleteTemplateModal } from './components/DeleteTemplateModal';
import styles from './WhatsappTemplatesPage.module.css';

/** Fila de la tabla — el `DataTable` exige un `id`; lo derivamos del contentSid. */
type TemplateRow = TemplateDetailDto & { id: string };

type OpenModal = 'create' | 'clone' | 'submit' | 'delete' | null;

/**
 * WhatsappTemplatesPage (Change 3) — ABM de templates WhatsApp. Página gateada
 * a `messaging.templates` (RequirePermission en la ruta); los botones de
 * ESCRITURA (crear/enviar/borrar/clonar) van gateados con `<Can
 * permission="messaging.bulk">` (doble capa: leer ≠ escribir).
 *
 * 4 ramas de estado (patrón F1): loading (skeleton del DataTable) / empty (CTA
 * crear) / error (role=alert + reintento) / success. Toast local (role=status,
 * aria-live) — el repo no tiene un ToastProvider global (ver WhatsappInboxPage).
 *
 * "Editar un aprobado" NO existe (Meta no deja): la acción es CLONAR (crea una
 * versión nueva con el body pre-cargado + re-submit).
 */
export default function WhatsappTemplatesPage() {
  const { data, isLoading, isError, refetch } = useTemplatesList();
  const createTemplate = useCreateTemplate();
  const submitTemplate = useSubmitTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [modal, setModal] = useState<OpenModal>(null);
  const [target, setTarget] = useState<TemplateDetailDto | null>(null);

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
    createTemplate.reset();
    submitTemplate.reset();
    deleteTemplate.reset();
  }

  function openCreate() {
    createTemplate.reset();
    setTarget(null);
    setModal('create');
  }

  function openClone(t: TemplateDetailDto) {
    createTemplate.reset();
    setTarget(t);
    setModal('clone');
  }

  function openSubmit(t: TemplateDetailDto) {
    submitTemplate.reset();
    setTarget(t);
    setModal('submit');
  }

  function openDelete(t: TemplateDetailDto) {
    deleteTemplate.reset();
    setTarget(t);
    setModal('delete');
  }

  function handleCreate(input: CreateTemplateInput) {
    createTemplate.create(input, {
      onSuccess: () => {
        showToast(modal === 'clone' ? 'Template clonado. Envialo a aprobación cuando quieras.' : 'Template creado.');
        closeModal();
      },
    });
  }

  function handleSubmitForApproval(input: SubmitTemplateInput) {
    if (!target) return;
    submitTemplate.submit(
      { sid: target.contentSid, input },
      {
        onSuccess: () => {
          showToast('Template enviado a aprobación. Quedó en estado Pendiente.');
          closeModal();
        },
      },
    );
  }

  function handleDelete() {
    if (!target) return;
    deleteTemplate.remove(target.contentSid, {
      onSuccess: () => {
        showToast('Template borrado (también de WhatsApp/Meta).');
        closeModal();
      },
    });
  }

  const templates = data ?? [];
  const rows: TemplateRow[] = templates.map((t) => ({ ...t, id: t.contentSid }));
  const showEmpty = !isLoading && !isError && templates.length === 0;

  const columns = [
    { label: 'Nombre', key: 'friendlyName' },
    { label: 'Idioma', key: 'language' },
    {
      label: 'Categoría',
      key: 'category',
      render: (row: TemplateRow) => row.category ?? '—',
    },
    {
      label: 'Estado (Meta)',
      key: 'approvalStatus',
      render: (row: TemplateRow) => <TemplateApprovalBadge status={row.approvalStatus} />,
    },
    {
      label: 'Acciones',
      key: 'actions',
      render: (row: TemplateRow) => (
        <Can permission="messaging.bulk">
          <KebabMenu items={buildRowActions(row)} />
        </Can>
      ),
    },
  ];

  function buildRowActions(row: TemplateRow) {
    const items: { label: string; onClick: () => void }[] = [];
    if (row.approvalStatus === 'unsubmitted') {
      items.push({ label: 'Enviar a aprobación', onClick: () => openSubmit(row) });
    }
    items.push({ label: 'Clonar', onClick: () => openClone(row) });
    items.push({ label: 'Borrar', onClick: () => openDelete(row) });
    return items;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>WhatsApp /</span>
          <h1 className={styles.title}>Templates</h1>
        </div>
        <Can permission="messaging.bulk">
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            Crear template
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
          <p className={styles.errorText}>No se pudieron cargar los templates. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Todavía no hay templates.</p>
          <p className={styles.emptyText}>
            Creá tu primer template de WhatsApp para poder usarlo en campañas.
          </p>
          <Can permission="messaging.bulk">
            <button type="button" className={styles.primaryBtn} onClick={openCreate}>
              Crear template
            </button>
          </Can>
        </div>
      ) : (
        <DataTable<TemplateRow>
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyMessage="Todavía no hay templates."
        />
      )}

      <TemplateFormModal
        open={modal === 'create' || modal === 'clone'}
        mode={modal === 'clone' ? 'clone' : 'create'}
        initial={
          modal === 'clone' && target
            ? {
                friendlyName: `Copia de ${target.friendlyName}`,
                language: target.language,
                category: target.category,
                body: target.body,
              }
            : undefined
        }
        busy={createTemplate.isPending}
        serverError={createTemplate.serverError}
        onSubmit={handleCreate}
        onCancel={closeModal}
      />

      <SubmitTemplateModal
        open={modal === 'submit'}
        template={target}
        busy={submitTemplate.isPending}
        serverError={submitTemplate.serverError}
        onConfirm={handleSubmitForApproval}
        onCancel={closeModal}
      />

      <DeleteTemplateModal
        open={modal === 'delete'}
        template={target}
        busy={deleteTemplate.isPending}
        inUseError={deleteTemplate.inUseError}
        serverError={deleteTemplate.serverError}
        onConfirm={handleDelete}
        onCancel={closeModal}
      />
    </div>
  );
}
