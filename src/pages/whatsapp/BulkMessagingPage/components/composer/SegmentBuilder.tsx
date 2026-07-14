import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import type { CampaignSegment } from '@/types/messagingBulk';
import { hasSegmentCriteria, hasIneffectiveBalance } from './segmentCriteria';
import styles from './SegmentBuilder.module.css';

interface SegmentBuilderProps {
  value: CampaignSegment;
  onChange: (next: CampaignSegment) => void;
}

type ClientStatus = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

const STATUS_OPTIONS: ClientStatus[] = ['active', 'late', 'blocked', 'inactive', 'baja'];

/** `''` (input vacío) → `undefined`, NUNCA `NaN` — un balance vacío es "sin filtro", no un número inválido. */
function parseBalance(text: string): number | undefined {
  return text === '' ? undefined : Number(text);
}

/**
 * SegmentBuilder (F2 apply chunk 2, SEG-1..SEG-5) — checkboxes de
 * `ClientStatus` + rango de deuda. Controlado 100% (`value`+`onChange`), sin
 * estado propio — `CampaignComposer` es dueño del `CampaignSegment` (lo
 * necesita para el debounce de preview + `createCampaign`).
 *
 * Reusa `StatusBadge` (mismo átomo de Clientes/ClientStatsCards) junto a cada
 * checkbox — refuerzo visual del color por estado sin inventar una paleta
 * nueva acá.
 */
export function SegmentBuilder({ value, onChange }: SegmentBuilderProps) {
  const criteriaPresent = hasSegmentCriteria(value);
  // FIX-1: el operador escribió una deuda que no filtra ($0/negativo) — avisar
  // que no cuenta, en vez de dejarlo creer que ya hay criterio (dead-end 400).
  const ineffectiveBalance = hasIneffectiveBalance(value);

  function toggleStatus(status: ClientStatus) {
    const next = value.statuses.includes(status)
      ? value.statuses.filter((s) => s !== status)
      : [...value.statuses, status];
    onChange({ ...value, statuses: next });
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Segmento de destinatarios</legend>

      <div className={styles.statusGroup} role="group" aria-label="Estado del cliente">
        {STATUS_OPTIONS.map((status) => {
          const checkboxId = `bulk-segment-status-${status}`;
          return (
            <label key={status} htmlFor={checkboxId} className={styles.statusOption}>
              <input
                id={checkboxId}
                type="checkbox"
                className={styles.checkbox}
                checked={value.statuses.includes(status)}
                onChange={() => toggleStatus(status)}
              />
              <StatusBadge status={status} />
            </label>
          );
        })}
      </div>

      <div className={styles.balanceGroup}>
        <div className={styles.balanceField}>
          <label htmlFor="bulk-segment-balance-min">Deuda mínima</label>
          <input
            id="bulk-segment-balance-min"
            type="number"
            min={0}
            className={styles.balanceInput}
            value={value.balanceMin ?? ''}
            onChange={(e) => onChange({ ...value, balanceMin: parseBalance(e.target.value) })}
          />
        </div>
        <div className={styles.balanceField}>
          <label htmlFor="bulk-segment-balance-max">Deuda máxima</label>
          <input
            id="bulk-segment-balance-max"
            type="number"
            min={0}
            className={styles.balanceInput}
            value={value.balanceMax ?? ''}
            onChange={(e) => onChange({ ...value, balanceMax: parseBalance(e.target.value) })}
          />
        </div>
      </div>

      {!criteriaPresent && (
        <p className={styles.hint} role="status">
          {ineffectiveBalance
            ? 'Una deuda de $0 o menos no filtra a nadie — ingresá un monto mayor a 0 o elegí un estado.'
            : 'Elegí al menos un estado o un rango de deuda.'}
        </p>
      )}
    </fieldset>
  );
}
