import { useEffect, useRef } from 'react';
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
 * Con UN SOLO punto no hay tramo que medir: el BE manda `travelledMetersLowerBound
 * = 0` y `medianSamplingMinutes = null`. Imprimir "Mínimo estimado 0 m" ahí se lee
 * como "no se movió en todo el día", y un técnico que abrió la app tres minutos
 * produce exactamente ese caso. Va "—" y la razón.
 *
 * ── Por qué el selector de día tiene tope ─────────────────────────────────────
 * `technicians.location_read` (despacho) alcanza para hoy y ayer. Cualquier día
 * anterior exige `technicians.location_audit`. Sin ese corte, quien despacha
 * podía reconstruir los horarios de entrada y salida de cada empleado durante un
 * año iterando el roster completo que devuelve `/live`.
 *
 * ── Las CINCO ramas ───────────────────────────────────────────────────────────
 * `min`/`max` en el `<input type="date">` sólo limitan el calendario del
 * navegador: tipear, pegar o LIMPIAR la fecha dispara el `onChange` igual. Ahí
 * el query queda con `enabled:false` y TanStack v5 devuelve `isLoading:false,
 * isError:false, data:undefined` — ninguna de las 4 ramas clásicas matchea. Sin
 * la 5ª rama el panel quedaba EN BLANCO bajo el título con la fecha elegida, y
 * un supervisor lee ese blanco como "no trabajó". Nunca un hueco.
 *
 * Esa 5ª rama tiene MOTIVOS (`unavailableNote`, más abajo): el texto que sale
 * tiene que corresponderse con lo que efectivamente pasó. Ver el docblock ahí.
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
  /** ¿El día elegido cae en el tramo que exige `technicians.location_audit`? */
  requiresAudit: boolean;
  journey?: TeamDailyJourney;
  isLoading: boolean;
  isError: boolean;
  /** El error es un 403: límite de permiso, no falla técnica. Sin reintento. */
  isForbidden: boolean;
  /** El query está PAUSADO por falta de conexión (`fetchStatus: 'paused'`). */
  isPaused: boolean;
  onRetry: () => void;
  onClose: () => void;
}

const EMPTY = '—';

/**
 * Por qué la 5ª rama tiene MOTIVOS y no un texto único.
 *
 * `isLoading:false + isError:false + data:undefined` llega por CINCO caminos
 * distintos, y cada uno tiene que decir SU verdad. Prestarle la frase a otro es
 * tan grave como dejar el hueco en blanco:
 *
 *  · `no-day`         el operador limpió el `<input type="date">` (Chrome y
 *                     Firefox tienen ese botón). Como `journeyRequiresAudit` es
 *                     fail-closed, un día vacío "requiere auditoría" y el panel
 *                     salía con «El  queda fuera de tu alcance…»: frase rota Y
 *                     falsa — nadie pidió un día histórico. AFIRMAR UN LÍMITE DE
 *                     PERMISO QUE NO SE DISPARÓ es inventar una restricción.
 *  · `future`         día posterior al tope. El BE responde 400 y el FE ni sale
 *                     a pedirlo; sin esta rama caía en "no se pudo cargar" con
 *                     un Reintentar que nunca podía funcionar.
 *  · `requires-audit` el corte real de permiso. Gana sobre `offline`: sin el
 *                     permiso no se pidió, ni se va a pedir cuando vuelva la red.
 *  · `offline`        query pausado por falta de conexión.
 *  · `idle`           todavía no se consultó.
 */
type UnavailableReason = 'no-day' | 'future' | 'requires-audit' | 'offline' | 'idle';

const NOT_A_JUDGEMENT = 'esto no dice nada sobre si la cuadrilla trabajó';

function unavailableNote(args: {
  day: string;
  maxDay: string;
  requiresAudit: boolean;
  canAudit: boolean;
  isPaused: boolean;
}): { reason: UnavailableReason; text: string } {
  const { day, maxDay, requiresAudit, canAudit, isPaused } = args;

  if (day === '') {
    return {
      reason: 'no-day',
      text: `Elegí un día para ver la jornada: el selector quedó vacío — ${NOT_A_JUDGEMENT}.`,
    };
  }

  // `max` sólo limita el calendario del navegador: tipear o pegar una fecha
  // posterior dispara el `onChange` igual. Comparación de strings "yyyy-MM-dd",
  // que ordena igual que las fechas.
  if (maxDay !== '' && day > maxDay) {
    return {
      reason: 'future',
      text: `El ${day} todavía no ocurrió: no hay jornada que consultar. Elegí un día hasta el ${maxDay}.`,
    };
  }

  if (requiresAudit && !canAudit) {
    return {
      reason: 'requires-audit',
      text: `El ${day} queda fuera de tu alcance: la jornada de días anteriores a ayer requiere el permiso de auditoría (technicians.location_audit). Elegí un día dentro de tu alcance o pedí el permiso — ${NOT_A_JUDGEMENT}.`,
    };
  }

  if (isPaused) {
    return {
      reason: 'offline',
      text: `Sin conexión: la jornada del ${day} no se pudo pedir todavía. Se carga sola cuando vuelva la conexión — ${NOT_A_JUDGEMENT}.`,
    };
  }

  return {
    reason: 'idle',
    text: `Todavía no se consultó la jornada del ${day}. Elegí un día para verla — ${NOT_A_JUDGEMENT}.`,
  };
}

/**
 * Distribución horaria: barras + el número visible, nunca sólo la altura.
 *
 * El rango `min..max` se rellena con CEROS. Iterar sólo las horas presentes
 * dibujaba puntos en 06-08 y 18-19 como cinco barras contiguas —se lee como una
 * jornada continua— y hacía desaparecer las 9 horas sin cobertura, que son
 * justamente el dato que permite juzgar la solidez de lo que se está mirando.
 */
function HourDistribution({ pointsByHour }: { pointsByHour: Record<string, number> }) {
  const present = Object.keys(pointsByHour)
    .filter((h) => /^\d{1,2}$/.test(h))
    .map(Number)
    .sort((a, b) => a - b);

  if (present.length === 0) return null;

  const hours: string[] = [];
  for (let h = present[0]; h <= present[present.length - 1]; h += 1) {
    hours.push(String(h).padStart(2, '0'));
  }

  const max = Math.max(...hours.map((h) => pointsByHour[h] ?? 0), 1);
  const gaps = hours.filter((h) => (pointsByHour[h] ?? 0) === 0).length;

  return (
    <>
      <ul className={styles.hours} data-testid="journey-hours">
        {hours.map((hour) => {
          const count = pointsByHour[hour] ?? 0;
          return (
            <li
              key={hour}
              className={styles.hourItem}
              data-hour={hour}
              data-empty={count === 0 ? 'true' : undefined}
            >
              <span className={styles.hourCount}>{count}</span>
              <span className={styles.hourTrack}>
                <span
                  className={styles.hourBar}
                  /* Altura data-driven: es un valor calculado, no un token. Una
                     hora en cero NO dibuja barra — el piso de 6% la haría ver
                     como cobertura mínima donde no hubo ninguna. */
                  style={{ height: count === 0 ? '0%' : `${Math.max(6, (count / max) * 100)}%` }}
                />
              </span>
              <span className={styles.hourLabel}>{hour}</span>
            </li>
          );
        })}
      </ul>

      {gaps > 0 && (
        <p className={styles.hourGaps} data-testid="journey-hour-gaps">
          {gaps} h del rango sin ningún punto. La app pudo estar cerrada, el teléfono sin señal o
          la cuadrilla en un punto sin cobertura: el hueco no dice qué pasó, sólo que no hay dato.
        </p>
      )}
    </>
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
  requiresAudit,
  journey,
  isLoading,
  isError,
  isForbidden,
  isPaused,
  onRetry,
  onClose,
}: JourneyPanelProps) {
  const hasPoints = journey != null && journey.pointCount > 0;
  /** Sin un segundo punto no hay tramo: el "0 m" del BE no es un recorrido medido. */
  const canEstimateTravel = journey != null && journey.medianSamplingMinutes != null;

  const unavailable = unavailableNote({ day, maxDay, requiresAudit, canAudit, isPaused });

  const headingRef = useRef<HTMLHeadingElement>(null);

  // El panel aparece por una acción del operador ("Ver jornada"): el foco lo
  // sigue, así el lector de pantalla anuncia de quién es la jornada y el teclado
  // no queda atrás en la lista.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      className={styles.panel}
      aria-labelledby="journey-heading"
      data-testid="journey-panel"
    >
      <header className={styles.head}>
        <div>
          <h2 id="journey-heading" className={styles.title} ref={headingRef} tabIndex={-1}>
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

      {/* 403: el servidor no falló, dijo que no. Reintentar sólo repite el 403. */}
      {!isLoading && isError && isForbidden && (
        <p className={styles.blocked} role="status" data-testid="journey-forbidden">
          El {day} queda fuera de tu alcance: consultar la jornada de días anteriores a ayer
          requiere el permiso de auditoría (<code>technicians.location_audit</code>). No es una
          falla del sistema y reintentar no cambia el resultado — elegí un día dentro de tu
          alcance o pedí el permiso.
        </p>
      )}

      {!isLoading && isError && !isForbidden && (
        <div className={styles.error} role="alert" data-testid="journey-error">
          <p className={styles.errorText}>No se pudo cargar la jornada de esta cuadrilla.</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      )}

      {/* 5ª rama: la consulta ni siquiera salió (query deshabilitado o pausado).
          NUNCA un hueco, y nunca un motivo prestado: ver `unavailableNote`. */}
      {!isLoading && !isError && journey == null && (
        <p
          className={styles.blocked}
          role="status"
          data-testid="journey-unavailable"
          data-reason={unavailable.reason}
        >
          {unavailable.text}
        </p>
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
                {canEstimateTravel ? (
                  <>
                    <span className={styles.estimateTag}>Mínimo estimado</span>{' '}
                    {formatMeters(journey.travelledMetersLowerBound)}
                  </>
                ) : (
                  EMPTY
                )}
              </dd>
            </div>
          </dl>

          <p className={styles.samplingNote}>
            {canEstimateTravel ? (
              <>
                <span data-testid="journey-sampling">
                  Intervalo de muestreo (mediana): {formatMinutes(journey.medianSamplingMinutes)}
                </span>
                <span className={styles.samplingWhy}>
                  {' '}
                  — el recorrido suma tramos rectos entre puntos tomados con ese intervalo, así
                  que queda por debajo del recorrido real. No es un valor exacto.
                </span>
              </>
            ) : (
              <>
                <span data-testid="journey-sampling">
                  Intervalo de muestreo (mediana): {EMPTY}
                </span>
                <span className={styles.samplingWhy}>
                  {' '}
                  — hace falta más de un punto para estimar recorrido: con uno solo no hay tramo
                  que medir. Eso NO significa que la cuadrilla no se haya movido.
                </span>
              </>
            )}
          </p>

          <h3 className={styles.hoursTitle}>Distribución horaria (hora argentina)</h3>
          <HourDistribution pointsByHour={journey.pointsByHour} />
        </>
      )}
    </section>
  );
}
