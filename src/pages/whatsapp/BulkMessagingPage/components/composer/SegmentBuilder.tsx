import { useEffect } from 'react';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { CampaignSegment } from '@/types/messagingBulk';
import { hasSegmentCriteria, hasIneffectiveBalance } from './segmentCriteria';
import styles from './SegmentBuilder.module.css';

interface SegmentBuilderProps {
  value: CampaignSegment;
  onChange: (next: CampaignSegment) => void;
}

type ClientStatus = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

const STATUS_OPTIONS: ClientStatus[] = ['active', 'late', 'blocked', 'inactive', 'baja'];

/** bulk-granular-perms — permiso `messaging.bulk_<status>` requerido para enviar a ese estado. */
const statusPermission = (status: ClientStatus): string => `messaging.bulk_${status}`;

/** `''` (input vacío) → `undefined`, NUNCA `NaN` — un balance vacío es "sin filtro", no un número inválido. */
function parseBalance(text: string): number | undefined {
  return text === '' ? undefined : Number(text);
}

/**
 * SegmentBuilder (F2 apply chunk 2, SEG-1..SEG-5) — checkboxes de
 * `ClientStatus` + rango de deuda. Controlado 100% (`value`+`onChange`), sin
 * estado propio de selección — `CampaignComposer` es dueño del
 * `CampaignSegment` (lo necesita para el debounce de preview +
 * `createCampaign`).
 *
 * Change network-filter-tab — el filtro de red Nodo/AP se MUDÓ a su propio
 * tab de la card "Destinatarios" (`NetworkFilterPanel`, pedido del usuario).
 * Mudanza de UI únicamente: `networkSiteId`/`accessPointId` siguen viviendo
 * DENTRO del `CampaignSegment` (AND con estados/deuda), así que el hint de
 * "sin criterio" de acá sigue mirando el segmento COMPLETO (un nodo elegido
 * en la otra pestaña ES criterio) y su copy apunta a la pestaña Nodo/AP.
 *
 * Reusa `StatusBadge` (mismo átomo de Clientes/ClientStatsCards) junto a cada
 * checkbox — refuerzo visual del color por estado sin inventar una paleta
 * nueva acá.
 */
export function SegmentBuilder({ value, onChange }: SegmentBuilderProps) {
  const { can } = useMyPermissions();
  const criteriaPresent = hasSegmentCriteria(value);
  // FIX-1: el operador escribió una deuda que no filtra ($0/negativo) — avisar
  // que no cuenta, en vez de dejarlo creer que ya hay criterio (dead-end 400).
  const ineffectiveBalance = hasIneffectiveBalance(value);

  // bulk-granular-perms — defensa en profundidad: si el `value` trae un estado
  // que el usuario NO tiene permiso para enviar (permiso revocado, estado
  // seteado por otra vía), se STRIPEA para que no viaje al preview/create. El
  // checkbox deshabilitado ya impide TILDARLO, esto cubre el caso "ya venía
  // tildado". Sólo dispara onChange cuando hay algo real que sacar (evita loop).
  useEffect(() => {
    const forbidden = value.statuses.filter((s) => !can(statusPermission(s as ClientStatus)));
    if (forbidden.length > 0) {
      onChange({ ...value, statuses: value.statuses.filter((s) => can(statusPermission(s as ClientStatus))) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps primitivas: el join + la identidad de `can`
  }, [value.statuses.join(','), can]);

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
          // bulk-granular-perms — sin `messaging.bulk_<status>` el estado no se
          // puede tildar (checkbox deshabilitado + candado/tooltip).
          const permitted = can(statusPermission(status));
          return (
            <label
              key={status}
              htmlFor={checkboxId}
              className={styles.statusOption}
              title={permitted ? undefined : 'No tenés permiso para enviar a este estado'}
              data-disabled={permitted ? undefined : 'true'}
            >
              <input
                id={checkboxId}
                type="checkbox"
                className={styles.checkbox}
                checked={value.statuses.includes(status)}
                disabled={!permitted}
                onChange={() => toggleStatus(status)}
              />
              <StatusBadge status={status} />
              {!permitted && (
                <span className={styles.lock} aria-hidden="true">
                  🔒
                </span>
              )}
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
            ? 'Una deuda de $0 o menos no filtra a nadie — ingresá un monto mayor a 0, elegí un estado o definí un nodo/AP (pestaña Nodo/AP).'
            : 'Elegí al menos un estado, un rango de deuda o un nodo/AP (pestaña Nodo/AP).'}
        </p>
      )}
    </fieldset>
  );
}
