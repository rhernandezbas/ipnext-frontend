import type { ReportsDateRange, ReportsResolutions } from '@/types/messagingReports';
import { fillResolutionDays } from '../lib/resolutions';
import styles from './ResolutionsChart.module.css';

interface ResolutionsChartProps {
  range: ReportsDateRange;
  resolutions: ReportsResolutions;
}

/** "2026-07-14" → "14/07" para el eje X. */
function shortLabel(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

/**
 * ResolutionsChart — barras de resoluciones por día en el rango. Se construye a
 * mano (CSS grid/divs, cero deps de charting) para un sistema visual único y
 * coherente con el heatmap. Rellena con 0 los días sin dato (`fillResolutionDays`)
 * para un eje continuo. Cada barra lleva `aria-label` (fecha + count) y hay una
 * tabla accesible alternativa (visualmente oculta) con todos los días.
 */
export function ResolutionsChart({ range, resolutions }: ResolutionsChartProps) {
  const days = fillResolutionDays(range, resolutions.days);
  const total = days.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className={styles.empty} role="status">
        Sin resoluciones en el rango.
      </p>
    );
  }

  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <figure className={styles.wrap}>
      <div
        className={styles.bars}
        role="img"
        aria-label={`Resoluciones por día: ${total} en total a lo largo de ${days.length} días.`}
      >
        {days.map((d) => {
          const pct = Math.round((d.count / max) * 100);
          return (
            <div
              key={d.date}
              className={styles.bar}
              data-testid="resolution-bar"
              aria-label={`${d.date}: ${d.count} resoluciones`}
              title={`${d.date}: ${d.count}`}
            >
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ height: `${pct}%` }} />
              </div>
              <span className={styles.barTick}>{shortLabel(d.date)}</span>
            </div>
          );
        })}
      </div>

      <table className={styles.srOnly}>
        <caption>Resoluciones por día</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Resoluciones</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
