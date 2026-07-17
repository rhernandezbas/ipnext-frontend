import type { CampaignSegment } from '@/types/messagingBulk';

/** Un balance filtra SOLO si es un número finito estrictamente mayor a 0. */
function isEffectiveBalance(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * node-segment-fe — un filtro de red (nodo o AP) es un id NO vacío. `null` es
 * "limpiar explícitamente" (contrato BE), no un filtro; `''` tampoco filtra.
 */
function isNetworkFilter(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}

/**
 * hasSegmentCriteria (F2 apply chunk 2, FIX-1 fix wave) — true si el segmento
 * tiene AL MENOS un criterio de filtrado REAL. Se usa para gatear tanto el
 * preview automático (`CampaignComposer`) como el botón "Crear campaña" y la
 * nota de `SegmentBuilder`.
 *
 * FIX-1 — alineado con el BE (`assertSegmentIsFiltered`): un segmento filtra
 * SOLO si `statuses.length>0 || balanceMin>0 || balanceMax>0`. Un floor de $0
 * (o negativo/NaN) NO filtra a NADIE (todos tienen deuda >= $0) — el BE lo
 * rechaza con 400 UNFILTERED_SEGMENT. Antes el FE usaba `!= null`, lo que dejaba
 * pasar `balanceMin: 0` como criterio válido → preview inválido → dead-end 400
 * sin explicación. Ahora `<=0`/negativos/NaN cuentan como NO-criterio.
 *
 * node-segment-fe — el nodo/AP también cuenta como criterio: el BE actualizó
 * su regla (nodo o AP SOLOS ya son un segmento válido, sin estados/deuda).
 */
export function hasSegmentCriteria(segment: CampaignSegment): boolean {
  return (
    segment.statuses.length > 0 ||
    hasEffectiveBalanceFilter(segment) ||
    isNetworkFilter(segment.networkSiteId) ||
    isNetworkFilter(segment.accessPointId)
  );
}

/**
 * Micro-fix L1 (rediseño bulk-elegant) — "¿hay un filtro de deuda EFECTIVO?"
 * (>0, finito), el MISMO criterio que usa `hasSegmentCriteria` arriba — una
 * sola fuente de verdad. Exportado para el contador-chip del tab "Segmento"
 * (`CampaignComposer`): contar una deuda de $0/negativa como "1 filtro"
 * contradecía al hint del SegmentBuilder ("no filtra a nadie") y al gate, que
 * ya la tratan como no-criterio.
 */
export function hasEffectiveBalanceFilter(segment: CampaignSegment): boolean {
  return isEffectiveBalance(segment.balanceMin) || isEffectiveBalance(segment.balanceMax);
}

/**
 * hasRecipients (manual-recipients-fe, CRIT-1; extendido en bulk-csv-recipients
 * CSV-FE-5 con un 3er parámetro) — gate de "hay destinatarios" del composer,
 * que combina el segmento por estado/deuda con la LISTA MANUAL y, ahora, con
 * los contactos del CSV cargado. Una lista manual O un CSV no vacíos cuentan
 * como criterio aunque el segmento esté vacío (el BE devuelve `count` = unión
 * dedup de las 3 fuentes). Se mantiene `hasSegmentCriteria` separado porque
 * `SegmentBuilder` lo usa para SU propio hint (que habla sólo del segmento).
 *
 * `hasCsvContacts` default `false` — backcompat: cualquier caller que todavía
 * llame con 2 args (sin CSV) se comporta EXACTAMENTE igual que antes.
 */
export function hasRecipients(
  segment: CampaignSegment,
  manualClientIds: string[],
  hasCsvContacts: boolean = false,
): boolean {
  return hasSegmentCriteria(segment) || manualClientIds.length > 0 || hasCsvContacts;
}

/**
 * true si el operador ingresó un balance que NO filtra (0/negativo/NaN) — sirve
 * para avisarle EXPLÍCITAMENTE que ese valor no cuenta como criterio, en vez de
 * dejarlo pensar que sí y chocar con el 400 del BE.
 */
export function hasIneffectiveBalance(segment: CampaignSegment): boolean {
  return isBalanceEntered(segment.balanceMin) || isBalanceEntered(segment.balanceMax);
}

/** El operador escribió algo en el input (no `undefined`) pero no filtra (<=0 o NaN). */
function isBalanceEntered(value: number | undefined): boolean {
  return value != null && !isEffectiveBalance(value);
}
