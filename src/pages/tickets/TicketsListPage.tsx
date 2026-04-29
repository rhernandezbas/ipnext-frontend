import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { useTicketList, useDeleteTicket } from '../../hooks/useTickets';
import { Ticket } from '../../types/ticket';
import styles from './TicketsListPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'open', label: 'Abierto' },
  { value: 'pending', label: 'En progreso' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
];

const PRIORITY_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

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

interface Props { statusFilter?: string; }

export default function TicketsListPage({ statusFilter }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(statusFilter ?? '');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);

  const deleteTicket = useDeleteTicket();

  const { data, isLoading } = useTicketList({
    page,
    limit: 25,
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  const filters = [
    { key: 'status', label: 'Estado', options: STATUS_FILTERS },
    { key: 'priority', label: 'Prioridad', options: PRIORITY_FILTERS },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        {statusFilter === 'closed' ? 'Archivo de Tickets' : 'Lista de Tickets'}
      </h1>
      <FilterBar
        onSearch={(v) => { setSearch(v); setPage(1); }}
        filters={filters}
        onFilterChange={(key, v) => {
          if (key === 'status') setStatus(v);
          else if (key === 'priority') setPriority(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por asunto o cliente..."
      />
      <DataTable<Ticket>
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No hay tickets."
        actions={[{
          label: 'Eliminar',
          onClick: (row) => {
            if (window.confirm('¿Eliminar este ticket? Esta acción no se puede deshacer.')) {
              deleteTicket.mutate(String(row.id));
            }
          },
        }]}
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
