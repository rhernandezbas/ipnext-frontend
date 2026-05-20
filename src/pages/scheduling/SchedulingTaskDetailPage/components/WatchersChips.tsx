import { useState, useRef, useEffect } from 'react';
import type { Admin } from '@/types/admin';
import styles from './WatchersChips.module.css';

interface WatchersChipsProps {
  watcherIds: string[];
  allAdmins: Admin[];
  onChange: (nextIds: string[]) => Promise<void>;
  isSaving: boolean;
}

export function WatchersChips({ watcherIds, allAdmins, onChange, isSaving }: WatchersChipsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search input when popover opens
  useEffect(() => {
    if (popoverOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [popoverOpen]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      const popover = document.getElementById('watchers-popover');
      const addBtn = addBtnRef.current;
      if (
        popover && !popover.contains(e.target as Node) &&
        addBtn && !addBtn.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const handleRemove = async (id: string) => {
    const next = watcherIds.filter(w => w !== id);
    await onChange(next);
  };

  const handleAdd = async (id: string) => {
    if (watcherIds.includes(id)) return;
    await onChange([...watcherIds, id]);
    setPopoverOpen(false);
    setSearch('');
    addBtnRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setPopoverOpen(false);
      setSearch('');
      addBtnRef.current?.focus();
    }
  };

  const watcherAdmins = watcherIds
    .map(id => allAdmins.find(a => a.id === id))
    .filter((a): a is Admin => !!a);

  const availableAdmins = allAdmins.filter(
    a => !watcherIds.includes(a.id) &&
    (search === '' || a.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className={styles.section} aria-labelledby="watchers-heading">
      <h2 id="watchers-heading" className={styles.sectionTitle}>
        Watchers{watcherIds.length > 0 ? ` (${watcherIds.length})` : ''}
      </h2>

      <div className={styles.chipsArea}>
        {watcherAdmins.length === 0 && (
          <span className={styles.empty}>Sin watchers</span>
        )}
        {watcherAdmins.map(admin => (
          <span key={admin.id} className={styles.chip}>
            <span className={styles.chipAvatar} aria-hidden>{admin.name.charAt(0).toUpperCase()}</span>
            <span className={styles.chipName}>{admin.name}</span>
            <button
              className={styles.chipRemove}
              onClick={() => { void handleRemove(admin.id); }}
              aria-label={`Quitar ${admin.name}`}
              disabled={isSaving}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className={styles.addRow}>
        <button
          ref={addBtnRef}
          className={styles.addBtn}
          onClick={() => setPopoverOpen(o => !o)}
          aria-label="Añadir watcher"
          aria-haspopup="listbox"
          aria-expanded={popoverOpen}
          disabled={isSaving}
        >
          + Añadir watcher
        </button>
      </div>

      {popoverOpen && (
        <div
          id="watchers-popover"
          className={styles.popover}
          role="dialog"
          aria-label="Buscar watcher"
          onKeyDown={handleKeyDown}
        >
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="search"
            role="searchbox"
            placeholder="Buscar administrador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar administrador"
          />
          <ul className={styles.resultList} role="listbox">
            {availableAdmins.length === 0 && (
              <li className={styles.noResults}>Sin resultados</li>
            )}
            {availableAdmins.map(admin => (
              <li key={admin.id} role="option" aria-selected="false">
                <button
                  className={styles.resultItem}
                  onClick={() => { void handleAdd(admin.id); }}
                  data-testid="watcher-result"
                >
                  <span className={styles.chipAvatar} aria-hidden>{admin.name.charAt(0).toUpperCase()}</span>
                  {admin.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
