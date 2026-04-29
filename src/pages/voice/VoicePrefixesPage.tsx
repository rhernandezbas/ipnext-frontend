import { useState, useMemo } from 'react';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useVoipPrefixes } from '@/hooks/useVoz';
import type { VoipPrefix } from '@/types/voz';
import styles from './VoicePrefixesPage.module.css';

const COLUMNS = [
  { label: 'Prefijo', key: 'prefix' as keyof VoipPrefix },
  { label: 'Categoría', key: 'categoryName' as keyof VoipPrefix },
  {
    label: 'Tarifa',
    key: 'ratePerMinute' as keyof VoipPrefix,
    render: (row: VoipPrefix) => `$${row.ratePerMinute.toFixed(4)}/min`,
  },
  { label: 'País', key: 'country' as keyof VoipPrefix },
];

export default function VoicePrefixesPage() {
  const { data: prefixes = [], isLoading } = useVoipPrefixes();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return prefixes;
    const lower = search.toLowerCase();
    return prefixes.filter(
      p =>
        p.prefix.toLowerCase().includes(lower) ||
        p.name.toLowerCase().includes(lower),
    );
  }, [prefixes, search]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Prefijos</h1>
      <FilterBar
        onSearch={setSearch}
        searchPlaceholder="Buscar prefijo o país..."
      />
      <DataTable<VoipPrefix>
        columns={COLUMNS}
        data={filtered}
        loading={isLoading}
        emptyMessage="No hay prefijos que coincidan con la búsqueda."
      />
    </div>
  );
}
