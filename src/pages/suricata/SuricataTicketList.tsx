import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select } from '@/components/molecules/Select/Select';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { formatDateTimeShort } from '@/utils/formatDate';
import { useSuricataTickets, useSuricataAreas } from './hooks/useSuricataTickets';
import type { SuricataBotState, SuricataTicketListItemDto } from './api/suricataClient';
import styles from './SuricataTicketList.module.css';

/**
 * suricata-tickets-mirror (Fase G, task G.3, spec `suricata-tickets-ui` UI-1,
 * design D13) — filterable ticket list. Rows show the wire-contract fields
 * actually exposed by `GET /api/suricata/tickets`
 * (`SuricataTicketListItemDto`): the list has NO customer name (that only
 * exists on the detail DTO, Fase H) — the row's primary label is the ticket
 * `subject`, with `externalId` as a secondary identifier.
 *
 * Filters use the repo's own `Select` (WAI-ARIA combobox) — never a native
 * `<select>` facing the operator (hard repo rule).
 */

// The BE contract carries `status`/`priority` as free strings mirrored from
// Suricata (no catalog endpoint for either) — these options mirror the
// values the approved mockup shows. `areaId` is catalog-driven via
// `GET /api/suricata/areas`; `botState` is the closed BE enum.
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'Open', label: 'Open' },
  { value: 'Progreso', label: 'Progreso' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const BOT_STATE_OPTIONS: Array<{ value: SuricataBotState | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'sin_analizar', label: 'Sin revisar' },
  { value: 'resuelto_bot', label: 'Resuelto solo' },
  { value: 'requiere_humano', label: 'Necesitó humano' },
  { value: 'stale', label: 'Desactualizado' },
];

const BOT_STATE_LABEL: Record<SuricataBotState, string> = {
  sin_analizar: 'Bot: sin revisar',
  resuelto_bot: 'Bot: resuelto solo',
  requiere_humano: 'Bot: necesitó humano',
  stale: 'Bot: desactualizado',
};

interface Filters {
  status: string;
  priority: string;
  areaId: string;
  botState: SuricataBotState | '';
}

const EMPTY_FILTERS: Filters = { status: '', priority: '', areaId: '', botState: '' };

/**
 * The BE caps every page at `DEFAULT_LIMIT` (20) when the query omits
 * `limit`. Riding that default while rendering only `data.data` and ignoring
 * `data.total` made the list LOOK complete at 20 tickets while silently hiding
 * the rest — so the page size is now explicit and the operator always sees
 * how many of the total are on screen.
 */
const PAGE_SIZE = 25;

function TicketRow({ ticket, onOpen }: { ticket: SuricataTicketListItemDto; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" className={styles.row} onClick={() => onOpen(ticket.id)}>
        <div className={styles.rowTop}>
          <span className={styles.subject}>{ticket.customerName ?? ticket.subject}</span>
          <span className={styles.externalId}>#{ticket.externalId}</span>
        </div>
        {ticket.customerName && <span className={styles.externalId}>{ticket.subject}</span>}
        <div className={styles.meta}>
          <span className={`${styles.badge} ${styles.badgeStatus}`}>{ticket.status}</span>
          {ticket.areaName && <span className={`${styles.badge} ${styles.badgeArea}`}>{ticket.areaName}</span>}
          {/* `.badgeBot` is NOT decoration: the per-state colour rules are
              written as `.badgeBot[data-bot=...]`, so dropping it (as this row
              used to) renders all four bot states identically colourless.
              Same pairing the detail header uses. */}
          <span className={`${styles.badge} ${styles.badgeBot}`} data-bot={ticket.botState}>
            {BOT_STATE_LABEL[ticket.botState]}
          </span>
        </div>
        <span className={styles.assignee}>
          {ticket.assigneeName ? `Asignado: ${ticket.assigneeName}` : 'Sin asignar'}
        </span>
        {ticket.lastMessageAt && (
          <span className={styles.externalId}>Último mensaje: {formatDateTimeShort(ticket.lastMessageAt)}</span>
        )}
      </button>
    </li>
  );
}

export function SuricataTicketList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const { data: areas = [] } = useSuricataAreas();
  const { data, isLoading, isError, refetch } = useSuricataTickets({
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    areaId: filters.areaId || undefined,
    botState: filters.botState || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  // Any filter change restarts at page 1: staying on page 3 while the result
  // set shrinks asks the BE for a page that may not exist under the new filter
  // and shows an empty list that looks like "no matches".
  function updateFilters(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  // Counting off the SERVER-reported page/limit (not the local `page` state)
  // keeps the label honest while a page change is still in flight.
  const serverPage = data?.page ?? page;
  const serverLimit = data?.limit ?? PAGE_SIZE;
  const total = data?.total ?? 0;
  const rangeStart = (serverPage - 1) * serverLimit + 1;
  const rangeEnd = rangeStart + (data?.data.length ?? 0) - 1;
  const totalPages = serverLimit > 0 ? Math.ceil(total / serverLimit) : 1;

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <Select
            label="Estado"
            value={filters.status}
            onChange={(v) => updateFilters({ status: v })}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className={styles.filterField}>
          <Select
            label="Prioridad"
            value={filters.priority}
            onChange={(v) => updateFilters({ priority: v })}
            options={PRIORITY_OPTIONS}
          />
        </div>
        <div className={styles.filterField}>
          <Select
            label="Área"
            value={filters.areaId}
            onChange={(v) => updateFilters({ areaId: v })}
            options={[{ value: '', label: 'Todas' }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </div>
        <div className={styles.filterField}>
          <Select
            label="Bot"
            value={filters.botState}
            onChange={(v) => updateFilters({ botState: v as SuricataBotState | '' })}
            options={BOT_STATE_OPTIONS}
          />
        </div>
      </div>

      {isLoading && (
        <div className={styles.skeleton} role="status" aria-label="Cargando tickets">
          Cargando tickets…
        </div>
      )}

      {!isLoading && isError && (
        <div className={styles.errorBox} role="alert">
          <span>No pudimos cargar los tickets.</span>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && data && data.data.length === 0 && (
        <div className={styles.empty}>
          {hasActiveFilters ? (
            <>
              <p>Ningún ticket coincide con los filtros.</p>
              <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                Limpiar filtros
              </button>
            </>
          ) : (
            <p>No hay tickets sincronizados todavía.</p>
          )}
        </div>
      )}

      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className={styles.resultMeta} role="status" aria-live="polite">
            Mostrando {rangeStart}–{rangeEnd} de {total.toLocaleString('es-AR')} tickets
          </div>

          <ul className={styles.list} aria-label="Tickets Suricata">
            {data.data.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} onOpen={(id) => navigate(`/admin/suricata-tickets/${id}`)} />
            ))}
          </ul>

          {/* `Pagination` self-hides at a single page — the count above stays
              regardless, so "20 rows" is never mistaken for "20 tickets". */}
          <div className={styles.pagerRow}>
            <Pagination currentPage={serverPage} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
