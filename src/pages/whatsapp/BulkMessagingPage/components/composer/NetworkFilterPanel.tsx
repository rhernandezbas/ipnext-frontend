import { useEffect } from 'react';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import { useAssignableAccessPoints } from '@/hooks/useAccessPoints';
import type { CampaignSegment } from '@/types/messagingBulk';
import { hasSegmentCriteria } from './segmentCriteria';
import styles from './NetworkFilterPanel.module.css';

interface NetworkFilterPanelProps {
  value: CampaignSegment;
  onChange: (next: CampaignSegment) => void;
}

/** Catálogos de red: staleTime alto (no cambian por minuto) — mismo criterio que `useAssignableAccessPoints` (30s). */
const SITES_STALE_TIME_MS = 60_000;

const NODE_ERROR_ID = 'bulk-segment-node-error';
const AP_ERROR_ID = 'bulk-segment-ap-error';

/**
 * NetworkFilterPanel (change network-filter-tab) — el filtro de red Nodo/AP
 * del segmento, EXTRAÍDO de `SegmentBuilder` a su propio tab de la card
 * "Destinatarios" (pedido del usuario: Segmento | Nodo/AP | Manuales | CSV).
 * Mudanza de UI ÚNICAMENTE: `networkSiteId`/`accessPointId` siguen viajando
 * DENTRO del `CampaignSegment` (AND con estados/deuda; nodo o AP SOLOS ya son
 * un segmento válido, regla BE) — el payload de preview/create es idéntico.
 *
 * node-segment-fe — dos `Select` PROPIOS (Nodo + Access Point, el segundo
 * acotado al nodo elegido), mismo approach que
 * `ContractNetworkAssignmentPicker` (catálogos vía hooks propios,
 * `useNetworkSites`/`useAssignableAccessPoints` — cache compartida de
 * TanStack, cero fetch extra respecto del picker). Opción "Todos" para
 * limpiar cada filtro. Caso de uso: "aviso de corte a todos los clientes del
 * nodo X / AP Y".
 *
 * Guards ganados en reviews, MUDADOS INTACTOS (pineados en
 * `NetworkFilterPanel.test.tsx`):
 *  M1  options desde la cache aunque el refetch falle (`query.data` sobrevive
 *      a `isError` en TanStack v5) — el filtro elegido sigue visible/limpiable
 *  M2  fila del AP gateada por `can('network.read')` + query `enabled=false`
 *      sin el permiso (mismatch RBAC: `/access-points` exige network.read,
 *      `/network-sites` es auth-only)
 *  M3  auto-limpieza de `accessPointId` al revocarse el permiso, SOLO con el
 *      false DEFINITIVO (no durante loading/error de /me)
 */
export function NetworkFilterPanel({ value, onChange }: NetworkFilterPanelProps) {
  const criteriaPresent = hasSegmentCriteria(value);

  // M2 (fix wave) — mismatch RBAC: `GET /access-points` exige `network.read`
  // (`/network-sites` es auth-only). Sin el permiso, la fila del AP no se
  // renderiza NI se dispara la query (403 seguro que ningún "Reintentá" cura).
  const { can, isLoading: permsLoading, isError: permsError } = useMyPermissions();
  const canReadNetwork = can('network.read');

  // M3 (micro fix wave) — misma clase de "filtro oculto" que M1, por otra
  // puerta: si network.read se REVOCA a mitad de sesión (refetch de /me,
  // staleTime 5min) con un AP ya elegido, el gate M2 esconde la fila pero
  // `accessPointId` seguiría viajando en preview/create — un filtro que el
  // operador no puede ver ni limpiar (y el confirm mostraría el uuid pelado,
  // catálogo con query disabled). Se limpia SOLO con el permiso resuelto en
  // false DEFINITIVO: el hook devuelve can()=false mientras carga
  // (permissions=[]) y tras un fetch fallido — limpiar ahí le borraría el
  // filtro a un usuario CON permiso. El nodo QUEDA (su endpoint es auth-only).
  const revokedWithApSet = !permsLoading && !permsError && !canReadNetwork && !!value.accessPointId;
  useEffect(() => {
    if (!revokedWithApSet) return;
    onChange({ ...value, accessPointId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gateado por el booleano derivado; value/onChange frescos al disparar
  }, [revokedWithApSet]);

  const sitesQuery = useNetworkSites({ staleTime: SITES_STALE_TIME_MS });
  // El nodo elegido ACOTA el catálogo de APs (mismo patrón que el picker de
  // contrato); sin nodo se pide el catálogo completo (elegir AP suelto es válido).
  const apsQuery = useAssignableAccessPoints(value.networkSiteId ?? null, canReadNetwork);

  const sites = sitesQuery.data ?? [];
  const aps = apsQuery.data ?? [];

  // M1 (fix wave) — la cache de TanStack v5 SOBREVIVE a un refetch fallido
  // (`isError` con `data` del último success): las options se arman desde la
  // cache igual, así el filtro elegido SIGUE visible y limpiable. Antes, en
  // error se forzaba options=[] → el trigger caía al placeholder "Todos los
  // nodos" MIENTRAS `networkSiteId` seguía viajando en el payload (filtro
  // OCULTO: el operador creía mandar a toda la base). "No disponible" queda
  // solo para data nunca cargada.
  const sitesUnavailable = sitesQuery.isLoading || (sitesQuery.isError && sitesQuery.data === undefined);
  const apsUnavailable = apsQuery.isLoading || (apsQuery.isError && apsQuery.data === undefined);
  const sitesEmpty = !sitesUnavailable && sites.length === 0;
  const apsEmpty = !apsUnavailable && aps.length === 0;

  // 4 ramas por select (loading / error-sin-cache / empty / success-o-cache):
  // sin catálogo usable el Select queda deshabilitado SIN opciones (el trigger
  // muestra el placeholder de la rama); con catálogo (fresco O cacheado tras
  // un refetch fallido, M1) se arma "Todos" + opciones y queda usable.
  const siteOptions: SelectOption[] =
    sitesUnavailable || sitesEmpty
      ? []
      : [{ value: '', label: 'Todos los nodos' }, ...sites.map((s) => ({ value: s.id, label: s.name }))];
  const apOptions: SelectOption[] =
    apsUnavailable || apsEmpty
      ? []
      : [{ value: '', label: 'Todos los APs' }, ...aps.map((a) => ({ value: a.id, label: a.name }))];

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
      <legend className={styles.legend}>Filtro de red por nodo/AP</legend>

      <div className={styles.networkGroup}>
        <div className={styles.networkField}>
          <Select
            id="bulk-segment-node"
            label="Nodo"
            value={value.networkSiteId ?? ''}
            onChange={handleSiteChange}
            options={siteOptions}
            placeholder={
              // LOW (fix wave) — en error sin cache, "Todos los nodos" se
              // leería como valor aplicado: placeholder neutro.
              sitesQuery.isLoading ? 'Cargando nodos…' : sitesQuery.isError ? 'No disponible' : 'Todos los nodos'
            }
            disabled={sitesUnavailable || sitesEmpty}
            aria-describedby={sitesQuery.isError ? NODE_ERROR_ID : undefined}
          />
          {sitesQuery.isError && (
            <p id={NODE_ERROR_ID} className={styles.fieldError} role="alert">
              {sitesQuery.data
                ? 'No se pudo actualizar el catálogo de nodos — se muestra la última versión cargada.'
                : 'No se pudieron cargar los nodos. Reintentá.'}
            </p>
          )}
          {sitesEmpty && <p className={styles.fieldHint}>No hay nodos disponibles.</p>}
        </div>

        {/* M2 (fix wave) — TODA la fila del AP detrás del gate: sin
            network.read no hay select ni un alert de 403 incurable. */}
        {canReadNetwork && (
          <div className={styles.networkField}>
            <Select
              id="bulk-segment-ap"
              label="Access Point"
              value={value.accessPointId ?? ''}
              onChange={handleApChange}
              options={apOptions}
              placeholder={
                apsQuery.isLoading ? 'Cargando APs…' : apsQuery.isError ? 'No disponible' : 'Todos los APs'
              }
              disabled={apsUnavailable || apsEmpty}
              aria-describedby={apsQuery.isError ? AP_ERROR_ID : undefined}
            />
            {apsQuery.isError && (
              <p id={AP_ERROR_ID} className={styles.fieldError} role="alert">
                {apsQuery.data
                  ? 'No se pudo actualizar el catálogo de access points — se muestra la última versión cargada.'
                  : 'No se pudieron cargar los access points. Reintentá.'}
              </p>
            )}
            {apsEmpty && <p className={styles.fieldHint}>No hay access points disponibles.</p>}
          </div>
        )}
      </div>

      {/* Hint espejo del panel Segmento (network-filter-tab) — mismo gate
          `hasSegmentCriteria` sobre el segmento COMPLETO: si ya hay estados/
          deuda elegidos en la otra pestaña, acá no se molesta a nadie. */}
      {!criteriaPresent && (
        <p className={styles.hint} role="status">
          Un nodo/AP solo ya es un criterio válido — elegí uno acá, o un estado o rango de deuda en la pestaña
          Segmento.
        </p>
      )}
    </fieldset>
  );
}
