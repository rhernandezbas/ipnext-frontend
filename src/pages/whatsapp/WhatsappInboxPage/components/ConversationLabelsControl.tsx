import { useEffect, useId, useRef, useState } from 'react';
import type { WhatsappLabel } from '@/types/whatsapp';
import styles from './ConversationLabelsControl.module.css';

interface ConversationLabelsControlProps {
  /** Catálogo completo de etiquetas (`useMessagingLabels`). */
  labels: WhatsappLabel[];
  /** Ids de las etiquetas ACTUALMENTE asignadas a la conversación. */
  selectedIds: string[];
  /**
   * Recibe el set COMPLETO de objetos `WhatsappLabel` elegidos (no solo el
   * delta ni solo los ids) — el caller (`WhatsappInboxPage`) lo reenvía a
   * `useSetConversationLabels(id).setLabels`, que necesita los objetos
   * completos para pintar el optimista con name/color correctos y deriva los
   * ids para el wire (`PATCH .../labels` reemplaza el set).
   */
  onChange?: (next: WhatsappLabel[]) => void;
  isPending?: boolean;
}

/**
 * ConversationLabelsControl — control multi-select de etiquetas del header del
 * thread (Ola 5 — labels). Vive junto a `ConversationAssignmentControls`
 * (assignee/área), bajo el MISMO gate `messaging.send` que aquél (el PATCH de
 * labels pide `send`, igual que assignee/area).
 *
 * Patrón "disclosure + checkboxes nativos" (no un `<select multiple>` ni un
 * combobox ARIA a mano): un `<button>` trigger abre un popover con un
 * `<input type="checkbox">` por etiqueta del catálogo. Los checkboxes nativos
 * traen teclado + nombre accesible gratis del browser (mismo espíritu que
 * `ConversationAssignmentControls`, que usa `<select>` nativo por consistencia
 * y a11y). Cada toggle recomputa el set completo y dispara `onChange` al
 * instante (aplicación inmediata estilo Chatwoot — sin botón "Aplicar"); el
 * PATCH reemplaza el set entero.
 *
 * Cierra al clickear afuera (mousedown en el wrapper, mismo criterio que el
 * `Select` molecule) o con Escape. NO cierra al togglear un checkbox — es
 * multi-select, el operador suele marcar/desmarcar varias seguidas.
 */
export function ConversationLabelsControl({
  labels,
  selectedIds,
  onChange,
  isPending = false,
}: ConversationLabelsControlProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const popoverId = `wa-labels-${reactId}`;

  const selectedCount = selectedIds.length;

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function toggleLabel(id: string) {
    const isSelected = selectedIds.includes(id);
    const nextIds = isSelected ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    // Reconstruye el set de objetos completos preservando el orden del catálogo
    // (estable, no el orden de clicks) — el optimista y los chips quedan
    // ordenados igual que el catálogo.
    const next = labels.filter((l) => nextIds.includes(l.id));
    onChange?.(next);
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label="Etiquetas de la conversación"
        disabled={isPending}
      >
        <span className={styles.triggerLabel}>Etiquetas</span>
        {selectedCount > 0 && (
          <span className={styles.count} aria-hidden="true">
            {selectedCount}
          </span>
        )}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div id={popoverId} className={styles.popover} role="group" aria-label="Elegí las etiquetas">
          {labels.length === 0 ? (
            <p className={styles.empty}>No hay etiquetas en el catálogo.</p>
          ) : (
            labels.map((label) => (
              <label key={label.id} className={styles.option}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selectedIds.includes(label.id)}
                  onChange={() => toggleLabel(label.id)}
                  disabled={isPending}
                />
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: label.color }}
                  aria-hidden="true"
                />
                <span className={styles.optionName}>{label.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
