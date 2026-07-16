import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/atoms/Input/Input';
import { ConversationListItem } from './ConversationListItem';
import { ConversationStatusFilter } from './ConversationStatusFilter';
import type { ConversationStatusFilterValue } from './ConversationStatusFilter';
import { ConversationAssignmentFilter } from './ConversationAssignmentFilter';
import { ConversationCampaignFilter } from './ConversationCampaignFilter';
import { Skeleton } from './Skeleton';
import type { ConversationAssignment, WhatsappCampaignTag, WhatsappConversationListItem } from '@/types/whatsapp';
import styles from './ConversationList.module.css';

interface ConversationListProps {
  conversations: WhatsappConversationListItem[];
  isLoading: boolean;
  isError?: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * inbox-resolve (TAB-1/TAB-4, design.md D5) — tabs de ciclo de vida
   * Abiertas/Resueltas, SERVER-SIDE (mismo criterio que `assignment`:
   * `WhatsappInboxPage` orquesta `useWhatsappConversations` con este valor
   * en el `query`). Default `'open'` para no romper call sites/tests previos
   * a esta tanda que no lo pasan — coincide con el default VISUAL de la page
   * (design D5: estado inicial `{status:'open'}`).
   */
  status?: ConversationStatusFilterValue;
  onStatusChange?: (next: ConversationStatusFilterValue) => void;
  /**
   * messaging-inbox-assignment F1.5-C2 — filtro de asignación SERVER-SIDE
   * (`WhatsappInboxPage` orquesta `useWhatsappConversations` con este valor en
   * el `query`, design contrato). Opcionales con default 'all'/no-op para no
   * romper los call sites/tests previos a esta tanda (que no lo pasan).
   */
  assignment?: ConversationAssignment;
  onAssignmentChange?: (next: ConversationAssignment) => void;
  /**
   * messaging-bulk-inbox Change 2 — filtro de campaña SERVER-SIDE (mismo molde
   * que `assignment`: `WhatsappInboxPage` orquesta `useWhatsappConversations`
   * con `campaignId` en el `query`). El catálogo (`campaigns`) viene de
   * `useCampaigns`, gateado por `messaging.bulk`; cuando está vacío el filtro
   * ni se monta (nada útil que filtrar). Opcionales con default para no romper
   * los call sites/tests previos a esta tanda.
   */
  campaigns?: WhatsappCampaignTag[];
  campaignId?: string;
  onCampaignChange?: (next: string | undefined) => void;
}

const SKELETON_ROWS = 5;

function matchesSearch(conv: WhatsappConversationListItem, term: string): boolean {
  if (!term) return true;
  const haystack = `${conv.contactName ?? ''} ${conv.contactPhone ?? ''} ${conv.preview ?? ''}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/**
 * inbox-resolve (TAB-2, design.md D2/D7) — cinturón CLIENT-SIDE sobre el
 * filtro SERVER-SIDE (que sigue siendo la fuente de verdad en cada refetch):
 * excluye al instante las filas cuyo `status` no matcha el bucket de la tab
 * activa, sin esperar red. Bucket, NO match exacto para 'open' (MISMO
 * criterio que el BE, D2): 'pending'/'snoozed' cuentan como "no resuelta".
 * Esto es lo que habilita que el patch OPTIMISTA de `useSetConversationStatus`
 * (que solo cambia `status` en el cache de la lista) saque/meta la fila del
 * bucket activo apenas corre `onMutate`, antes de que el POST resuelva.
 */
function matchesStatusBucket(conv: WhatsappConversationListItem, status: ConversationStatusFilterValue): boolean {
  return status === 'resolved' ? conv.status === 'resolved' : conv.status !== 'resolved';
}

function timeValue(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * MOTION-1 (inbox-resolve, design.md D7) — 220ms cae en el rango 200-250ms
 * de la spec; SINCRONIZADO a mano con `waConvItemExit` en
 * `ConversationListItem.module.css` (ambos números deben moverse juntos).
 */
const EXIT_DURATION_MS = 220;

/**
 * MOTION-1 — detección JS-side de `prefers-reduced-motion` (MISMO patrón que
 * `MessageBubble.tsx`, bug #13 post-review-adversarial): jsdom NO implementa
 * `matchMedia` (queda `undefined`) — el guard de tipo/try-catch evita romper
 * en ese entorno. Acá decide la DURACIÓN del timer JS que remueve el ghost
 * (0 = instantáneo); la regla `@media` en el CSS module es la 2da capa
 * (belt-and-suspenders, mismo criterio que `ConversationAssignmentFilter.
 * module.css`) para cuando el timer y el frame de paint compiten.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * ConversationList — panel izquierdo del inbox (messaging-inbox F1, design
 * §1/§2, LIST-1). Presentacional: recibe la data ya fetcheada por
 * `WhatsappInboxPage` (que orquesta `useWhatsappConversations`, design §1) vía
 * props — acá solo se resuelven dos concerns puramente de UI que NO viven en
 * el contrato del BE (design §3): orden por `lastMessageAt` desc (el DTO no
 * garantiza orden) y el filtro de búsqueda client-side (sin `search` param en
 * `WhatsappPaginatedQuery`).
 */
export function ConversationList({
  conversations,
  isLoading,
  isError = false,
  selectedId,
  onSelect,
  status = 'open',
  onStatusChange = () => {},
  assignment = 'all',
  onAssignmentChange = () => {},
  campaigns = [],
  campaignId,
  onCampaignChange = () => {},
}: ConversationListProps) {
  const [search, setSearch] = useState('');

  // TAB-2 — cinturón de bucket ANTES de la búsqueda: una fila que salió del
  // bucket (resolver/reabrir optimista) desaparece sin importar el término
  // de búsqueda activo.
  const bucketed = useMemo(
    () => conversations.filter((c) => matchesStatusBucket(c, status)),
    [conversations, status],
  );

  const visible = useMemo(
    () =>
      bucketed
        .filter((c) => matchesSearch(c, search))
        .slice()
        .sort((a, b) => timeValue(b.lastMessageAt) - timeValue(a.lastMessageAt)),
    [bucketed, search],
  );

  /**
   * MOTION-1 (design.md D7) — una fila que sale del bucket activo (resolver/
   * reabrir OPTIMISTA) no se remueve al instante: queda montada como "ghost"
   * con `data-exiting` mientras corre la animación de colapso (CSS module),
   * y recién se saca del DOM cuando el timer termina. `prefersReducedMotion()`
   * pone esa duración en 0 → remoción inmediata sin animación.
   *
   * `key={conv.id}` (abajo, en el `.map`) queda INTACTO — regla del repo
   * (memoria `inbox-key-por-conversacion`): el ghost es el MISMO objeto
   * conversation (snapshoteado en `ghostsRef` al momento de salir del
   * bucket), nunca un objeto sintético con un id distinto.
   */
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const ghostsRef = useRef<Map<string, WhatsappConversationListItem>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevBucketedIdsRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<ConversationStatusFilterValue>(status);

  useEffect(() => {
    const currentIds = new Set(bucketed.map((c) => c.id));

    // Cambiar de TAB (`status`) es un swap INSTANTÁNEO de la lista completa
    // — NO es MOTION-1 (esa spec es solo para el bucket-mismatch de UNA
    // conversación por una acción del agente, mismo `status` de tab). Sin
    // este guard, cada fila que "deja" el bucket viejo al cambiar de tab
    // (que es CUALQUIER fila, por diseño) se animaría de salida — justo lo
    // que la spec NO pide.
    if (prevStatusRef.current !== status) {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      ghostsRef.current.clear();
      setExitingIds((prev) => (prev.size === 0 ? prev : new Set()));
      prevStatusRef.current = status;
      prevBucketedIdsRef.current = currentIds;
      return;
    }

    const prevIds = prevBucketedIdsRef.current;
    const stillExisting = new Map(conversations.map((c) => [c.id, c]));

    // Filas que SALIERON del bucket (MISMA tab): se vuelven "ghost" hasta
    // que la animación de salida termine (o 0ms bajo reduced-motion).
    prevIds.forEach((id) => {
      if (currentIds.has(id)) return; // sigue en el bucket, nada que animar
      if (!stillExisting.has(id)) return; // desapareció del todo (no solo de bucket) — nada que fantasmear
      if (timersRef.current.has(id)) return; // ya está saliendo

      ghostsRef.current.set(id, stillExisting.get(id)!);

      const duration = prefersReducedMotion() ? 0 : EXIT_DURATION_MS;
      const timer = setTimeout(() => {
        ghostsRef.current.delete(id);
        timersRef.current.delete(id);
        setExitingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, duration);
      timersRef.current.set(id, timer);
    });

    // Filas que VOLVIERON al bucket mientras estaban "saliendo" (rollback):
    // cancela el timer y el ghost — la fila real vuelve a ocupar su lugar,
    // sin timer colgado que la borre más tarde igual.
    timersRef.current.forEach((timer, id) => {
      if (!currentIds.has(id)) return;
      clearTimeout(timer);
      timersRef.current.delete(id);
      ghostsRef.current.delete(id);
    });

    // Bail out sin re-render si el set de exiting-ids no cambió realmente
    // (el efecto corre en CADA cambio de `bucketed`, incluidos los que no
    // tocan ningún ghost — evita un setState+render de más en ese caso).
    setExitingIds((prev) => {
      const nextIds = timersRef.current.keys();
      const next = new Set(nextIds);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
    prevBucketedIdsRef.current = currentIds;
  }, [bucketed, conversations, status]);

  // Limpieza al desmontar — no dejar timers colgados (mismo criterio que
  // `inboxToastTimer` en `WhatsappInboxPage`).
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  /**
   * LOW 1.1 (review adversarial, fix wave) — `visibleIds` es la fuente de
   * verdad SINCRÓNICA de "esta fila está genuinamente en el bucket activo
   * AHORA" (deriva de `visible`, que a su vez sale de `bucketed`/`search` vía
   * `useMemo` sobre las props del render actual — nunca queda un render
   * atrás). Antes, el prop `exiting` de cada fila salía directo de
   * `exitingIds.has(id)` (estado React) — cuando un id volvía al bucket
   * (rollback del patch optimista, o UNDO-1 reabriendo), `exitingIds` seguía
   * cargando ese id durante EL RENDER que la reincorpora (recién se limpia un
   * render después, en el `useEffect` de abajo) — ese frame intermedio pinta
   * la fila YA REAL con `data-exiting="true"` (dispara el keyframe de colapso
   * sobre un elemento que sigue siendo el mismo `<li>`, montado
   * continuamente) y el efecto lo corrige un instante después con un
   * snap-back abrupto (sin transición de vuelta — colapso ~30% + snap,
   * reportado en el review). Derivar `exiting` de `!visibleIds.has(id)` en
   * vez de `exitingIds.has(id)` elimina la dependencia de timing por
   * completo: una fila que YA está en `visible` (per las props actuales)
   * jamás se marca `exiting`, sin importar qué tan stale esté todavía
   * `exitingIds`/`ghostsRef` (esos siguen existiendo para la limpieza
   * asincrónica de bookkeeping — timers/refs — que ya no es responsable de
   * la corrección VISUAL).
   */
  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);

  const rows = useMemo(() => {
    const ghostItems = Array.from(exitingIds)
      .map((id) => ghostsRef.current.get(id))
      .filter((c): c is WhatsappConversationListItem => !!c && !visibleIds.has(c.id));
    return [...visible, ...ghostItems].sort((a, b) => timeValue(b.lastMessageAt) - timeValue(a.lastMessageAt));
  }, [visible, visibleIds, exitingIds]);

  return (
    <div className={styles.panel}>
      <div className={styles.filterWrapper}>
        <ConversationStatusFilter value={status} onChange={onStatusChange} />
        <ConversationAssignmentFilter value={assignment} onChange={onAssignmentChange} />
        {/* messaging-bulk-inbox Change 2 — solo se monta si hay campañas en el
            catálogo (sin ellas no hay nada que filtrar). */}
        {campaigns.length > 0 && (
          <ConversationCampaignFilter campaigns={campaigns} value={campaignId} onChange={onCampaignChange} />
        )}
      </div>

      <div className={styles.searchWrapper}>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar conversaciones"
        />
      </div>

      {isLoading && (
        <div className={styles.skeletonList}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton circle width={36} height={36} />
              <div className={styles.skeletonLines}>
                <Skeleton width="60%" height={12} />
                <Skeleton width="90%" height={10} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <p className={styles.errorState} role="alert">
          No se pudieron cargar las conversaciones.
        </p>
      )}

      {/* TAB-4 — empty state POR BUCKET (`rows`, que incluye ghosts todavía
          animando su salida — no `conversations` crudo): "Given todas
          resueltas / tab Abiertas activa" debe mostrar "No hay conversaciones
          abiertas." aunque `conversations` traiga filas (todas resueltas), y
          NO debe mostrarse mientras la última fila resuelta todavía está
          colapsando (MOTION-1) — recién cuando `rows` queda en 0. */}
      {!isLoading && !isError && rows.length === 0 && (
        <p className={styles.emptyState}>
          {status === 'resolved' ? 'No hay conversaciones resueltas.' : 'No hay conversaciones abiertas.'}
        </p>
      )}

      {/* LOW 4.2 (review adversarial, fix wave) — antes esta condición chequeaba
          `visible.length === 0`: si la búsqueda filtraba todo pero había un
          ghost MOTION-1 todavía animando su salida, `rows` seguía teniendo ese
          ghost (bypassea el filtro de búsqueda a propósito — ver comentario de
          `rows` de abajo) y el bloque de acá abajo (`rows.length > 0`) TAMBIÉN
          renderizaba, mostrando el empty-state de búsqueda superpuesto con la
          fila fantasma. Chequear `rows.length === 0` (que incluye ghosts)
          hace que este mensaje y la lista sean mutuamente excluyentes. */}
      {!isLoading && !isError && bucketed.length > 0 && rows.length === 0 && (
        <p className={styles.emptyState}>No se encontraron conversaciones para “{search}”.</p>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <ul className={styles.list} role="list" aria-label="Conversaciones">
          {rows.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              selected={conv.id === selectedId}
              onClick={() => onSelect(conv.id)}
              exiting={!visibleIds.has(conv.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
