import { useState, useMemo } from 'react';
import { useIpNetworks } from '@/hooks/useNetwork';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import type { IpNetwork } from '@/types/network';
import styles from './Ipv4NetworksPage.module.css';

const COLUMNS = [
  { label: 'Red', key: 'network' as const },
  { label: 'Gateway', key: 'gateway' as const },
  { label: 'DNS 1', key: 'dns1' as const },
  { label: 'Tipo', key: 'type' as const },
  { label: 'IPs usadas', key: 'usedIps' as const },
  { label: 'IPs libres', key: 'freeIps' as const },
  { label: 'Descripción', key: 'description' as const },
];

export default function Ipv4NetworksPage() {
  const { data: networks = [], isLoading } = useIpNetworks();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return networks;
    const q = search.toLowerCase();
    return networks.filter(n =>
      n.network.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
    );
  }, [networks, search]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Redes IPv4</h1>
      <div className={styles.kpiGrid} aria-label="KPI cards">
        <div className={styles.kpiCard} style={{ '--kpi-color': '#2563eb' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{networks.length}</p>
          <p className={styles.kpiLabel}>Total redes</p>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#10b981' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{networks.reduce((a, n) => a + n.freeIps, 0)}</p>
          <p className={styles.kpiLabel}>IPs libres</p>
        </div>
        <div className={styles.kpiCard} style={{ '--kpi-color': '#ef4444' } as React.CSSProperties}>
          <p className={styles.kpiValue}>{networks.reduce((a, n) => a + n.usedIps, 0)}</p>
          <p className={styles.kpiLabel}>IPs usadas</p>
        </div>
      </div>
      <FilterBar
        onSearch={(v) => setSearch(v)}
        searchPlaceholder="Buscar red..."
        filters={[]}
        onFilterChange={() => {}}
      />
      <DataTable<IpNetwork>
        columns={COLUMNS}
        data={filtered}
        loading={isLoading}
        emptyMessage="No hay redes IPv4 configuradas."
      />
    </div>
  );
}
