import type { WhatsappPaginatedQuery } from '@/types/whatsapp';

/**
 * inboxViews (inbox-views Ola 1) — catálogo de VISTAS del inbox estilo
 * Chatwoot (My Inbox / Unattended / All / Unassigned / Resolved) + helpers
 * PUROS del sub-menú lateral (`InboxViewsMenu`).
 *
 * Cada vista es un PRESET EXACTO de `WhatsappPaginatedQuery` — el sub-menú no
 * agrega un eje de filtro nuevo encima de los existentes: REEMPLAZA los
 * controles viejos (tab Abiertas/Resueltas + radios Todas/Mías/Sin asignar)
 * como única fuente de status/assignment/view. El filtro por campaña y la
 * búsqueda quedan aparte (arriba de la lista) y NO participan del preset.
 */

export type InboxViewId =
  | 'mine'
  | 'unattended'
  | 'mentioned'
  | 'all'
  | 'unassigned'
  | 'snoozed'
  | 'resolved';

export interface InboxViewDef {
  id: InboxViewId;
  label: string;
}

/**
 * Orden de la sidebar — paridad con Chatwoot (My Inbox primero, Resolved
 * último). Ola 6 intercala las 2 vistas nuevas por afinidad semántica:
 * "Menciones" junto a "Sin atender" (ambas son "esto te reclama a VOS"), y
 * "Pospuestas" junto a "Sin asignar" (ambas son buckets de gestión del
 * backlog, antes de "Resueltas").
 */
export const INBOX_VIEWS: readonly InboxViewDef[] = [
  { id: 'mine', label: 'Mi bandeja' },
  { id: 'unattended', label: 'Sin atender' },
  { id: 'mentioned', label: 'Menciones' },
  { id: 'all', label: 'Todas' },
  { id: 'unassigned', label: 'Sin asignar' },
  { id: 'snoozed', label: 'Pospuestas' },
  { id: 'resolved', label: 'Resueltas' },
] as const;

/**
 * Preset de query por vista — pin del contrato BE (verificado contra
 * `messaging.routes.ts` del worktree inbox-views-be, NO un boceto):
 *
 * - `mine`/`unassigned`: `assignment` server-side (F1.5-C2) sobre el bucket
 *   abierto (`status:'open'` explícito — default VISUAL del FE, design
 *   inbox-resolve D5).
 * - `unattended`: `view=unattended` SOLO. Es un eje PROPIO del BE (ortogonal a
 *   assignment) y GANA sobre `status` (el bucket "no-resuelta + último mensaje
 *   público inbound" ya lleva su propio filtro de ciclo de vida) — mandar
 *   `status` además sería ruido en la queryKey sin efecto en el resultado.
 * - `all`: `{status:'open'}` — IDÉNTICO al estado inicial histórico de la page
 *   (mismo cache entry de React Query, cero regresión).
 * - `resolved`: `{status:'resolved'}` — sin assignment: los presets son
 *   EXCLUYENTES, elegir una vista nunca arrastra ejes de la anterior.
 */
export const INBOX_VIEW_PRESETS: Record<InboxViewId, Pick<WhatsappPaginatedQuery, 'status' | 'assignment' | 'view'>> = {
  mine: { status: 'open', assignment: 'mine' },
  unattended: { view: 'unattended' },
  // Ola 6 (menciones): `view=mentioned` es un eje PROPIO del BE (conversaciones
  // con una mención NO LEÍDA del user actual). A diferencia del resto de los
  // buckets abiertos, MUESTRA RESUELTAS también (una mención te reclama aunque
  // la conversación ya esté resuelta) — por eso NO manda `status` (no es un
  // bucket de ciclo de vida) y el cinturón client-side de `ConversationList` se
  // desactiva para esta vista (ver `filterByStatus` en `WhatsappInboxPage`).
  mentioned: { view: 'mentioned' },
  all: { status: 'open' },
  unassigned: { status: 'open', assignment: 'unassigned' },
  // Ola 6 (snooze): `view=snoozed` = pospuestas VIGENTES (`snoozedUntil` en el
  // futuro). Eje PROPIO, sin `status`: son no-resueltas, caen naturalmente en
  // el bucket abierto del cinturón client-side (mismo criterio que `unattended`).
  snoozed: { view: 'snoozed' },
  resolved: { status: 'resolved' },
};

/**
 * Empty state POR VISTA (la lista no conoce la vista activa — la page se lo
 * pasa a `ConversationList` vía `emptyMessage`): "Mi bandeja" vacía con
 * "No hay conversaciones abiertas." sería mentira si hay abiertas de otros.
 */
export const INBOX_VIEW_EMPTY_MESSAGES: Record<InboxViewId, string> = {
  mine: 'No hay conversaciones en tu bandeja.',
  unattended: 'No hay conversaciones sin atender.',
  mentioned: 'No hay conversaciones donde te hayan mencionado.',
  all: 'No hay conversaciones abiertas.',
  unassigned: 'No hay conversaciones sin asignar.',
  snoozed: 'No hay conversaciones pospuestas.',
  resolved: 'No hay conversaciones resueltas.',
};

/** Tope visual del badge — arriba de esto se pinta "99+" (el aria-label conserva el número real). */
const VIEW_COUNT_CAP = 99;

/**
 * Formato VISUAL del contador del badge. `undefined` (counts caídos/cargando)
 * → `null`, el badge no se pinta — el sub-menú degrada a "sin números", nunca
 * roto. El CERO SÍ se muestra: es información en un dashboard de vistas
 * ("Sin atender: 0" = inbox al día), no un dato faltante.
 */
export function formatViewCount(count: number | undefined): string | null {
  if (count === undefined) return null;
  return count > VIEW_COUNT_CAP ? `${VIEW_COUNT_CAP}+` : String(count);
}

/**
 * Nombre accesible del item de vista ("Sin atender, 3 conversaciones").
 * Usa el número REAL aunque el badge visual muestre "99+" — el lector de
 * pantalla no tiene el problema de espacio que motivó el cap visual.
 */
export function viewCountAriaLabel(label: string, count: number | undefined): string {
  if (count === undefined) return label;
  return `${label}, ${count} ${count === 1 ? 'conversación' : 'conversaciones'}`;
}
