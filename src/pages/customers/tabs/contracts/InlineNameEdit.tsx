import { useState } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useUpdateContractName } from '@/hooks/useCustomers';
import styles from './InlineNameEdit.module.css';

interface Props {
  contractId: string;
  /** Current display text (name ?? plan). */
  display: string;
  /** The raw name override (null when falling back to plan). */
  name: string | null | undefined;
  clientId: string;
}

/**
 * Click-to-edit contract name (#42, AD-2). Enter saves, Esc cancels, empty
 * clears to `null`. Read-only (plain text) when the user lacks `clients.write`.
 */
export function InlineNameEdit({ contractId, display, name, clientId }: Props) {
  const { can } = useMyPermissions();
  const canWrite = can('clients.write');
  const updateName = useUpdateContractName(clientId);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? '');

  if (!canWrite) {
    return <span className={styles.title}>{display}</span>;
  }

  function open() {
    setValue(name ?? '');
    setEditing(true);
  }

  async function commit() {
    const trimmed = value.trim();
    await updateName.mutateAsync({ contractId, name: trimmed === '' ? null : trimmed });
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        className={styles.input}
        value={value}
        autoFocus
        aria-label="Nombre del contrato"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setEditing(false)}
      />
    );
  }

  return (
    <button type="button" className={styles.trigger} onClick={open} title="Editar nombre">
      <span className={styles.title}>{display}</span>
      <span className={styles.pencil} aria-hidden="true">✎</span>
    </button>
  );
}
