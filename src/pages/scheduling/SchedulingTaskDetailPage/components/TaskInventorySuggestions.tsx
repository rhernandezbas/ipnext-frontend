import {
  useTaskInventorySuggestions,
  useConfirmSuggestion,
  useDiscardSuggestion,
} from '@/hooks/useServiceInventory';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { InstalledItemType } from '@/types/serviceInventory';
import { SuggestionCard } from './SuggestionCard';
import styles from './TaskInventorySuggestions.module.css';

interface Props {
  taskId: string;
}

/**
 * Sugerencias de inventario de la tarea: lo scrapeado/OCR de la OS cerrada en
 * IClass. El operador revisa la foto, ajusta el tipo (con la sugerencia de qwen
 * a la vista) y confirma (→ inventario del contrato) o descarta. Se generan solas
 * cuando el closure-loop procesa una OS cerrada asociada a la tarea.
 */
export function TaskInventorySuggestions({ taskId }: Props) {
  const { data, isLoading } = useTaskInventorySuggestions(taskId);
  const confirm = useConfirmSuggestion(taskId);
  const discard = useDiscardSuggestion(taskId);
  const { can } = useMyPermissions();
  const canWrite = can('scheduling.write');

  const all = data ?? [];
  const pending = all.filter(s => s.status === 'pending');
  const resolved = all.filter(s => s.status !== 'pending');

  if (isLoading) return <p className={styles.muted}>Cargando sugerencias…</p>;

  if (all.length === 0) {
    return (
      <p className={styles.muted}>
        Sin sugerencias de inventario. Se generan automáticamente cuando IClass cierra una OS asociada a
        esta tarea (requiere el closure-loop activo).
      </p>
    );
  }

  return (
    <div className={styles.list}>
      {pending.map(s => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          isPending={confirm.isPending || discard.isPending}
          canWrite={canWrite}
          onConfirm={(id, type: InstalledItemType) => confirm.mutate({ suggestionId: id, type })}
          onDiscard={id => discard.mutate(id)}
        />
      ))}

      {resolved.length > 0 && (
        <div className={styles.resolved}>
          {resolved.map(s => (
            <div key={s.id} className={s.status === 'confirmed' ? styles.confirmed : styles.discarded}>
              {s.status === 'confirmed' ? '✓' : '✕'} {s.deviceType ?? s.materialDesc ?? 'Item'}
              {s.serialNumber ? ` · SN ${s.serialNumber}` : ''} — {s.status === 'confirmed' ? 'confirmado' : 'descartado'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
