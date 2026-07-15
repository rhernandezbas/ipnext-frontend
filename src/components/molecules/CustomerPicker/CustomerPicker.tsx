import { useEffect, useState } from 'react';
import { useClientList } from '@/hooks/useCustomers';
import type { CustomerSummary } from '@/types/customer';
import styles from './CustomerPicker.module.css';

interface Props {
  /** Selected customer id (string — the backend Client.id is a UUID). */
  value: string | null;
  /** Display name of the selected customer. */
  valueName: string | null;
  /**
   * `client` (3rd arg, manual-recipients-fe) — the full selected `CustomerSummary`,
   * ADDITIVE and OPTIONAL: the multi-select wrapper reads `client.phone` for the
   * chip. Existing 2-arg callers (`(id, name) => …`) ignore it — zero break. It is
   * `undefined` on the clear path (`onChange(null, null)`).
   */
  onChange: (id: string | null, name: string | null, client?: CustomerSummary) => void;
  /**
   * service-transfer W4 — client id to EXCLUDE from the results (e.g. the
   * transfer SOURCE client: transferring a service to itself makes no sense).
   */
  excludeId?: string;
  /**
   * manual-recipients-fe — MULTIPLE client ids to exclude from the results
   * (e.g. everyone already added to a manual recipients list). Additive next to
   * the single `excludeId`; both are combined. Existing callers omit it.
   */
  excludeIds?: string[];
  /**
   * a11y (service-transfer FIX 6) — id for the search input so an external
   * <label htmlFor> can be associated with it. Optional: existing callers
   * (scheduling, tickets) keep working without it.
   */
  id?: string;
}

/**
 * Typeahead customer picker: type to filter clients by name (debounced server
 * search), click a result to select. Shows the selected client as a chip with a
 * clear button. The backend Client.id is a UUID string, so ids flow as strings.
 *
 * Shared molecule (service-transfer W4) — moved here from
 * pages/scheduling/SchedulingTasksPage/components so scheduling, tickets and the
 * transfer modal all use ONE component.
 */
export function CustomerPicker({ value, valueName, onChange, excludeId, excludeIds, id }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Only hit the API once the dropdown is open and there's something to search.
  const { data, isFetching } = useClientList({ search: debounced || undefined, pageSize: 20 });
  const rawResults = open && debounced.length > 0 ? data?.data ?? [] : [];
  // Combine the single `excludeId` (service-transfer) with the multi `excludeIds`
  // (manual-recipients-fe) into one lookup set — one place filters the results.
  const excluded = new Set<string>([...(excludeId ? [excludeId] : []), ...(excludeIds ?? [])]);
  const results = excluded.size > 0 ? rawResults.filter((c) => !excluded.has(String(c.id))) : rawResults;

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
        id={id}
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
                onClick={() => { onChange(String(c.id), c.name, c); setOpen(false); }}
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
