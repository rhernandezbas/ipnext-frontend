import styles from './ConversationAssignmentFilter.module.css';
import type { ConversationAssignment } from '@/types/whatsapp';

interface ConversationAssignmentFilterProps {
  value: ConversationAssignment;
  onChange: (next: ConversationAssignment) => void;
}

const OPTIONS: Array<{ value: ConversationAssignment; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Mías' },
  { value: 'unassigned', label: 'Sin asignar' },
];

/**
 * ConversationAssignmentFilter — segmented radiogroup Todas/Mías/Sin asignar
 * (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN). Filtra la lista
 * SERVER-SIDE (el valor viaja como `assignment` en `WhatsappPaginatedQuery`,
 * `WhatsappInboxPage` lo pasa a `useWhatsappConversations`) — NO es un filtro
 * client-side como la búsqueda de `ConversationList`.
 *
 * MISMO patrón que `ComposeModeToggle` (misma carpeta, radiogroup Reply/Nota):
 * radios NATIVOS, NO `role="tab"` — lo que cambia es el FILTRO de una misma
 * lista, no un panel de contenido distinto. Beneficio gratis: navegación por
 * flechas ←/→ nativa del browser, sin JS de teclado custom. Generaliza el
 * indicador de pill (translateX) de 2 a 3 segmentos vía `data-assignment` +
 * el ancho/offset en CSS — misma técnica, un selector más.
 *
 * 100% controlado (`value`+`onChange`), sin estado propio.
 */
export function ConversationAssignmentFilter({ value, onChange }: ConversationAssignmentFilterProps) {
  return (
    <fieldset className={styles.fieldset} role="radiogroup" aria-label="Filtrar conversaciones por asignación">
      <div className={styles.toggle}>
        <span className={styles.pill} data-testid="assignment-filter-pill" data-assignment={value} aria-hidden="true" />

        {OPTIONS.map((opt) => (
          <label key={opt.value} className={styles.segment}>
            <input
              type="radio"
              name="conversation-assignment-filter"
              value={opt.value}
              className={styles.radioInput}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className={styles.segmentLabel}>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
