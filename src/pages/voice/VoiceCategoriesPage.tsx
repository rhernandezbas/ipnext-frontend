import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { Button } from '@/components/atoms/Button/Button';
import { useVoipCategories } from '@/hooks/useVoz';
import type { VoipCategory } from '@/types/voz';
import styles from './VoiceCategoriesPage.module.css';

const COLUMNS = [
  { label: 'Nombre', key: 'name' as keyof VoipCategory },
  { label: 'Código', key: 'prefix' as keyof VoipCategory },
  {
    label: 'Descripción',
    key: 'freeMinutes' as keyof VoipCategory,
    render: (row: VoipCategory) => row.freeMinutes > 0 ? `${row.freeMinutes} min libres` : '—',
  },
];

export default function VoiceCategoriesPage() {
  const { data: categories = [], isLoading } = useVoipCategories();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Categorías de voz</h1>
        <Button variant="primary" onClick={() => {}}>Nueva categoría</Button>
      </div>
      <DataTable<VoipCategory>
        columns={COLUMNS}
        data={categories}
        loading={isLoading}
        emptyMessage="No hay categorías de voz configuradas."
      />
    </div>
  );
}
