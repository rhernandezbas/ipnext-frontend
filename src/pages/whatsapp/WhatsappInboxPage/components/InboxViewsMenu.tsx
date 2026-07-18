import { INBOX_VIEWS, formatViewCount, viewCountAriaLabel } from './inboxViews';
import type { InboxViewId } from './inboxViews';
import type { WhatsappInboxViewCounts } from '@/types/whatsapp';
import styles from './InboxViewsMenu.module.css';

interface InboxViewsMenuProps {
  /** Vista activa — la page es el único dueño del estado (100% controlado). */
  active: InboxViewId;
  /**
   * Contadores de `useInboxViewCounts` — `undefined` (cargando / GET caído
   * por 403 sin `messaging:read` / 503) degrada a "sin números": el sub-menú
   * sigue 100% operable, solo no pinta badges. El CERO sí se pinta (es
   * información — "Sin atender: 0" = inbox al día).
   */
  counts?: WhatsappInboxViewCounts;
  onSelect: (view: InboxViewId) => void;
}

interface IconProps {
  className?: string;
}

/**
 * Íconos SVG inline por vista (design-system rule del repo: nunca emoji) —
 * mismo estilo `stroke=currentColor` + `aria-hidden` que `statusIcons.tsx`/
 * `mediaIcons.tsx` (el nombre accesible vive en el `aria-label` del botón).
 * En el modo colapsado (rail de íconos, breakpoints ≤1200px del CSS module)
 * son la ÚNICA cara visible de cada vista.
 */
function IconInboxTray({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconMessageWaiting({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconLayers({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconUserX({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  );
}

function IconCheckCircle({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.27" />
    </svg>
  );
}

/** Ola 6 (menciones) — arroba, la seña universal de "te mencionaron". */
function IconAtSign({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

/** Ola 6 (snooze) — reloj, "pospuesto para más tarde". */
function IconClock({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

const VIEW_ICONS: Record<InboxViewId, (props: IconProps) => React.JSX.Element> = {
  mine: IconInboxTray,
  unattended: IconMessageWaiting,
  mentioned: IconAtSign,
  all: IconLayers,
  unassigned: IconUserX,
  snoozed: IconClock,
  resolved: IconCheckCircle,
};

/**
 * InboxViewsMenu — sub-menú lateral de VISTAS del inbox estilo Chatwoot
 * (inbox-views Ola 1): Mi bandeja / Sin atender / Todas / Sin asignar /
 * Resueltas, cada una con su contador del endpoint de counts. Es la ÚNICA
 * fuente de status/assignment/view del listado (reemplaza a los viejos
 * `ConversationStatusFilter`/`ConversationAssignmentFilter` de la barra de la
 * lista); el filtro de campaña y la búsqueda quedan arriba de la lista.
 *
 * Presentacional 100% controlado — la page orquesta `useInboxViewCounts` y
 * traduce `onSelect` al preset de query (`INBOX_VIEW_PRESETS`).
 *
 * Botones (no radios, a diferencia de los filtros viejos): las vistas son
 * NAVEGACIÓN dentro del inbox (paridad sidebar Chatwoot), no un eje de un
 * form — de ahí `<nav>` + `aria-current` en la activa (patrón WAI-ARIA para
 * "current item de una navegación"), no `checked`.
 *
 * El badge visual es `aria-hidden`: el número ya viaja en el accname del
 * botón ("Sin atender, 7 conversaciones", `viewCountAriaLabel`) — sin esto el
 * lector diría el número dos veces. El "99+" es SOLO visual (el accname
 * conserva el número real).
 */
export function InboxViewsMenu({ active, counts, onSelect }: InboxViewsMenuProps) {
  return (
    <nav className={styles.menu} aria-label="Vistas del inbox">
      <ul className={styles.list} role="list">
        {INBOX_VIEWS.map((view) => {
          const count = counts?.[view.id];
          const visualCount = formatViewCount(count);
          const isActive = view.id === active;
          const Icon = VIEW_ICONS[view.id];
          return (
            <li key={view.id}>
              <button
                type="button"
                className={styles.item}
                aria-current={isActive ? 'page' : undefined}
                aria-label={viewCountAriaLabel(view.label, count)}
                title={view.label}
                onClick={() => onSelect(view.id)}
              >
                <Icon className={styles.icon} />
                <span className={styles.label}>{view.label}</span>
                {visualCount !== null && (
                  <span className={styles.count} aria-hidden="true">
                    {visualCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
