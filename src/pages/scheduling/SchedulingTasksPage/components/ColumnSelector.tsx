import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './ColumnSelector.module.css';

export interface ColumnDef {
  key: string;
  label: string;
}

interface ColumnSelectorProps {
  /** All known columns. The selector uses this to know the labels. */
  columns: ColumnDef[];
  /** Ordered list of currently-visible column keys (also defines table order). */
  visible: string[];
  /** Toggle a single column's visibility. */
  onToggle: (key: string) => void;
  /** Reorder visible columns: receives the full new ordered list. */
  onReorder: (newOrder: string[]) => void;
  /** Restore all columns and the canonical order. */
  onReset?: () => void;
}

/**
 * Dropdown with a checkbox per column AND a drag handle to reorder.
 * - Visible columns are shown first (in their current order, draggable).
 * - Hidden columns are listed afterward as a 'Ocultas' subgroup (not draggable
 *   while hidden; reappear in visible list as soon as they're checked).
 * - Click outside / Esc close the menu.
 * - dnd-kit PointerSensor + KeyboardSensor for accessible drag.
 */
export function ColumnSelector({ columns, visible, onToggle, onReorder, onReset }: ColumnSelectorProps) {
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

  // Build the two lists from the props every render — single source of truth.
  const visibleColumns = visible
    .map(key => columns.find(c => c.key === key))
    .filter((c): c is ColumnDef => !!c);
  const hiddenColumns = columns.filter(c => !visible.includes(c.key));
  const hiddenCount = hiddenColumns.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visible.indexOf(active.id as string);
    const newIndex = visible.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(visible, oldIndex, newIndex));
  }

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
          <div className={styles.menuHint}>Arrastrá para reordenar</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible} strategy={verticalListSortingStrategy}>
              {visibleColumns.map(col => (
                <SortableColumnRow key={col.key} col={col} checked onToggle={onToggle} />
              ))}
            </SortableContext>
          </DndContext>

          {hiddenColumns.length > 0 && (
            <>
              <div className={styles.menuSubheader}>Ocultas</div>
              {hiddenColumns.map(col => (
                <label key={col.key} className={`${styles.item} ${styles.itemHidden}`}>
                  <span className={styles.dragHandlePlaceholder} aria-hidden />
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => onToggle(col.key)}
                    aria-label={`Mostrar columna ${col.label}`}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </>
          )}

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

function SortableColumnRow({
  col,
  checked,
  onToggle,
}: {
  col: ColumnDef;
  checked: boolean;
  onToggle: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={styles.item}>
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Arrastrar columna ${col.label}`}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(col.key)}
        aria-label={`Mostrar columna ${col.label}`}
      />
      <span>{col.label}</span>
    </div>
  );
}
