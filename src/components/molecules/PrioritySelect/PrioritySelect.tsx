import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskPriority } from '@/types/taskPriority';
import styles from './PrioritySelect.module.css';

/** Neutral fallback colour for priorities not present in the catalog. */
const FALLBACK_COLOR = '#9ca3af';

export function priorityColor(p: TaskPriority | undefined): string {
  return p?.color || FALLBACK_COLOR;
}

/** Read-only badge — shown when the catalog is empty (still loading or no entries). */
function PriorityBadge({ value, color }: { value: string; color: string }) {
  return (
    <span
      className={styles.priorityBadge}
      style={{ backgroundColor: color, color: '#fff' }}
      aria-label={`Prioridad: ${value}`}
    >
      {value}
    </span>
  );
}

interface PrioritySelectProps {
  /** Current priority name (free text, may not be in catalog). */
  value: string;
  /** Catalog of available priorities. Empty -> read-only badge fallback. */
  priorities: TaskPriority[];
  /** Called when the user picks a different priority name. */
  onChange: (priorityName: string) => Promise<unknown> | void;
  /** Externally disables the control (e.g. while the parent is saving). */
  disabled?: boolean;
}

/**
 * Inline editable priority. A custom colour-coded dropdown (mirrors `StageSelect`):
 * the trigger is a pill tinted with the current priority's catalog colour, and
 * the popover lists every priority with its own colour swatch so you can see
 * each colour while choosing.
 *
 * Shared between the tasks table (inline per-row) and the task detail header.
 */
export function PrioritySelect({ value, priorities, onChange, disabled = false }: PrioritySelectProps) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = priorities.find(p => p.name === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    // Close on scroll/resize since the fixed-position menu would otherwise float away.
    // But ignore scroll events originating INSIDE the menu — otherwise scrolling
    // the options list closes it before the user can pick anything.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // Empty catalog (still loading / no entries) → read-only badge fallback.
  if (priorities.length === 0) return <PriorityBadge value={value} color={FALLBACK_COLOR} />;

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      // Open upward if there isn't room below (menu max-height ~280).
      const below = window.innerHeight - r.bottom;
      const top = below < 290 && r.top > 290 ? r.top - Math.min(280, r.top - 8) : r.bottom + 4;
      setPos({ top, left: r.left });
    }
    setOpen(true);
  }

  async function pick(name: string) {
    setOpen(false);
    if (name === value) return;
    setBusy(true);
    try {
      await onChange(name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.priorityPicker} onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.priorityPickerBtn}
        style={{ backgroundColor: priorityColor(current) }}
        disabled={busy || disabled}
        onClick={toggle}
        aria-label="Cambiar prioridad"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.name ?? value} <span className={styles.caret}>▾</span>
      </button>
      {open && pos && createPortal(
        <ul
          ref={menuRef}
          className={styles.priorityMenu}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          role="listbox"
          onClick={e => e.stopPropagation()}
        >
          {priorities.map(p => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={p.name === value}
                className={styles.priorityOption}
                onClick={() => pick(p.name)}
              >
                <span className={styles.swatch} style={{ backgroundColor: priorityColor(p) }} />
                {p.name}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
