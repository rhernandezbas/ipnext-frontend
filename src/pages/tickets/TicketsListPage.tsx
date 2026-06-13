import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { useTicketList, useCreateTicket } from '../../hooks/useTickets';
import { useTicketStatuses } from '../../hooks/useTicketStatuses';
import { Can } from '@/components/auth/Can';
import { ColumnSelector, type ColumnDef } from '@/pages/scheduling/SchedulingTasksPage/components/ColumnSelector';
import { TicketFilterBar } from './TicketsListPage/components/TicketFilterBar';
import { TicketsTableView } from './TicketsListPage/components/TicketsTableView';
import { CreateTicketModal } from './TicketsListPage/components/CreateTicketModal';
import { useTicketsFilterUrl } from './TicketsListPage/hooks/useTicketsFilterUrl';
import { useVisibleColumns } from './TicketsListPage/hooks/useVisibleColumns';
import type { CreateTicketData } from '@/types/ticket';
import styles from './TicketsListPage.module.css';
import tabStyles from './TicketsListPage.tabs.module.css';

// Full column catalog — preserves ALL of origin's columns (type/reporter
// included) so column visibility can re-expose them.
export const ALL_TICKET_COLUMNS: ColumnDef[] = [
  { key: 'id',             label: 'ID' },
  // #75 — Área a la posición 2 (tras ID) en el orden DEFAULT. key === BE field
  // y === ALL_COLUMNS del render (leccion #48). El orden guardado del usuario
  // NO se pisa: useVisibleColumns respeta el localStorage y sólo cambia el default.
  { key: 'areaName',       label: 'Área' }, // #69 — pill con color del catalogo
  { key: 'timer',          label: 'Timer' }, // #79 — minutos desde createdAt con color por umbrales SLA (pos 3)
  { key: 'subject',        label: 'Tema' },
  // #78 — la columna 'type' se eliminó: el BE (entity Ticket, TicketDto, modelo
  // Prisma) nunca tuvo el campo, así que renderizaba vacío para todas las filas.
  { key: 'customerName',   label: 'Cliente/Cliente Potencial' },
  { key: 'reporterName',   label: 'Reporter' }, // #48 fix-wave — the BE field is reporterName
  { key: 'priority',       label: 'Prioridad' },
  { key: 'status',         label: 'Estado' },
  { key: 'assigneeName',   label: 'Asignado a' }, // #28 follow-up — the BE field is assigneeName
  { key: 'createdAt',      label: 'Creado de fecha y hora' },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_TICKET_COLUMNS.map(c => c.key);

// ── SVG Icons ──────────────────────────────────────────────────────────────────
function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

interface Props {
  /** When set (e.g. "closed" by TicketsArchivePage), the list is locked to that
   *  status and shows the archive title. Preserves origin's Archive page. */
  statusFilter?: string;
}

export default function TicketsListPage({ statusFilter }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filter, setFilter } = useTicketsFilterUrl();

  // ?create=1 → open the modal on mount, then clear the param (replace, no
  // history entry). Wires the Dashboard's "Nuevo Ticket" CTA into the modal.
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreateOpen(true);
      setSearchParams(p => { p.delete('create'); return p; }, { replace: true });
    }
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Status has a SINGLE source of truth: filter.status (URL-backed). The tabs and
  // the filter-bar "Estado" select both read/write it, so they never desync.
  const [page, setPage] = useState(1);

  const createTicket = useCreateTicket();
  const { data: catalogStatuses = [], isLoading: statusesLoading } = useTicketStatuses();

  // Column visibility (localStorage-backed, key: tickets-visible-columns).
  const { visible: visibleColumns, toggle: toggleColumn, reorder: reorderColumns, reset: resetColumns } =
    useVisibleColumns(DEFAULT_VISIBLE_COLUMNS);

  // Archive page locks the status; otherwise tab/URL drive it.
  const effectiveStatus = statusFilter ?? filter.status ?? '';

  const { data, isLoading, refetch } = useTicketList({
    page,
    limit: 25,
    search: filter.q || undefined,
    status: effectiveStatus || undefined,
    priority: filter.priority || undefined,
    customerId: filter.customerId || undefined,
    assignedTo: filter.assignedTo || undefined, // #25
    from: filter.from || undefined,
    to: filter.to || undefined,
    areaId: filter.areaId || undefined, // #49
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  function handleTabClick(statusName: string) {
    setPage(1);
    setFilter({ status: statusName || undefined });
  }

  async function handleCreate(ticketData: CreateTicketData) {
    await createTicket.mutateAsync(ticketData);
    setCreateOpen(false);
  }

  // Active-filter detection drives the differentiated empty state. The status
  // chip is excluded on the Archive page (it's locked, not a user choice).
  const filterKeys = ['priority', 'assignedTo', 'q', 'customerId', 'from', 'to', 'areaId'] as const;
  const hasActiveFilters =
    (!statusFilter && !!filter.status) ||
    filterKeys.some(k => filter[k] != null && filter[k] !== '');

  function clearFilters() {
    setPage(1);
    setFilter({
      ...(statusFilter ? {} : { status: undefined }),
      priority: undefined, assignedTo: undefined, q: undefined,
      customerId: undefined, from: undefined, to: undefined,
      areaId: undefined,
    });
  }

  const isArchive = statusFilter === 'closed';

  return (
    <div className={styles.page}>
      {/* Prominense header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Soporte /</span>
          <h1 className={styles.title}>{isArchive ? 'Archivo de Tickets' : 'Lista de Tickets'}</h1>
        </div>
        <div className={styles.headerRight}>
          <ColumnSelector
            columns={ALL_TICKET_COLUMNS}
            visible={visibleColumns}
            onToggle={toggleColumn}
            onReorder={reorderColumns}
            onReset={resetColumns}
          />
          <button className={styles.btnIcon} title="Recargar" onClick={() => void refetch()} aria-label="Recargar">
            <IconRefresh />
          </button>
          <Can permission="tickets.write">
            <button className={styles.btnPrimary} onClick={() => setCreateOpen(true)}>
              <IconPlus /> Crear ticket
            </button>
          </Can>
        </div>
      </div>

      {/* Catalog-driven status tabs (origin behavior preserved). Hidden on the
          Archive page, which is locked to a single status. */}
      {!isArchive && (
        <div className={tabStyles.tabs}>
          <button
            className={`${tabStyles.tab} ${effectiveStatus === '' ? tabStyles.active : ''}`}
            onClick={() => handleTabClick('')}
          >
            Todos
          </button>
          {!statusesLoading && catalogStatuses.map(s => (
            <button
              key={s.id}
              className={`${tabStyles.tab} ${effectiveStatus === s.name ? tabStyles.active : ''}`}
              style={effectiveStatus === s.name ? { borderBottomColor: s.color } : undefined}
              onClick={() => handleTabClick(s.name)}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: s.color,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Filtros — siempre visible, inline, espejando el TaskFilterBar (#87).
          Variante horizontal: controles en una fila, chips activos debajo. */}
      <TicketFilterBar
        filter={filter}
        onFilterChange={p => { setFilter(p); setPage(1); }}
        variant="horizontal"
        showChips
      />

      {/* Tabla + acciones masivas + estados vacíos, espejando SchedulingTasksPage. */}
      <div className={styles.tableSection}>
        <TicketsTableView
          tickets={data?.data ?? []}
          loading={isLoading}
          visibleColumnKeys={visibleColumns}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
        {(data?.data?.length ?? 0) > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      {/* CreateTicketModal (?create=1 or header button) */}
      {createOpen && (
        <CreateTicketModal
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
          loading={createTicket.isPending}
        />
      )}
    </div>
  );
}
