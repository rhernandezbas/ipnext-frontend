import type { ReportsTraffic } from '@/types/messagingReports';
import { buildHeatGrid, heatLevel, maxCount, DOW_LABELS_AR, DOW_FULL_AR } from '../lib/heatmap';
import styles from './TrafficHeatmap.module.css';

interface TrafficHeatmapProps {
  traffic: ReportsTraffic;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * TrafficHeatmap — heatmap día×hora del tráfico de conversaciones. Se construye
 * como una `<table>` semántica (encabezados de fila = días, de columna = horas):
 * es a la vez el sistema VISUAL (celdas coloreadas por volumen) y la tabla
 * ACCESIBLE (cada celda con `aria-label` "Lunes 14:00 — N conversaciones").
 *
 * Escala secuencial azul de un solo tono (dataviz): nivel 0 = celda vacía/neutra
 * (color de superficie, sin dato), niveles 1..5 claro→oscuro por volumen. El BE
 * ya agrupa en hora AR con `dow` 0=domingo — usamos `dow`/`hour` tal cual, sin
 * reconvertir. Scrollea horizontal en su contenedor si no entra.
 */
export function TrafficHeatmap({ traffic }: TrafficHeatmapProps) {
  const cells = traffic.cells;

  if (cells.length === 0) {
    return (
      <p className={styles.empty} role="status">
        Sin tráfico en el rango.
      </p>
    );
  }

  const grid = buildHeatGrid(cells);
  const max = maxCount(cells);

  return (
    <figure className={styles.wrap}>
      <div className={styles.scroll}>
        <table className={styles.table} aria-label="Tráfico por día y hora">
          <caption className={styles.caption}>
            Tráfico de conversaciones por día de semana y hora (hora local de Buenos Aires).
          </caption>
          <thead>
            <tr>
              <th scope="col" className={styles.corner}>
                <span className={styles.srOnly}>Día</span>
              </th>
              {HOURS.map((h) => (
                <th key={h} scope="col" className={styles.hourHead}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOW_LABELS_AR.map((day, dow) => (
              <tr key={day}>
                <th scope="row" className={styles.dayHead}>
                  {day}
                </th>
                {HOURS.map((h) => {
                  const count = grid[dow][h];
                  const level = count == null ? 0 : heatLevel(count, max);
                  const label =
                    count == null
                      ? `${DOW_FULL_AR[dow]} ${pad(h)}:00 — sin datos`
                      : `${DOW_FULL_AR[dow]} ${pad(h)}:00 — ${count} conversaciones`;
                  return (
                    <td
                      key={h}
                      className={`${styles.cell} ${styles[`level${level}`]}`}
                      data-level={level}
                      aria-label={label}
                      title={label}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className={styles.legend}>
        <span className={styles.legendLabel}>Menos</span>
        <span className={`${styles.legendSwatch} ${styles.level1}`} aria-hidden="true" />
        <span className={`${styles.legendSwatch} ${styles.level2}`} aria-hidden="true" />
        <span className={`${styles.legendSwatch} ${styles.level3}`} aria-hidden="true" />
        <span className={`${styles.legendSwatch} ${styles.level4}`} aria-hidden="true" />
        <span className={`${styles.legendSwatch} ${styles.level5}`} aria-hidden="true" />
        <span className={styles.legendLabel}>Más</span>
        <span className={styles.legendSep} aria-hidden="true" />
        <span className={`${styles.legendSwatch} ${styles.level0}`} aria-hidden="true" />
        <span className={styles.legendLabel}>Sin datos</span>
      </figcaption>
    </figure>
  );
}
