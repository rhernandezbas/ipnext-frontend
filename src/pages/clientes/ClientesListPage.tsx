import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { StatusBadge } from '../../components/atoms/StatusBadge/StatusBadge';
import { useClientList, useToggleClientStatus } from '../../hooks/useCustomers';
import { useGestionRealSyncStatus } from '../../hooks/useGestionRealSync';
import { GestionRealSyncBadge } from '../../components/gestionReal/GestionRealSyncBadge';
import type { CustomerSummary } from '../../types/customer';
import { ClientStatsCards } from './ClientStatsCards';
import styles from './ClientesListPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'new', label: 'Nuevo' },
];

function toStatusBadge(status: CustomerSummary['status']): 'active' | 'late' | 'blocked' | 'inactive' {
  if (status === 'new') return 'inactive';
  return status;
}

interface Column {
  label: string;
  key: keyof CustomerSummary | string;
  sortable?: boolean;
  render?: (row: CustomerSummary) => ReactNode;
}

function getColumns(): Column[] {
  return [
    {
      label: 'Estado',
      key: 'status',
      sortable: false,
      render: (row: CustomerSummary) => <StatusBadge status={toStatusBadge(row.status)} />,
    },
    {
      label: 'ID',
      key: 'id',
      sortable: false,
      // Show the Gestión Real business id when this client comes from the mirror;
      // fall back to the internal id for any non-GR rows.
      render: (row: CustomerSummary) => <>{row.grClienteId ?? row.id}</>,
    },
    {
      label: 'Nombre completo',
      key: 'name',
      sortable: true,
      render: (row: CustomerSummary) => (
        <Link to={`/admin/customers/view/${row.id}`} className={styles.customerLink}>
          {row.name}
        </Link>
      ),
    },
    { label: 'Número de teléfono', key: 'phone', sortable: false },
    { label: 'Tarifas de Internet', key: 'tariffPlan', sortable: false },
    { label: 'Rangos IP', key: 'ipRanges', sortable: false },
    { label: 'Access devices', key: 'accessDevices', sortable: false },
  ];
}

function exportToCSV(rows: CustomerSummary[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const csv = [headers, ...rows.map((r) => Object.values(r).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Tab bar removed — the page now lists all customers; "Clientes online" and
// "GPON Online" subviews were deprecated per user request 2026-05-22.

export default function ClientesListPage() {
  const navigate = useNavigate();
  const toggleStatus = useToggleClientStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (status) params['status'] = status;
    if (page > 1) params['page'] = String(page);
    setSearchParams(params, { replace: true });
  }, [search, status, page, setSearchParams]);

  const { data, isLoading } = useClientList({
    page,
    limit: 25,
    search: search || undefined,
    status: status || undefined,
  });
  const grSync = useGestionRealSyncStatus();

  const totalPages = data ? data.totalPages : 1;

  const actions = [
    {
      label: 'Ver detalle',
      onClick: (row: CustomerSummary) => navigate(`/admin/customers/view/${row.id}`),
    },
    {
      label: 'Editar',
      onClick: (row: CustomerSummary) => navigate(`/admin/customers/view/${row.id}/edit`),
    },
    {
      label: 'Bloquear/Desbloquear',
      onClick: (row: CustomerSummary) =>
        toggleStatus.mutate({ id: String(row.id), status: row.status === 'active' ? 'blocked' : 'active' }),
    },
  ];

  const columns = getColumns();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className={styles.title}>Clientes</h1>
          <GestionRealSyncBadge status={grSync.data} isError={grSync.isError} totalClients={data?.total} />
        </div>
        <button
          className={styles.newClientBtn}
          onClick={() => navigate('/admin/customers/add')}
        >
          Nuevo cliente
        </button>
      </div>
      <ClientStatsCards
        activeStatus={status}
        onStatusClick={(s) => { setStatus(s === status ? '' : s); setPage(1); }}
      />
      <FilterBar
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar cliente..."
        filters={[{ key: 'status', label: 'Estado', options: STATUS_FILTERS }]}
        onFilterChange={(_, v) => { setStatus(v); setPage(1); }}
      />
      <div className={styles.actionsBar}>
        <button
          className={styles.actionsBtn}
          disabled={selectedIds.length === 0}
          onClick={() => setShowActionsDropdown((v) => !v)}
        >
          Acciones en lote
        </button>
        {showActionsDropdown && selectedIds.length > 0 && (
          <ul className={styles.actionsDropdown}>
            <li onClick={() => { selectedIds.forEach(id => toggleStatus.mutate({ id, status: 'blocked' })); setShowActionsDropdown(false); }}>Bloquear seleccionados</li>
            <li onClick={() => { const msg = window.prompt('Mensaje para los clientes seleccionados:'); if (msg) { window.alert(`Mensaje enviado a ${selectedIds.length} cliente(s).`); } setShowActionsDropdown(false); }}>Enviar mensaje</li>
            <li onClick={() => { exportToCSV(data?.data ?? [], 'clientes.csv'); setShowActionsDropdown(false); }}>Exportar</li>
          </ul>
        )}
        <button
          className={styles.exportBtn}
          onClick={() => exportToCSV(data?.data ?? [], 'clientes.csv')}
        >
          Exportar
        </button>
      </div>
      <DataTable<CustomerSummary>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        actions={actions}
        emptyMessage="No se encontraron clientes."
        selectable
        onSelectionChange={setSelectedIds}
        expandable
        renderExpanded={(row) => (
          <div className={styles.expandedRow}>
            <span>Email: {row.email}</span>
            <span>Teléfono: {row.phone}</span>
          </div>
        )}
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
