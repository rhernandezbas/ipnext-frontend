import { useState } from 'react';
import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRemoveInstalledItem,
} from '@/hooks/useServiceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { formatDateShort } from '@/utils/formatDate';
import type {
  InstalledItemType,
  ServiceInstalledItem,
  AddInstalledItemInput,
  UpdateInstalledItemInput,
} from '@/types/serviceInventory';
import { InstalledItemFormModal } from './contracts/InstalledItemFormModal';
import styles from './ServiceInventorySection.module.css';

const FALLBACK_TYPES: InstalledItemType[] = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'];

/** Best-effort human message out of an unknown mutation error. */
function errorMessage(err: unknown, fallback: string): string {
  const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (apiMsg) return apiMsg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface Props {
  serviceId: string;
  /** Defer the query until the section is actually shown. */
  enabled?: boolean;
}

/** Which modal flow is open: none, create, or editing a specific item. */
type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; item: ServiceInstalledItem };

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  OCR: 'Foto (OCR)',
  ICLASS: 'IClass',
};

/**
 * "Equipos instalados" on a contract (Service). Lists the installed devices
 * (one row per physical equipment) and lets an operator manually attach a
 * serial — the "agregar SN al contrato" flow (#82). Adding and editing happen
 * in a dedicated modal (InstalledItemFormModal) instead of inline forms, so the
 * section reads as a clean table with a single primary action. Devices
 * auto-suggested from a closed OS are confirmed from the task; this is the
 * manual / review surface.
 */
export function ServiceInventorySection({ serviceId, enabled = true }: Props) {
  const { data, isLoading } = useServiceInstalledItems(serviceId, enabled);
  const addItem = useAddInstalledItem(serviceId);
  const updateItem = useUpdateInstalledItem(serviceId);
  const removeItem = useRemoveInstalledItem(serviceId);
  const { data: deviceTypes = [], isLoading: typesLoading } = useDeviceTypes();
  const confirm = useConfirm();

  // Active types ordered by sortOrder; fall back to hardcoded list while loading
  const activeTypes: InstalledItemType[] = !typesLoading && deviceTypes.length > 0
    ? deviceTypes.filter(dt => dt.active).sort((a, b) => a.sortOrder - b.sortOrder).map(dt => dt.name)
    : FALLBACK_TYPES;

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  function closeModal() {
    setModal({ mode: 'closed' });
    setFormError(null);
  }

  function handleCreate(input: AddInstalledItemInput) {
    setFormError(null);
    addItem.mutate(input, {
      onSuccess: closeModal,
      onError: (err) => setFormError(errorMessage(err, 'No se pudo agregar el equipo.')),
    });
  }

  function handleUpdate(item: ServiceInstalledItem, patch: UpdateInstalledItemInput) {
    setFormError(null);
    updateItem.mutate(
      { itemId: item.id, patch },
      {
        onSuccess: closeModal,
        onError: (err) => setFormError(errorMessage(err, 'No se pudieron guardar los cambios.')),
      },
    );
  }

  async function handleRemove(item: ServiceInstalledItem) {
    const label = `${item.type}${item.serialNumber ? ` (${item.serialNumber})` : ''}`;
    if (!(await confirm({ message: `¿Quitar el equipo "${label}"?`, tone: 'danger', confirmLabel: 'Quitar' }))) return;
    await removeItem.mutateAsync(item.id);
  }

  const items = data ?? [];

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div>
          <strong className={styles.heading}>Equipos instalados</strong>
          {!isLoading && items.length > 0 && (
            <span className={styles.count}>{items.length}</span>
          )}
        </div>
        <Can permission="inventory.write">
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => { setFormError(null); setModal({ mode: 'create' }); }}
          >
            <span aria-hidden="true" className={styles.addIcon}>+</span>
            Agregar SN
          </button>
        </Can>
      </div>

      {isLoading ? (
        <p className={styles.muted}>Cargando equipos…</p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Sin equipos en este contrato</p>
          <Can permission="inventory.write">
            <button
              type="button"
              className={styles.emptyAction}
              onClick={() => { setFormError(null); setModal({ mode: 'create' }); }}
            >
              Agregar el primer equipo
            </button>
          </Can>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Tipo</th><th>SN</th><th>MAC</th><th>Modelo</th><th>Origen</th><th>Estado</th><th>Aprobado por</th><th aria-label="Acciones"></th></tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td><span className={styles.typeTag}>{it.type}</span></td>
                  <td className={styles.mono}>{it.serialNumber ?? '—'}</td>
                  <td className={styles.mono}>{it.mac ?? '—'}</td>
                  <td>{it.model ?? '—'}</td>
                  <td>{SOURCE_LABELS[it.source] ?? it.source}</td>
                  <td>{it.status}</td>
                  <td>{it.addedByUserName ? `${it.addedByUserName}${it.confirmedAt ? ` · ${formatDateShort(it.confirmedAt)}` : ''}` : '—'}</td>
                  <td className={styles.actions}>
                    <Can permission="inventory.write">
                      <button type="button" onClick={() => { setFormError(null); setModal({ mode: 'edit', item: it }); }} className={styles.linkBtn}>Editar</button>
                      <button type="button" onClick={() => handleRemove(it)} disabled={removeItem.isPending} className={styles.linkDanger}>Quitar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.mode !== 'closed' && (
        <InstalledItemFormModal
          types={activeTypes}
          item={modal.mode === 'edit' ? modal.item : null}
          saving={modal.mode === 'edit' ? updateItem.isPending : addItem.isPending}
          error={formError}
          onCreate={handleCreate}
          onUpdate={(patch) => { if (modal.mode === 'edit') handleUpdate(modal.item, patch); }}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
