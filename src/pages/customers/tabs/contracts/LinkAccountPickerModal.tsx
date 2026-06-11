import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GigaredAccount } from '@/types/gigared';
import styles from './LinkAccountPickerModal.module.css';

interface LinkAccountPickerModalProps {
  /** Registered, UNLINKED accounts eligible to be linked (internalId null/empty). */
  accounts: GigaredAccount[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** Picking a row selects the account AND closes the modal. */
  onPick: (account: GigaredAccount) => void;
  onClose: () => void;
}

/** Display name "APELLIDO NOMBRE" with a graceful fallback. */
function displayName(a: GigaredAccount): string {
  return [a.lastName, a.firstName].filter(Boolean).join(' ') || 'Sin nombre';
}

/**
 * #47g-2 — the "Vincular cuenta de Gigared" picker, lifted out of the inline
 * select-list into a real modal. A search input (autofocus) sits above a list of
 * clickable rows: the name reads prominent, the CIC and packs trail in a subtle
 * secondary line. Picking a row selects it and closes. Esc and a click on the
 * backdrop close. Loading / empty / error states live here, where the operator
 * is already looking. Rendered to document.body via portal so the contract form
 * underneath never clips it.
 */
export function LinkAccountPickerModal({
  accounts,
  loading,
  error,
  onRetry,
  onPick,
  onClose,
}: LinkAccountPickerModalProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => {
      const name = displayName(a).toLowerCase();
      return name.includes(q) || a.cic.toLowerCase().includes(q);
    });
  }, [accounts, query]);

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-picker-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 id="link-picker-title" className={styles.title}>
            Vincular cuenta de Gigared
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className={styles.searchWrap}>
          <label htmlFor="link-picker-search" className={styles.srOnly}>
            Buscar cuenta
          </label>
          <input
            ref={searchRef}
            id="link-picker-search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá por nombre o CIC…"
            autoComplete="off"
          />
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.state}>Cargando cuentas disponibles…</p>
          ) : error ? (
            <div className={styles.errorState}>
              <p className={styles.state}>No se pudieron cargar las cuentas.</p>
              <button type="button" className={styles.retry} onClick={onRetry}>
                Reintentar
              </button>
            </div>
          ) : accounts.length === 0 ? (
            <p className={styles.state}>No quedan cuentas disponibles para vincular.</p>
          ) : filtered.length === 0 ? (
            <p className={styles.state}>Ninguna cuenta coincide con "{query.trim()}".</p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((a) => {
                const packs = a.services.map((s) => s.name).join(' · ');
                return (
                  <li key={a.cic}>
                    <button type="button" className={styles.row} onClick={() => onPick(a)}>
                      <span className={styles.rowName}>{displayName(a)}</span>
                      <span className={styles.rowMeta}>
                        <span className={styles.rowCic}>CIC {a.cic}</span>
                        {packs && <span className={styles.rowPacks}>{packs}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
