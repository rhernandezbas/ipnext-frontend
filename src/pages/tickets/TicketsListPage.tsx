import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { useTicketList, useDeleteTicket, useCreateTicket } from '../../hooks/useTickets';
import { useTicketStatuses } from '../../hooks/useTicketStatuses';
import { Ticket } from '../../types/ticket';
import { useCan } from '../../hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { Can } from '@/components/auth/Can';
import { ColumnSelector, type ColumnDef } from '@/pages/scheduling/SchedulingTasksPage/components/ColumnSelector';
import { TicketFilterBar } from './TicketsListPage/components/TicketFilterBar';
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
  { key: 'subject',        label: 'Tema' },
  { key: 'customerName',   label: 'Cliente/Cliente Potencial' },
  { key: 'type',           label: 'Tipo' },
  { key: 'reporter',       label: 'Reporter' },
  { key: 'priority',       label: 'Prioridad' },
  { key: 'status',         label: 'Estado' },
  { key: 'assignedToName', label: 'Asignado a' },
  { key: 'createdAt',      label: 'Creado de fecha y hora' },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_TICKET_COLUMNS.map(c => c.key);

const COLUMNS: Array<{ label: string; key: keyof Ticket | string; sortable?: boolean; render?: (row: Ticket) => React.ReactNode }> = [
  { label: 'ID', key: 'id' },
  {
    label: 'Tema',
    key: 'subject',
    sortable: true,
    render: (row: Ticket) => (
      <Link to={`/admin/tickets/${row.id}`} style={{ color: 'var(--color-primary, #2563eb)', textDecoration: 'none' }}>
        {row.subject}
      </Link>
    ),
  },
  { label: 'Cliente/Cliente Potencial', key: 'customerName', sortable: true },
  { label: 'Tipo', key: 'type' },
  { label: 'Reporter', key: 'reporter' },
  { label: 'Prioridad', key: 'priority', sortable: true },
  { label: 'Estado', key: 'status', sortable: true },
  { label: 'Asignado a', key: 'assignedToName' },
  { label: 'Creado de fecha y hora', key: 'createdAt', sortable: true },
];

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

  // Status tab state. Seeded from statusFilter (Archive locks to "closed") or
  // the URL filter; tab clicks update both local state and the URL filter.
  const [tabStatus, setTabStatus] = useState(statusFilter ?? filter.status ?? '');
  const [page, setPage] = useState(1);

  const confirm = useConfirm();
  const deleteTicket = useDeleteTicket();
  const createTicket = useCreateTicket();
  const canDeleteTicket = useCan('tickets.delete');
  const { data: catalogStatuses = [], isLoading: statusesLoading } = useTicketStatuses();

  // Column visibility (localStorage-backed, key: tickets-visible-columns).
  const { visible: visibleColumns, toggle: toggleColumn, reorder: reorderColumns, reset: resetColumns } =
    useVisibleColumns(DEFAULT_VISIBLE_COLUMNS);

  // Archive page locks the status; otherwise tab/URL drive it.
  const effectiveStatus = statusFilter ?? tabStatus ?? filter.status ?? '';

  const { data, isLoading, refetch } = useTicketList({
    page,
    limit: 25,
    search: filter.q || undefined,
    status: effectiveStatus || undefined,
    priority: filter.priority || undefined,
    customerId: filter.customerId || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  function handleTabClick(statusName: string) {
    setTabStatus(statusName);
    setPage(1);
    setFilter({ status: statusName || undefined });
  }

  async function handleCreate(ticketData: CreateTicketData) {
    await createTicket.mutateAsync(ticketData);
    setCreateOpen(false);
  }

  const visibleTableColumns = COLUMNS.filter(c => visibleColumns.includes(c.key as string));

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
            className={`${tabStyles.tab} ${tabStatus === '' ? tabStyles.active : ''}`}
            onClick={() => handleTabClick('')}
          >
            Todos
          </button>
          {!statusesLoading && catalogStatuses.map(s => (
            <button
              key={s.id}
              className={`${tabStyles.tab} ${tabStatus === s.name ? tabStyles.active : ''}`}
              style={tabStatus === s.name ? { borderBottomColor: s.color } : undefined}
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

      {/* Right-side Prominense filter bar */}
      <TicketFilterBar filter={filter} onFilterChange={p => { setFilter(p); setPage(1); }} />

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.tableSection}>
          <DataTable<Ticket>
            columns={visibleTableColumns}
            data={data?.data ?? []}
            loading={isLoading}
            emptyMessage="No hay tickets."
            actions={canDeleteTicket ? [{
              label: 'Eliminar',
              onClick: async (row) => {
                if (await confirm({ message: '¿Eliminar este ticket? Esta acción no se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' })) {
                  deleteTicket.mutate(String(row.id));
                }
              },
            }] : []}
          />
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
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
