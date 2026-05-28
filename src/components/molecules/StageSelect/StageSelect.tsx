import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScheduledTask, TaskStageCategory } from '@/types/scheduling';
import type { WorkflowStage } from '@/types/workflow';
import styles from './StageSelect.module.css';

const CATEGORY_LABEL: Record<TaskStageCategory, string> = {
  nuevo:      'Nuevo',
  enProgreso: 'En progreso',
  hecho:      'Hecho',
  cancelado:  'Cancelado',
};

// Fallback colour per category when a stage has no custom colour set.
const CATEGORY_COLOR: Record<TaskStageCategory, string> = {
  nuevo:      '#3b82f6',
  enProgreso: '#f59e0b',
  hecho:      '#22c55e',
  cancelado:  '#ef4444',
};

export function stageColor(s: WorkflowStage): string {
  return s.color || CATEGORY_COLOR[s.category] || '#6b7280';
}

/** Read-only category badge — shown when no workflow stages resolve. */
function StageBadge({ stageCategory }: { stageCategory: TaskStageCategory }) {
  return (
    <span className={styles.stageBadge} data-category={stageCategory}>
      {CATEGORY_LABEL[stageCategory]}
    </span>
  );
}

interface StageSelectProps {
  task: ScheduledTask;
  stages: WorkflowStage[];
  onMove: (stageId: string) => Promise<unknown>;
  /** Externally disable the control (e.g. while the parent is saving). */
  disabled?: boolean;
}

/**
 * Inline editable estado. A custom colour-coded dropdown (native <option>s can't
 * show background colours): the trigger is a pill tinted with the current stage's
 * colour, and the popover lists every stage with its own colour swatch so you can
 * see which colour each estado is when choosing. Moves the task without opening it.
 *
 * Shared between the tasks table (inline per-row) and the task detail header.
 */
export function StageSelect({ task, stages, onMove, disabled = false }: StageSelectProps) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = stages.find(s => s.id === task.stageId);

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

  // No workflow stages resolved → fall back to the read-only category badge.
  if (stages.length === 0) return <StageBadge stageCategory={task.stageCategory} />;

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

  async function pick(stageId: string) {
    setOpen(false);
    if (stageId === task.stageId) return;
    setBusy(true);
    try {
      await onMove(stageId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stagePicker} onClick={e => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.stagePickerBtn}
        style={{ backgroundColor: current ? stageColor(current) : '#6b7280' }}
        disabled={busy || disabled}
        onClick={toggle}
        aria-label="Cambiar estado"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current?.name ?? '—'} <span className={styles.caret}>▾</span>
      </button>
      {open && pos && createPortal(
        <ul
          ref={menuRef}
          className={styles.stageMenu}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          role="listbox"
          onClick={e => e.stopPropagation()}
        >
          {stages.map(s => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={s.id === task.stageId}
                className={styles.stageOption}
                onClick={() => pick(s.id)}
              >
                <span className={styles.swatch} style={{ backgroundColor: stageColor(s) }} />
                {s.name}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
