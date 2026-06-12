import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { useContracts, useContractStats } from '../../hooks/useContracts';
import { useServiceTechnologies } from '../../hooks/useServiceTechnologies';
import type { ContractSummary } from '../../types/contract';
import { ContractStatsCards } from './ContractStatsCards';
import styles from './ContractsListPage.module.css';

interface Column {
  label: string;
  key: keyof ContractSummary | string;
  sortable?: boolean;
  render?: (row: ContractSummary) => ReactNode;
}

function getColumns(): Column[] {
  return [
    {
      label: 'Cliente',
      key: 'clientName',
      sortable: false,
      // #56 Fix wave — patrón #47j Fix 3: cuando el contrato tiene clientId
      // (caso normal) el nombre linkea a la vista del cliente. Si falta
      // (deploy FE-antes-que-BE o response cacheada) cae a texto plano para
      // no navegar a /admin/customers/view/undefined.
      render: (row) =>
        row.clientId ? (
          <Link to={`/admin/customers/view/${row.clientId}`} className={styles.clientLink}>
            {row.clientName}
          </Link>
        ) : (
          row.clientName
        ),
    },
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
  const { data: stats } = useContractStats();

  const totalPages = data ? data.totalPages : 1;

  const technologyOptions = [
    { value: '', label: 'Todas' },
    ...technologies.map((t) => ({ value: t.name, label: t.name })),
  ];

  // Estado: opciones derivadas de los estados REALES de GR (keys de byStatus), no hardcodeadas.
  const statusOptions = [
    { value: '', label: 'Todos' },
    ...Object.keys(stats?.byStatus ?? {}).map((s) => ({ value: s, label: s })),
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
          { key: 'status', label: 'Estado', options: statusOptions },
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
