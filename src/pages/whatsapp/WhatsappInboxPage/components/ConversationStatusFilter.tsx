import styles from './ConversationStatusFilter.module.css';

export type ConversationStatusFilterValue = 'open' | 'resolved';

interface ConversationStatusFilterProps {
  value: ConversationStatusFilterValue;
  onChange: (next: ConversationStatusFilterValue) => void;
}

const OPTIONS: Array<{ value: ConversationStatusFilterValue; label: string }> = [
  { value: 'open', label: 'Abiertas' },
  { value: 'resolved', label: 'Resueltas' },
];

/**
 * ConversationStatusFilter — segmented radiogroup Abiertas/Resueltas
 * (inbox-resolve, design.md D5, TAB-1). CLON estructural de
 * `ConversationAssignmentFilter` (misma carpeta): radios NATIVOS, NO
 * `role="tab"` — lo que cambia es el FILTRO server-side de la MISMA lista
 * (bucket abierto `status!=='resolved'` / resuelto `status==='resolved'`),
 * no un panel de contenido distinto. Beneficio gratis: navegación por
 * flechas ←/→ nativa del browser. 2 segmentos (vs. 3 de assignment) — mismo
 * molde de pill que `ComposeModeToggle` (50% de ancho, translateX(100%)).
 *
 * 100% controlado (`value`+`onChange`), sin estado propio.
 */
export function ConversationStatusFilter({ value, onChange }: ConversationStatusFilterProps) {
  return (
    <fieldset className={styles.fieldset} role="radiogroup" aria-label="Filtrar conversaciones por estado">
      <div className={styles.toggle}>
        <span className={styles.pill} data-testid="status-filter-pill" data-status={value} aria-hidden="true" />

        {OPTIONS.map((opt) => (
          <label key={opt.value} className={styles.segment}>
            <input
              type="radio"
              name="conversation-status-filter"
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
