import {
  useTaskInventorySuggestions,
  useConfirmSuggestion,
  useDiscardSuggestion,
} from '@/hooks/useServiceInventory';
import { Can } from '@/components/auth/Can';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';

interface Props {
  taskId: string;
}

function label(s: TaskInventorySuggestion): string {
  if (s.kind === 'DEVICE') {
    const id = s.serialNumber ?? s.mac ?? 's/n';
    return `${s.deviceType ?? 'EQUIPO'} — SN ${id}${s.mac ? ` · MAC ${s.mac}` : ''}`;
  }
  return `${s.materialDesc ?? 'Material'}${s.quantity ? ` × ${s.quantity}${s.unit ? ' ' + s.unit : ''}` : ''}`;
}

/**
 * Sugerencias de inventario de la tarea: lo scrapeado/OCR de la OS cerrada en
 * IClass, como checkboxes. El operador confirma (→ pasa al inventario del
 * contrato) o descarta. Se generan automáticamente cuando el closure-loop
 * procesa una OS cerrada asociada a la tarea.
 */
export function TaskInventorySuggestions({ taskId }: Props) {
  const { data, isLoading } = useTaskInventorySuggestions(taskId);
  const confirm = useConfirmSuggestion(taskId);
  const discard = useDiscardSuggestion(taskId);

  const all = data ?? [];
  const pending = all.filter(s => s.status === 'pending');
  const resolved = all.filter(s => s.status !== 'pending');

  if (isLoading) return <p style={{ color: '#6b7280' }}>Cargando sugerencias…</p>;

  if (all.length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
        Sin sugerencias de inventario. Se generan automáticamente cuando IClass cierra una OS asociada a
        esta tarea (requiere el closure-loop activo).
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {pending.map(s => (
        <div
          key={s.id}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: 6 }}
        >
          <span style={{ flex: 1 }}>
            <strong>{label(s)}</strong>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              {s.source === 'OCR' ? 'OCR' : 'IClass'}
            </span>
            {s.photoUrl && (
              <a href={s.photoUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                ver foto
              </a>
            )}
          </span>
          <Can permission="scheduling.write">
            <button type="button" onClick={() => confirm.mutate(s.id)} disabled={confirm.isPending}>
              Confirmar
            </button>
            <button type="button" onClick={() => discard.mutate(s.id)} disabled={discard.isPending} style={{ marginLeft: '0.25rem' }}>
              Descartar
            </button>
          </Can>
        </div>
      ))}

      {resolved.length > 0 && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
          {resolved.map(s => (
            <div key={s.id}>
              {s.status === 'confirmed' ? '✓' : '✕'} {label(s)} — {s.status === 'confirmed' ? 'confirmado' : 'descartado'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
