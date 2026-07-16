import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import type { CampaignSegment } from '@/types/messagingBulk';
import { hasSegmentCriteria, hasIneffectiveBalance } from './segmentCriteria';
import styles from './SegmentBuilder.module.css';

interface SegmentBuilderProps {
  value: CampaignSegment;
  onChange: (next: CampaignSegment) => void;
}

type ClientStatus = 'active' | 'late' | 'blocked' | 'inactive' | 'baja';

const STATUS_OPTIONS: ClientStatus[] = ['active', 'late', 'blocked', 'inactive', 'baja'];

/** Catálogos de red: staleTime alto (no cambian por minuto) — mismo criterio que `useAssignableAccessPoints` (30s). */
const SITES_STALE_TIME_MS = 60_000;

const NODE_ERROR_ID = 'bulk-segment-node-error';
const AP_ERROR_ID = 'bulk-segment-ap-error';

/** `''` (input vacío) → `undefined`, NUNCA `NaN` — un balance vacío es "sin filtro", no un número inválido. */
function parseBalance(text: string): number | undefined {
  return text === '' ? undefined : Number(text);
}

/**
 * SegmentBuilder (F2 apply chunk 2, SEG-1..SEG-5) — checkboxes de
 * `ClientStatus` + rango de deuda + filtro de red Nodo/AP (node-segment-fe).
 * Controlado 100% (`value`+`onChange`), sin estado propio de selección —
 * `CampaignComposer` es dueño del `CampaignSegment` (lo necesita para el
 * debounce de preview + `createCampaign`).
 *
 * Reusa `StatusBadge` (mismo átomo de Clientes/ClientStatsCards) junto a cada
 * checkbox — refuerzo visual del color por estado sin inventar una paleta
 * nueva acá.
 *
 * node-segment-fe — dos `Select` PROPIOS (Nodo + Access Point, el segundo
 * acotado al nodo elegido), mismo approach que
 * `ContractNetworkAssignmentPicker` (catálogos vía hooks propios,
 * `useNetworkSites`/`useAssignableAccessPoints` — cache compartida de
 * TanStack, cero fetch extra respecto del picker). Opción "Todos" para
 * limpiar cada filtro. Caso de uso: "aviso de corte a todos los clientes del
 * nodo X / AP Y" — nodo o AP SOLOS ya son un segmento válido (regla BE).
 */
export function SegmentBuilder({ value, onChange }: SegmentBuilderProps) {
  const criteriaPresent = hasSegmentCriteria(value);
  // FIX-1: el operador escribió una deuda que no filtra ($0/negativo) — avisar
  // que no cuenta, en vez de dejarlo creer que ya hay criterio (dead-end 400).
  const ineffectiveBalance = hasIneffectiveBalance(value);

  const sitesQuery = useNetworkSites({ staleTime: SITES_STALE_TIME_MS });
  // El nodo elegido ACOTA el catálogo de APs (mismo patrón que el picker de
  // contrato); sin nodo se pide el catálogo completo (elegir AP suelto es válido).
  const apsQuery = useAssignableAccessPoints(value.networkSiteId ?? null);

  const sites = sitesQuery.data ?? [];
  const aps = apsQuery.data ?? [];
  const sitesEmpty = !sitesQuery.isLoading && !sitesQuery.isError && sites.length === 0;
  const apsEmpty = !apsQuery.isLoading && !apsQuery.isError && aps.length === 0;

  // 4 ramas por select (loading/error/empty/success): en las 3 primeras el
  // Select queda deshabilitado SIN opciones (así el trigger muestra el
  // placeholder de la rama); solo en success se arma "Todos" + catálogo.
  const siteOptions: SelectOption[] =
    sitesQuery.isLoading || sitesQuery.isError || sitesEmpty
      ? []
      : [{ value: '', label: 'Todos los nodos' }, ...sites.map((s) => ({ value: s.id, label: s.name }))];
  const apOptions: SelectOption[] =
    apsQuery.isLoading || apsQuery.isError || apsEmpty
      ? []
      : [{ value: '', label: 'Todos los APs' }, ...aps.map((a) => ({ value: a.id, label: a.name }))];

  function toggleStatus(status: ClientStatus) {
    const next = value.statuses.includes(status)
      ? value.statuses.filter((s) => s !== status)
      : [...value.statuses, status];
    onChange({ ...value, statuses: next });
  }

  function handleSiteChange(next: string) {
    // Cambiar (o limpiar) el nodo re-scopea el catálogo de APs: el AP elegido
    // antes puede no pertenecer al nodo nuevo — arranca la elección de nuevo
    // (mismo criterio que el picker de contrato). `undefined` = sin filtro,
    // la key se OMITE del payload (mismo criterio que un balance vacío).
    onChange({ ...value, networkSiteId: next || undefined, accessPointId: undefined });
  }

  function handleApChange(next: string) {
    if (!next) {
      // "Todos los APs" limpia SOLO el AP — el nodo sigue filtrando.
      onChange({ ...value, accessPointId: undefined });
      return;
    }
    // Autocompleta el nodo del AP elegido (coherencia visual + el listado de
    // APs queda scoped) — mismo comportamiento que el picker de contrato. Un
    // AP sin nodo linkeado (`networkSiteId: null`) NO fuerza nada: AP solo
    // también es un segmento válido (regla BE).
    const ap = aps.find((a) => a.id === next);
    onChange({ ...value, accessPointId: next, networkSiteId: ap?.networkSiteId ?? value.networkSiteId });
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

      <div className={styles.networkGroup}>
        <div className={styles.networkField}>
          <Select
            id="bulk-segment-node"
            label="Nodo"
            value={value.networkSiteId ?? ''}
            onChange={handleSiteChange}
            options={siteOptions}
            placeholder={sitesQuery.isLoading ? 'Cargando nodos…' : 'Todos los nodos'}
            disabled={sitesQuery.isLoading || sitesQuery.isError || sitesEmpty}
            aria-describedby={sitesQuery.isError ? NODE_ERROR_ID : undefined}
          />
          {sitesQuery.isError && (
            <p id={NODE_ERROR_ID} className={styles.fieldError} role="alert">
              No se pudieron cargar los nodos. Reintentá.
            </p>
          )}
          {sitesEmpty && <p className={styles.fieldHint}>No hay nodos disponibles.</p>}
        </div>

        <div className={styles.networkField}>
          <Select
            id="bulk-segment-ap"
            label="Access Point"
            value={value.accessPointId ?? ''}
            onChange={handleApChange}
            options={apOptions}
            placeholder={apsQuery.isLoading ? 'Cargando APs…' : 'Todos los APs'}
            disabled={apsQuery.isLoading || apsQuery.isError || apsEmpty}
            aria-describedby={apsQuery.isError ? AP_ERROR_ID : undefined}
          />
          {apsQuery.isError && (
            <p id={AP_ERROR_ID} className={styles.fieldError} role="alert">
              No se pudieron cargar los access points. Reintentá.
            </p>
          )}
          {apsEmpty && <p className={styles.fieldHint}>No hay access points disponibles.</p>}
        </div>
      </div>

      {!criteriaPresent && (
        <p className={styles.hint} role="status">
          {ineffectiveBalance
            ? 'Una deuda de $0 o menos no filtra a nadie — ingresá un monto mayor a 0 o elegí un estado o un nodo/AP.'
            : 'Elegí al menos un estado, un rango de deuda o un nodo/AP.'}
        </p>
      )}
    </fieldset>
  );
}
