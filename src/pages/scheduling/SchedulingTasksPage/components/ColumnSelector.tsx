import { useEffect, useRef, useState } from 'react';
import styles from './ColumnSelector.module.css';

export interface ColumnDef {
  key: string;
  label: string;
}

interface ColumnSelectorProps {
  columns: ColumnDef[];
  visible: string[];
  onToggle: (key: string) => void;
  onReset?: () => void;
}

/**
 * Dropdown with a checkbox per column. Click outside to close.
 * Keyboard: Escape closes the menu. Each checkbox is focusable and
 * toggles via Space (native input behaviour).
 */
export function ColumnSelector({ columns, visible, onToggle, onReset }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const hiddenCount = columns.length - visible.length;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Columnas{hiddenCount > 0 ? ` (${hiddenCount} ocultas)` : ''} <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {columns.map(col => {
            const checked = visible.includes(col.key);
            return (
              <label key={col.key} className={styles.item}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(col.key)}
                  aria-label={`Mostrar columna ${col.label}`}
                />
                <span>{col.label}</span>
              </label>
            );
          })}
          {onReset && (
            <button type="button" className={styles.resetBtn} onClick={onReset}>
              Restaurar todas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
