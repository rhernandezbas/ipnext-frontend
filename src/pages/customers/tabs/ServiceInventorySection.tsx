import { useState } from 'react';
import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRetireInstalledItem,
  useInspectPppoeDevices,
} from '@/hooks/useServiceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { Can } from '@/components/auth/Can';
import { useConfirm } from '@/context/ConfirmContext';
import { formatDateShort } from '@/utils/formatDate';
import type {
  InstalledItemType,
  ServiceInstalledItem,
  AddInstalledItemInput,
  AddInstalledItemResult,
  UpdateInstalledItemInput,
  InspectPppoeDevicesResult,
  RetireInstalledItemInput,
} from '@/types/serviceInventory';
import { InstalledItemFormModal } from './contracts/InstalledItemFormModal';
import { AddByPppoeReviewModal } from './contracts/AddByPppoeReviewModal';
import { RetireInstalledItemModal } from './contracts/RetireInstalledItemModal';
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

/** Which modal flow is open: none, create, editing a specific item, retiring one, or pppoe review. */
type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; item: ServiceInstalledItem }
  | { mode: 'retire'; item: ServiceInstalledItem }
  | { mode: 'pppoe-review'; result: InspectPppoeDevicesResult };

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
  const retireItem = useRetireInstalledItem(serviceId);
  const { data: deviceTypes = [], isLoading: typesLoading } = useDeviceTypes();
  const confirm = useConfirm();
  const { inspect, isPending: inspecting } = useInspectPppoeDevices();

  // Active types ordered by sortOrder; fall back to hardcoded list while loading
  const activeTypes: InstalledItemType[] = !typesLoading && deviceTypes.length > 0
    ? deviceTypes.filter(dt => dt.active).sort((a, b) => a.sortOrder - b.sortOrder).map(dt => dt.name)
    : FALLBACK_TYPES;

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  function closeModal() {
    setModal({ mode: 'closed' });
    setFormError(null);
  }

  async function handleInspectPppoe() {
    setInspectError(null);
    try {
      const result = await inspect(serviceId);
      // Si no hay nada para agregar (antena sin MAC y sin router) = no se pudo conectar /
      // el cliente o la antena está offline. Mostramos un modal claro en vez del de revisión.
      if (!result.antenna.mac && !result.router) {
        await confirm({
          title: 'Sin conexión',
          message:
            (result.warnings[0] ?? 'No se pudo conectar a la antena del cliente.') +
            ' Probá de nuevo cuando el cliente esté conectado.',
          confirmLabel: 'Entendido',
        });
        return;
      }
      setModal({ mode: 'pppoe-review', result });
    } catch {
      setInspectError('No se pudo inspeccionar. Revisá la conexión o intentá de nuevo.');
    }
  }

  function handlePppoeCreate(input: AddInstalledItemInput): Promise<AddInstalledItemResult> {
    // Surface the dedup outcome ('created' | 'enriched') and propagate
    // InventoryConflictError (409) so the modal can drive the decision flow.
    // The mutation invalidates the inventory query on every success.
    return addItem.mutateAsync(input);
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

  /**
   * Submit handler the retire modal calls. Resolves on success, re-throws on
   * error so the modal can show the right message (e.g. the 409
   * ASSET_NOT_INSTALLED → AssetNotInstalledError). The mutation invalidates the
   * inventory query on success.
   */
  function handleRetire(item: ServiceInstalledItem, input: RetireInstalledItemInput): Promise<void> {
    return retireItem.mutateAsync({ itemId: item.id, input }).then(() => undefined);
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
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleInspectPppoe}
              disabled={inspecting}
              title="Inspeccioná los equipos conectados via PPPoE en vivo"
            >
              {inspecting ? (
                <>
                  {/* Spinner SVG */}
                  <svg className={styles.spinner} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 14" strokeLinecap="round"/>
                  </svg>
                  Inspeccionando…
                </>
              ) : (
                <>
                  {/* Wireless/PPPoE SVG icon */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor"/>
                    <path d="M4.5 9c.7-.7 1.55-1.1 2.5-1.1s1.8.4 2.5 1.1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    <path d="M2.5 6.8C3.8 5.4 5.3 4.6 7 4.6s3.2.8 4.5 2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                    <path d="M0.5 4.5C2.3 2.6 4.5 1.5 7 1.5s4.7 1.1 6.5 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                  </svg>
                  Agregar por PPPoE
                </>
              )}
            </button>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => { setFormError(null); setInspectError(null); setModal({ mode: 'create' }); }}
            >
              <span aria-hidden="true" className={styles.addIcon}>+</span>
              Agregar SN
            </button>
          </div>
        </Can>
      </div>
      {inspectError && (
        <p className={styles.inspectError} role="alert">{inspectError}</p>
      )}

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
                      <button type="button" onClick={() => { setFormError(null); setModal({ mode: 'retire', item: it }); }} disabled={retireItem.isPending} className={styles.linkDanger}>Quitar</button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal.mode === 'create' || modal.mode === 'edit') && (
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

      {modal.mode === 'retire' && (
        <RetireInstalledItemModal
          item={modal.item}
          saving={retireItem.isPending}
          error={null}
          onRetire={(input) => handleRetire(modal.item, input)}
          onClose={closeModal}
        />
      )}

      {modal.mode === 'pppoe-review' && (
        <AddByPppoeReviewModal
          contractId={serviceId}
          result={modal.result}
          onClose={closeModal}
          onCreate={handlePppoeCreate}
        />
      )}
    </div>
  );
}
