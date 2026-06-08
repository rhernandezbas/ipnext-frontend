import { useState } from 'react';
import {
  useTaskInventorySuggestions,
  useConfirmSuggestion,
  useDiscardSuggestion,
  useCorrectSuggestionType,
  useReplaceSuggestion,
} from '@/hooks/useServiceInventory';
import { useCan, useMyPermissions } from '@/hooks/useMyPermissions';
import type { InstalledItemType } from '@/types/serviceInventory';
import { SuggestionCard } from './SuggestionCard';
import { ManualSuggestionForm } from './ManualSuggestionForm';
import styles from './TaskInventorySuggestions.module.css';

interface Props {
  taskId: string;
  /** Contract id — threaded from TaskTabs for precise cache invalidation (AD-12bis). */
  contractId?: string;
}

/**
 * Sugerencias de inventario de la tarea: lo scrapeado/OCR de la OS cerrada en
 * IClass. El operador revisa la foto, ajusta el tipo (con la sugerencia de qwen
 * a la vista) y confirma (→ inventario del contrato) o descarta. Se generan solas
 * cuando el closure-loop procesa una OS cerrada asociada a la tarea.
 *
 * Also allows creating MANUAL suggestions via the inline "Agregar ítem" form
 * (gated by inventory.write), visible in BOTH empty and non-empty states.
 */
export function TaskInventorySuggestions({ taskId, contractId }: Props) {
  const { data, isLoading } = useTaskInventorySuggestions(taskId);
  const confirm = useConfirmSuggestion(taskId, contractId);
  const replace = useReplaceSuggestion(taskId, contractId);
  const discard = useDiscardSuggestion(taskId);
  const correctType = useCorrectSuggestionType(taskId, contractId);
  const { can } = useMyPermissions();
  const canWrite = can('scheduling.write');
  const canInventoryWrite = useCan('inventory.write');

  const [showForm, setShowForm] = useState(false);

  const all = data ?? [];
  const pending = all.filter(s => s.status === 'pending');
  const resolved = all.filter(s => s.status !== 'pending');

  if (isLoading) return <p className={styles.muted}>Cargando sugerencias…</p>;

  return (
    <div className={styles.list}>
      {/* Header row: "Agregar ítem" button always rendered (gated by inventory.write) */}
      {canInventoryWrite && (
        <div className={styles.header}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowForm(prev => !prev)}
          >
            Agregar ítem
          </button>
        </div>
      )}

      {/* Inline form — collapses when closed */}
      {showForm && canInventoryWrite && (
        <ManualSuggestionForm
          taskId={taskId}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Empty state — rendered as a <p> below the header, not as an early return */}
      {all.length === 0 ? (
        <p className={styles.muted}>
          Sin sugerencias de inventario. Se generan automáticamente cuando IClass cierra una OS asociada a
          esta tarea (requiere el closure-loop activo).
        </p>
      ) : (
        <>
          {pending.map(s => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isPending={confirm.isPending || discard.isPending || replace.isPending}
              canWrite={canWrite}
              onConfirm={(id, type: InstalledItemType) => confirm.mutate({ suggestionId: id, type, resolution: 'add' })}
              onLinkExisting={id => confirm.mutate({ suggestionId: id, resolution: 'link_existing' })}
              onReplace={(id, type: InstalledItemType) => replace.mutate({ suggestionId: id, type })}
              onDiscard={id => discard.mutate(id)}
            />
          ))}

          {resolved.length > 0 && (
            <div className={styles.resolved}>
              {resolved.map(s => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  isPending={false}
                  canWrite={canWrite}
                  onConfirm={() => {}}
                  onDiscard={() => {}}
                  onCorrectType={(id, type) => correctType.mutate({ suggestionId: id, type })}
                  isCorrecting={correctType.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
