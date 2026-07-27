import type { TeamLiveState } from '@/types/technicianLocation';
import { formatMinutesElapsed } from '@/utils/formatGeo';
import styles from './TeamStateBadge.module.css';

/**
 * Badge de estado de rastreo de una cuadrilla.
 *
 * El estado NUNCA se comunica sólo con color: cada uno lleva su ETIQUETA de texto
 * y un ícono de forma distinta (círculo lleno / reloj / círculo tachado). Alguien
 * con daltonismo, en un monitor lavado o imprimiendo en blanco y negro tiene que
 * poder distinguir "activa" de "desactualizada" — la diferencia decide a qué
 * cuadrilla se le manda un trabajo.
 *
 * `DESACTUALIZADA` muestra además la antigüedad del dato, porque el peligro no es
 * que el dato sea viejo sino que se lea como actual.
 */

export const TEAM_STATE_LABEL: Record<TeamLiveState, string> = {
  ACTIVA: 'Activa',
  DESACTUALIZADA: 'Desactualizada',
  SIN_RASTRO: 'Sin rastro',
};

interface TeamStateBadgeProps {
  state: TeamLiveState;
  /** Antigüedad del último punto. Sólo se muestra en `DESACTUALIZADA`. */
  minutesSinceLastPoint?: number | null;
}

function StateIcon({ state }: { state: TeamLiveState }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true } as const;

  if (state === 'ACTIVA') {
    return (
      <svg {...common} className={styles.icon}>
        <circle cx="6" cy="6" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (state === 'DESACTUALIZADA') {
    return (
      <svg {...common} className={styles.icon}>
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3.5V6l1.8 1.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} className={styles.icon}>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TeamStateBadge({ state, minutesSinceLastPoint }: TeamStateBadgeProps) {
  return (
    <span className={styles.badge} data-state={state}>
      <StateIcon state={state} />
      <span className={styles.label}>{TEAM_STATE_LABEL[state]}</span>
      {state === 'DESACTUALIZADA' && minutesSinceLastPoint != null && (
        <span className={styles.age}>· {formatMinutesElapsed(minutesSinceLastPoint)}</span>
      )}
    </span>
  );
}
