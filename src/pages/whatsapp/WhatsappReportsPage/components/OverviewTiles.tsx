import type { ReportsOverview } from '@/types/messagingReports';
import styles from './OverviewTiles.module.css';

interface OverviewTilesProps {
  overview: ReportsOverview;
}

type TileDef = { key: keyof ReportsOverview; label: string };

const LIVE_TILES: TileDef[] = [
  { key: 'currentOpen', label: 'Abiertas' },
  { key: 'currentUnattended', label: 'Sin atender' },
  { key: 'currentUnassigned', label: 'Sin asignar' },
  { key: 'currentPending', label: 'Pendientes' },
];

const RANGE_TILES: TileDef[] = [
  { key: 'resolvedInRange', label: 'Resueltas' },
  { key: 'createdInRange', label: 'Creadas' },
];

function Tile({ def, overview }: { def: TileDef; overview: ReportsOverview }) {
  return (
    <div className={styles.tile}>
      <span className={styles.value} data-testid={`tile-${def.key}`}>
        {overview[def.key]}
      </span>
      <span className={styles.label}>{def.label}</span>
    </div>
  );
}

/**
 * OverviewTiles — dos grupos de tiles: "Conversaciones abiertas" (current* en
 * vivo) y "En el rango" (resueltas/creadas). Números grandes con
 * `font-variant-numeric` proporcional; el badge "en vivo" marca que los current*
 * se refrescan por polling (ver `useReportsOverview`).
 */
export function OverviewTiles({ overview }: OverviewTilesProps) {
  return (
    <div className={styles.groups}>
      <section className={styles.group} aria-labelledby="tiles-live-heading">
        <div className={styles.groupHead}>
          <h3 id="tiles-live-heading" className={styles.groupTitle}>
            Conversaciones abiertas
          </h3>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            en vivo
          </span>
        </div>
        <div className={styles.tiles}>
          {LIVE_TILES.map((def) => (
            <Tile key={def.key} def={def} overview={overview} />
          ))}
        </div>
      </section>

      <section className={styles.group} aria-labelledby="tiles-range-heading">
        <div className={styles.groupHead}>
          <h3 id="tiles-range-heading" className={styles.groupTitle}>
            En el rango
          </h3>
        </div>
        <div className={styles.tiles}>
          {RANGE_TILES.map((def) => (
            <Tile key={def.key} def={def} overview={overview} />
          ))}
        </div>
      </section>
    </div>
  );
}
