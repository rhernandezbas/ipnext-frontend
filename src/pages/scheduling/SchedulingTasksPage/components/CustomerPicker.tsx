import { useEffect, useState } from 'react';
import { useClientList } from '@/hooks/useCustomers';
import styles from './CustomerPicker.module.css';

interface Props {
  /** Selected customer id (string — the backend Client.id is a UUID). */
  value: string | null;
  /** Display name of the selected customer. */
  valueName: string | null;
  onChange: (id: string | null, name: string | null) => void;
}

/**
 * Typeahead customer picker: type to filter clients by name (debounced server
 * search), click a result to select. Shows the selected client as a chip with a
 * clear button. The backend Client.id is a UUID string, so ids flow as strings.
 */
export function CustomerPicker({ value, valueName, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Only hit the API once the dropdown is open and there's something to search.
  const { data, isFetching } = useClientList({ search: debounced || undefined, pageSize: 20 });
  const results = open && debounced.length > 0 ? data?.data ?? [] : [];

  if (value) {
    return (
      <div className={styles.selected}>
        <span className={styles.selectedName} title={valueName ?? ''}>{valueName ?? '(cliente)'}</span>
        <button
          type="button"
          className={styles.clear}
          onClick={() => { onChange(null, null); setQuery(''); setDebounced(''); }}
          aria-label="Quitar cliente"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <input
        className={styles.input}
        value={query}
        placeholder="Buscar cliente por nombre…"
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && debounced.length > 0 && (
        <ul className={styles.dropdown}>
          {isFetching && results.length === 0 && <li className={styles.hint}>Buscando…</li>}
          {!isFetching && results.length === 0 && <li className={styles.hint}>Sin resultados</li>}
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.option}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(String(c.id), c.name); setOpen(false); }}
              >
                <span className={styles.optName}>{c.name}</span>
                {c.email && <span className={styles.optMeta}>{c.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
