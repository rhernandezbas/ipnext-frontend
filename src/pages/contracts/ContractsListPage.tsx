import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { useContracts } from '../../hooks/useContracts';
import { useServiceTechnologies } from '../../hooks/useServiceTechnologies';
import type { ContractSummary } from '../../types/contract';
import { ContractStatsCards } from './ContractStatsCards';
import styles from './ContractsListPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'blocked', label: 'Incobrable' },
  { value: 'late', label: 'Moroso' },
  { value: 'baja', label: 'Baja' },
];

interface Column {
  label: string;
  key: keyof ContractSummary | string;
  sortable?: boolean;
  render?: (row: ContractSummary) => ReactNode;
}

function getColumns(): Column[] {
  return [
    { label: 'Cliente', key: 'clientName', sortable: false },
    { label: 'Plan', key: 'plan', sortable: false },
    {
      label: 'Estado',
      key: 'status',
      sortable: false,
      render: (row) => row.status,
    },
    {
      label: 'Tecnología',
      key: 'technology',
      sortable: false,
      render: (row) => row.technology ?? '—',
    },
    { label: 'Fecha de inicio', key: 'startDate', sortable: false },
  ];
}

export default function ContractsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [technology, setTechnology] = useState(searchParams.get('technology') ?? '');

  function handleStatusClick(s: string) {
    setStatus(s === status ? '' : s);
    setPage(1);
  }
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    if (status) params['status'] = status;
    if (technology) params['technology'] = technology;
    if (page > 1) params['page'] = String(page);
    setSearchParams(params, { replace: true });
  }, [search, status, technology, page, setSearchParams]);

  const { data, isLoading, isError } = useContracts({
    page,
    limit: 25,
    search: search || undefined,
    status: status || undefined,
    technology: technology || undefined,
  });

  const { data: technologies = [] } = useServiceTechnologies();

  const totalPages = data ? data.totalPages : 1;

  const technologyOptions = [
    { value: '', label: 'Todas' },
    ...technologies.map((t) => ({ value: t.name, label: t.name })),
  ];

  const columns = getColumns();

  if (isError) {
    return (
      <div className={styles.page}>
        <p className={styles.errorMsg}>Error al cargar los contratos. Intentá nuevamente.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Contratos</h1>
      </div>
      <ContractStatsCards activeStatus={status} onStatusClick={handleStatusClick} />
      <FilterBar
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Buscar contrato..."
        filters={[
          { key: 'status', label: 'Estado', options: STATUS_FILTERS },
          { key: 'technology', label: 'Tecnología', options: technologyOptions },
        ]}
        onFilterChange={(key, v) => {
          if (key === 'status') { setStatus(v); setPage(1); }
          if (key === 'technology') { setTechnology(v); setPage(1); }
        }}
      />
      <DataTable<ContractSummary>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage="No se encontraron contratos."
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
