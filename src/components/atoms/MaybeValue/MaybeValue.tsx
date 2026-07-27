import styles from './MaybeValue.module.css';

interface MaybeValueProps {
  /** El dato real — `null` significa "no sé", NUNCA "cero" (ver design.md Decision 0c/1b/4b). */
  value: number | null;
  format: (value: number) => string;
  /** Nombre humano del dato, para el `aria-label` (ej. "churn de ingresos"). */
  label: string;
  /**
   * Por qué es `null` en este caso puntual — se muestra en el `title` (tooltip
   * nativo) y en el `aria-label`, nunca dependiendo sólo de color/símbolo.
   */
  unknownReason?: string;
}

const DEFAULT_UNKNOWN_REASON = 'dato no disponible';

/**
 * Render honesto de un `number | null`: un `null` real SIEMPRE se ve como
 * "—" con explicación, JAMÁS como "0" — ese es precisamente el bug que este
 * change (finance-growth-dashboard) existe para no cometer (ver el brief de
 * Fase 5: "un cero que en realidad es 'falta cargar datos' es el bug que
 * este change entero existe para no cometer").
 */
export function MaybeValue({ value, format, label, unknownReason }: MaybeValueProps) {
  if (value === null) {
    const reason = unknownReason ?? DEFAULT_UNKNOWN_REASON;
    return (
      <span
        className={styles.unknown}
        title={`${label}: dato no disponible (${reason})`}
        aria-label={`${label}: dato no disponible (${reason})`}
      >
        —
      </span>
    );
  }
  return <span>{format(value)}</span>;
}
