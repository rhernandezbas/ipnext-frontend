import { useState, useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import type { Message } from '@/types/message';
import styles from './SupportInboxPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'unread', label: 'No leídos' },
  { value: 'read', label: 'Leídos' },
];

const COLUMNS = [
  { label: 'Asunto', key: 'subject' as const },
  { label: 'De', key: 'fromName' as const },
  { label: 'Canal', key: 'channel' as const },
  { label: 'Estado', key: 'status' as const },
  { label: 'Fecha', key: 'createdAt' as const },
];

export default function SupportInboxPage() {
  const { data: messages = [], isLoading } = useMessages('inbox');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    return messages.filter(m => {
      const matchSearch = !search || m.subject.toLowerCase().includes(search.toLowerCase()) || m.fromName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !status || m.status === status;
      return matchSearch && matchStatus;
    });
  }, [messages, search, status]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Bandeja de entrada</h1>
      <FilterBar
        onSearch={(v) => setSearch(v)}
        searchPlaceholder="Buscar mensaje..."
        filters={[{ key: 'status', label: 'Estado', options: STATUS_FILTERS }]}
        onFilterChange={(_, v) => setStatus(v)}
      />
      <DataTable<Message>
        columns={COLUMNS}
        data={filtered}
        loading={isLoading}
        emptyMessage="No hay mensajes en la bandeja de entrada."
      />
    </div>
  );
}
