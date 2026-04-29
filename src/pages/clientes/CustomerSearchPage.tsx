import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientList } from '@/hooks/useClients';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { CustomerSummary } from '@/types/customer';
import styles from './CustomerSearchPage.module.css';

const COLUMNS = [
  { label: 'ID', key: 'id' as const },
  { label: 'Nombre', key: 'name' as const },
  { label: 'Login', key: 'login' as const },
  { label: 'Email', key: 'email' as const },
  { label: 'Teléfono', key: 'phone' as const },
  { label: 'Estado', key: 'status' as const },
];

export default function CustomerSearchPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading } = useClientList({
    search: submitted || undefined,
    limit: 25,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(search);
  }

  const actions = [
    { label: 'Ver detalle', onClick: (row: CustomerSummary) => navigate(`/admin/customers/view/${row.id}`) },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Búsqueda de clientes</h1>
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, login, email o teléfono..."
          aria-label="Buscar cliente"
        />
        <button className={styles.searchBtn} type="submit">Buscar</button>
      </form>
      {submitted && (
        <DataTable<CustomerSummary>
          columns={COLUMNS}
          data={data?.data ?? []}
          loading={isLoading}
          actions={actions}
          emptyMessage={`No se encontraron resultados para "${submitted}".`}
        />
      )}
    </div>
  );
}
