import type { CampaignSegment } from '@/types/messagingBulk';

/** Un balance filtra SOLO si es un número finito estrictamente mayor a 0. */
function isEffectiveBalance(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
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
 */
export function hasSegmentCriteria(segment: CampaignSegment): boolean {
  return (
    segment.statuses.length > 0 ||
    isEffectiveBalance(segment.balanceMin) ||
    isEffectiveBalance(segment.balanceMax)
  );
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
