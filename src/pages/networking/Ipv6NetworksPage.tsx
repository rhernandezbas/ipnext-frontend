import { useIpv6Networks } from '@/hooks/useNetwork';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import type { Ipv6Network } from '@/types/network';
import styles from './Ipv6NetworksPage.module.css';

const COLUMNS = [
  { label: 'Red', key: 'network' as const },
  { label: 'Tipo', key: 'type' as const },
  { label: 'Prefijos usados', key: 'usedPrefixes' as const },
  { label: 'Prefijos totales', key: 'totalPrefixes' as const },
  { label: 'Estado', key: 'status' as const },
  { label: 'Descripción', key: 'description' as const },
];

export default function Ipv6NetworksPage() {
  const { data: networks = [], isLoading } = useIpv6Networks();
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Redes IPv6</h1>
      <DataTable<Ipv6Network>
        columns={COLUMNS}
        data={networks}
        loading={isLoading}
        emptyMessage="No hay redes IPv6 configuradas."
      />
    </div>
  );
}
