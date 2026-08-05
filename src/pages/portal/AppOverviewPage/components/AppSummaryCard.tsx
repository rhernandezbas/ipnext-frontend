import { Link } from 'react-router-dom';
import styles from './AppSummaryCard.module.css';

/**
 * Las CUATRO ramas de estado de un dato de la portada, explícitas en el tipo.
 *
 * `error` NO lleva texto de dato a propósito: la regla dura del change es que
 * una tarjeta cuyo endpoint falló muestre su acceso SIN número — jamás un
 * número inventado, jamás un "0" que el operador lea como "no hay ninguna".
 * `empty` SÍ lleva texto porque "no hay ninguna" es un dato REAL, distinto de
 * "no lo pude averiguar".
 */
export type MetricState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'empty'; text: string }
  | { kind: 'value'; text: string };

export interface CardMetric {
  /** Etiqueta corta del dato ("Publicadas", "Pedidos", …). */
  label: string;
  state: MetricState;
  /** Gancho estable para los tests (la portada se valida por dato, no por texto suelto). */
  testId: string;
}

/** Deriva el estado del dato desde una query de react-query, sin ramas sueltas. */
export function metricFromQuery<T>(
  query: { isLoading: boolean; isError: boolean; data: T | undefined },
  toText: (data: T) => string | null,
  emptyText: string,
): MetricState {
  if (query.isLoading) return { kind: 'loading' };
  // isError PRIMERO que `data == null`: un error con data stale igual tiene que
  // degradar (el número viejo puede ser de otro filtro/otra sesión).
  if (query.isError || query.data === undefined) return { kind: 'error' };
  const text = toText(query.data);
  if (text === null) return { kind: 'empty', text: emptyText };
  return { kind: 'value', text };
}

function Metric({ metric }: { metric: CardMetric }) {
  return (
    <span className={styles.metric} data-testid={metric.testId}>
      <span className={styles.metricLabel}>{metric.label}</span>
      {metric.state.kind === 'loading' && (
        <>
          <span className={styles.skeleton} aria-hidden="true" />
          <span className={styles.srOnly}>Cargando…</span>
        </>
      )}
      {metric.state.kind === 'error' && (
        <span className={styles.metricUnavailable}>Sin datos ahora</span>
      )}
      {metric.state.kind === 'empty' && <span className={styles.metricEmpty}>{metric.state.text}</span>}
      {metric.state.kind === 'value' && <strong className={styles.metricValue}>{metric.state.text}</strong>}
    </span>
  );
}

interface AppSummaryCardProps {
  title: string;
  description: string;
  to: string;
  /** Vacío = tarjeta de puro acceso (p. ej. Avisos push, que es una acción, no un número). */
  metrics?: CardMetric[];
}

/**
 * Tarjeta de la portada de "Gestión de App": un acceso a una sub-página + los
 * datos reales que la describen. TODA la tarjeta es el link (área táctil
 * grande, ≥44px garantizados por el `min-height` del CSS) — el nombre accesible
 * incluye el dato, así que un lector de pantalla anuncia "Promociones, 2
 * publicadas" sin tener que entrar.
 */
export function AppSummaryCard({ title, description, to, metrics = [] }: AppSummaryCardProps) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.cardDescription}>{description}</span>
      {metrics.length > 0 && (
        <span className={styles.metrics}>
          {metrics.map((metric) => (
            <Metric key={metric.testId} metric={metric} />
          ))}
        </span>
      )}
      <span className={styles.cardCta} aria-hidden="true">
        Abrir
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" focusable="false">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}
