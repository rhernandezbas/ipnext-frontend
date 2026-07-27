import type { ReactNode } from 'react';
import type { PresenceVerdict, ServiceOrderPresenceReport } from '@/types/technicianLocation';
import { formatDateTimeShort, formatTimeShort, toArIsoDate } from '@/utils/formatDate';
import { formatAccuracy, formatMeters, formatMinutes } from '@/utils/formatGeo';
import styles from './VerdictCard.module.css';

/**
 * Tarjeta de veredicto de presencia + su evidencia.
 *
 * ── REGLA DE PRESENTACIÓN (innegociable) ──────────────────────────────────────
 * Este componente decide si se investiga a una PERSONA REAL. De ahí que:
 *
 *  1. Los CUATRO veredictos comparten estructura, tamaño y jerarquía tipográfica.
 *     `NO_CONCLUYENTE` y `NO_AUDITABLE` NO son una variante apagada de "no estuvo":
 *     son resultados de pleno derecho. Un card gris y chiquito para "no hay datos"
 *     hace que el lector complete el hueco con la peor hipótesis.
 *  2. El color nunca es el único indicador: cada veredicto lleva ícono de forma
 *     distinta + etiqueta de texto + una frase que dice qué significa.
 *  3. La evidencia va COMPLETA y con las mismas filas siempre, degradando a "—"
 *     cuando el dato no existe. Ocultar una fila vacía es esconder el límite del
 *     dato justo cuando el límite es la información más importante.
 *  4. Ningún texto imputa intención, dolo ni incumplimiento. La evidencia dice
 *     dónde estuvo el DISPOSITIVO; no puede establecer quién lo operaba.
 */

interface VerdictMeta {
  label: string;
  meaning: string;
  icon: ReactNode;
}

const iconProps = { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': true } as const;

const VERDICT_META: Record<PresenceVerdict, VerdictMeta> = {
  EN_SITIO: {
    label: 'En sitio',
    meaning:
      'Hubo cobertura GPS durante la ventana de trabajo y al menos un punto del rastro es compatible con el domicilio de la orden.',
    icon: (
      <svg {...iconProps}>
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M6 10.3l2.7 2.7L14.2 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  FUERA_DE_SITIO: {
    label: 'Fuera de sitio',
    meaning:
      'Hubo cobertura GPS suficiente durante la ventana y ninguno de los puntos registrados es compatible con el domicilio, ni siquiera sumando el margen de error del GPS.',
    icon: (
      <svg {...iconProps}>
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  NO_CONCLUYENTE: {
    label: 'No concluyente',
    meaning:
      'No hay datos suficientes para concluir. Esto NO significa que la cuadrilla no haya ido: la app pudo estar cerrada, el teléfono sin batería o sin señal. Ausencia de dato no es dato de ausencia.',
    icon: (
      <svg {...iconProps}>
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M7.6 7.6a2.4 2.4 0 113.2 2.26c-.5.2-.8.66-.8 1.2v.44"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="10" cy="14.2" r="1" fill="currentColor" />
      </svg>
    ),
  },
  NO_AUDITABLE: {
    label: 'No auditable',
    meaning:
      'La orden no admite auditoría de presencia: le falta domicilio geolocalizado, cuadrilla asignada o ventana de trabajo en el histórico de estados. Decirlo es parte del resultado.',
    icon: (
      <svg {...iconProps}>
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.2 5.2l9.6 9.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M10 6.2v4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
};

const EMPTY = '—';

/**
 * Ventana evaluada, legible cuando cruza la medianoche.
 *
 * Rendir el extremo `to` como sólo hora convierte "26 jul 23:35 → 27 jul 00:20"
 * en "26 jul - 23:35 → 00:20": se lee como una ventana que corre 23 h HACIA
 * ATRÁS. Peor con una orden abierta el lunes 18:00 y cerrada el martes 09:00 —
 * el lector cree que se evaluaron 30 min cuando fueron 15 h, y eso cambia por
 * completo el peso que le da a `pointsEvaluated`. La comparación va por día
 * calendario ARGENTINO, que es el que se muestra.
 */
function formatWindow(window_: { from: string; to: string } | null): string {
  if (!window_) return EMPTY;
  const sameDay =
    toArIsoDate(window_.from) !== '' && toArIsoDate(window_.from) === toArIsoDate(window_.to);
  return sameDay
    ? `${formatDateTimeShort(window_.from)} → ${formatTimeShort(window_.to)}`
    : `${formatDateTimeShort(window_.from)} → ${formatDateTimeShort(window_.to)}`;
}

function Row({ term, testId, children }: { term: string; testId: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.definition} data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

interface VerdictCardProps {
  report: ServiceOrderPresenceReport;
}

export function VerdictCard({ report }: VerdictCardProps) {
  const meta = VERDICT_META[report.verdict];
  const window_ = report.window;

  return (
    <article className={styles.card} data-verdict={report.verdict} data-testid="verdict-card">
      <header className={styles.head}>
        <span className={styles.iconWrap} aria-hidden="true">
          {meta.icon}
        </span>
        <div className={styles.headText}>
          <p className={styles.eyebrow}>Orden de servicio {report.serviceOrderCode}</p>
          <h3 className={styles.title}>{meta.label}</h3>
        </div>
      </header>

      <p className={styles.meaning} data-testid="verdict-meaning">
        {meta.meaning}
      </p>

      {report.reason && (
        <p className={styles.reason}>
          <span className={styles.reasonTerm}>Motivo informado por el sistema: </span>
          {report.reason}
        </p>
      )}

      <dl className={styles.evidence}>
        <Row term="Distancia mínima al domicilio" testId="evidence-distance">
          {formatMeters(report.minDistanceMeters)}
        </Row>
        <Row term="Hora del punto más cercano" testId="evidence-closest-at">
          {report.closestPointAt ? formatDateTimeShort(report.closestPointAt) : EMPTY}
        </Row>
        <Row term="Precisión de ese punto" testId="evidence-accuracy">
          {formatAccuracy(report.closestAccuracyMeters)}
        </Row>
        <Row term="Puntos evaluados en la ventana" testId="evidence-points">
          {report.pointsEvaluated}
        </Row>
        <Row term="Mayor hueco de cobertura" testId="evidence-gap">
          {formatMinutes(report.largestCoverageGapMinutes)}
        </Row>
        <Row term="Ventana evaluada" testId="evidence-window">
          {formatWindow(window_)}
        </Row>
        <Row term="Umbral de presencia" testId="evidence-threshold">
          {formatMeters(report.onSiteThresholdMeters)}
        </Row>
        <Row term="Cuadrilla" testId="evidence-team">
          {report.teamTechnicianName ?? report.teamLogin ?? EMPTY}
          {report.teamTechnicianName && report.teamLogin && (
            <span className={styles.subtle}> ({report.teamLogin})</span>
          )}
        </Row>
        <Row term="Resultado registrado en la orden" testId="evidence-result">
          {report.resultCodeName ?? EMPTY}
        </Row>
        <Row term="Coordenadas de cierre" testId="evidence-closure">
          {report.closureCoordinates
            ? `${report.closureCoordinates.latitude}, ${report.closureCoordinates.longitude}`
            : EMPTY}
        </Row>
      </dl>

      {report.mapsUrl && (
        <p className={styles.mapsRow}>
          <a
            className={styles.mapsLink}
            href={report.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver el punto más cercano en Google Maps
            <span className={styles.external} aria-hidden="true">
              ↗
            </span>
          </a>
        </p>
      )}

      <p className={styles.disclaimer} data-testid="verdict-disclaimer">
        Esta evidencia indica dónde estuvo el dispositivo que reporta la ubicación. No establece
        quién lo operaba.
      </p>
    </article>
  );
}
