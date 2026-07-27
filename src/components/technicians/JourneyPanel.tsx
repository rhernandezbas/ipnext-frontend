import type { TeamDailyJourney } from '@/types/technicianLocation';
import { Button } from '@/components/atoms/Button/Button';
import { formatTimeShort } from '@/utils/formatDate';
import { formatMeters, formatMinutes } from '@/utils/formatGeo';
import styles from './JourneyPanel.module.css';

/**
 * Jornada de una cuadrilla en un día calendario argentino.
 *
 * ── Por qué la distancia se rotula "mínimo estimado" ──────────────────────────
 * El recorrido se calcula sumando tramos RECTOS entre breadcrumbs que llegan cada
 * 5-10 minutos: eso "corta las curvas" y SUBESTIMA sistemáticamente el recorrido
 * real. Presentarlo como un valor exacto sería vender un número que no es — y
 * sobre esa cifra alguien podría evaluar el desempeño de una persona. Por eso el
 * intervalo de muestreo va siempre al lado: hace legible el margen.
 *
 * ── Por qué el selector de día tiene tope ─────────────────────────────────────
 * `technicians.location_read` (despacho) alcanza para hoy y ayer. Cualquier día
 * anterior exige `technicians.location_audit`. Sin ese corte, quien despacha
 * podía reconstruir los horarios de entrada y salida de cada empleado durante un
 * año iterando el roster completo que devuelve `/live`.
 */

interface JourneyPanelProps {
  teamName: string;
  teamLogin: string;
  day: string;
  /** Día mínimo seleccionable. `''` (sin tope) cuando el usuario puede auditar. */
  minDay: string;
  maxDay: string;
  onDayChange: (day: string) => void;
  canAudit: boolean;
  journey?: TeamDailyJourney;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClose: () => void;
}

/** Distribución horaria: barras + el número visible, nunca sólo la altura. */
function HourDistribution({ pointsByHour }: { pointsByHour: Record<string, number> }) {
  const hours = Object.keys(pointsByHour).sort();
  const max = Math.max(...hours.map((h) => pointsByHour[h]), 1);

  return (
    <ul className={styles.hours} data-testid="journey-hours">
      {hours.map((hour) => {
        const count = pointsByHour[hour];
        return (
          <li key={hour} className={styles.hourItem}>
            <span className={styles.hourCount}>{count}</span>
            <span className={styles.hourTrack}>
              <span
                className={styles.hourBar}
                /* Altura data-driven: es un valor calculado, no un token. */
                style={{ height: `${Math.max(6, (count / max) * 100)}%` }}
              />
            </span>
            <span className={styles.hourLabel}>{hour}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function JourneyPanel({
  teamName,
  teamLogin,
  day,
  minDay,
  maxDay,
  onDayChange,
  canAudit,
  journey,
  isLoading,
  isError,
  onRetry,
  onClose,
}: JourneyPanelProps) {
  const hasPoints = journey != null && journey.pointCount > 0;

  return (
    <section
      className={styles.panel}
      aria-labelledby="journey-heading"
      data-testid="journey-panel"
    >
      <header className={styles.head}>
        <div>
          <h2 id="journey-heading" className={styles.title}>
            Jornada de {teamName}
          </h2>
          <p className={styles.subtitle}>{teamLogin}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </header>

      <div className={styles.dayRow}>
        <label className={styles.dayLabel} htmlFor="journey-day">
          Día de la jornada
        </label>
        <input
          id="journey-day"
          className={styles.dayInput}
          type="date"
          value={day}
          min={minDay}
          max={maxDay}
          onChange={(e) => onDayChange(e.target.value)}
        />
      </div>

      <p className={styles.scopeNote} data-testid="journey-scope-note">
        {canAudit
          ? 'Con el permiso de auditoría podés consultar cualquier día de los últimos 12 meses.'
          : 'Tu permiso operativo cubre hoy y ayer. Los días anteriores requieren el permiso de auditoría.'}
      </p>

      {isLoading && (
        <div className={styles.skeleton} data-testid="journey-skeleton" aria-hidden="true">
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonLine} />
          <span className={styles.skeletonBars} />
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.error} role="alert">
          <p className={styles.errorText}>No se pudo cargar la jornada de esta cuadrilla.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !isError && journey != null && !hasPoints && (
        <p className={styles.empty} data-testid="journey-empty">
          Sin puntos registrados ese día. Ausencia de datos no es dato de ausencia: la app pudo
          estar cerrada o el teléfono sin señal.
        </p>
      )}

      {!isLoading && !isError && journey != null && hasPoints && (
        <>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt className={styles.statTerm}>Primer punto</dt>
              <dd className={styles.statValue} data-testid="journey-first">
                {formatTimeShort(journey.firstPointAt)}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statTerm}>Último punto</dt>
              <dd className={styles.statValue} data-testid="journey-last">
                {formatTimeShort(journey.lastPointAt)}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statTerm}>Puntos registrados</dt>
              <dd className={styles.statValue} data-testid="journey-points">
                {journey.pointCount}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statTerm}>Recorrido</dt>
              <dd className={styles.statValue} data-testid="journey-distance">
                <span className={styles.estimateTag}>Mínimo estimado</span>{' '}
                {formatMeters(journey.travelledMetersLowerBound)}
              </dd>
            </div>
          </dl>

          <p className={styles.samplingNote}>
            <span data-testid="journey-sampling">
              Intervalo de muestreo (mediana): {formatMinutes(journey.medianSamplingMinutes)}
            </span>
            <span className={styles.samplingWhy}>
              {' '}
              — el recorrido suma tramos rectos entre puntos tomados con ese intervalo, así que
              queda por debajo del recorrido real. No es un valor exacto.
            </span>
          </p>

          <h3 className={styles.hoursTitle}>Distribución horaria (hora argentina)</h3>
          <HourDistribution pointsByHour={journey.pointsByHour} />
        </>
      )}
    </section>
  );
}
