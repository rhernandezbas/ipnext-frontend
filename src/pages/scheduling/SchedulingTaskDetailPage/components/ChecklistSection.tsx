import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useAddChecklistItem,
  useToggleChecklistItem,
  useUpdateChecklistItem,
  useRemoveChecklistItem,
  useReorderChecklist,
  useClearChecklist,
} from '@/hooks/useScheduling';
import type { TaskChecklistItem } from '@/types/scheduling';
import { AssignTemplateDialog } from './AssignTemplateDialog';
import styles from './ChecklistSection.module.css';

interface SortableChecklistItemProps {
  item: TaskChecklistItem;
  onToggle: () => void;
  onUpdate: (text: string) => void;
  onDelete: () => void;
}

function SortableChecklistItem({ item, onToggle, onUpdate, onDelete }: SortableChecklistItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);

  const style = { transform: CSS.Transform.toString(transform), transition };

  function handleBlur() {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      onUpdate(trimmed);
    } else {
      setEditText(item.text);
    }
    setEditing(false);
  }

  return (
    <div ref={setNodeRef} style={style} className={`${styles.itemRow} ${item.done ? styles.itemDone : ''}`}>
      <span className={styles.dragHandle} {...attributes} {...listeners} aria-label="Reordenar">⠿</span>
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={item.done}
          onChange={onToggle}
          className={styles.checkbox}
          aria-label={item.text}
        />
        {editing ? (
          <input
            className={styles.editInput}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEditText(item.text); setEditing(false); }}}
            autoFocus
          />
        ) : (
          <span
            className={styles.itemText}
            onDoubleClick={() => { setEditing(true); setEditText(item.text); }}
            title="Doble clic para editar"
          >
            {item.text}
          </span>
        )}
      </label>
      <button className={styles.deleteBtn} onClick={onDelete} title="Eliminar" type="button" aria-label={`Eliminar: ${item.text}`}>
        ×
      </button>
    </div>
  );
}

interface ChecklistSectionProps {
  taskId: string;
  checklist: TaskChecklistItem[];
  /** Notified when any checklist mutation fails — REQ-OPTIMISTIC-1 requires a non-blocking toast. */
  onError?: (msg: string) => void;
}

function defaultErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { code?: string; message?: string } } }).response;
    if (res?.data?.code === 'CHECKLIST_ITEM_NOT_FOUND') return 'El item ya no existe';
    if (res?.data?.code === 'TEMPLATE_NOT_FOUND') return 'Plantilla no encontrada';
    if (res?.data?.message) return res.data.message;
  }
  return 'Error al guardar el checklist. Reintentar';
}

export function ChecklistSection({ taskId, checklist, onError }: ChecklistSectionProps) {
  function notifyError(err: unknown) {
    onError?.(defaultErrorMessage(err));
  }
  const [newText, setNewText] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const addItem = useAddChecklistItem(taskId);
  const toggleItem = useToggleChecklistItem(taskId);
  const updateItem = useUpdateChecklistItem(taskId);
  const removeItem = useRemoveChecklistItem(taskId);
  const reorderItems = useReorderChecklist(taskId);
  const clearItems = useClearChecklist(taskId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = checklist.findIndex(i => i.id === active.id);
      const newIdx = checklist.findIndex(i => i.id === over.id);
      const reordered = arrayMove(checklist, oldIdx, newIdx);
      reorderItems.mutateAsync(reordered.map(i => i.id)).catch(notifyError);
    }
  }

  function handleAddItem() {
    const trimmed = newText.trim();
    if (!trimmed) return;
    addItem.mutateAsync(trimmed).catch(notifyError);
    setNewText('');
  }

  const doneCount = checklist.filter(i => i.done).length;
  const totalCount = checklist.length;

  return (
    <section className={styles.section} aria-labelledby="checklist-heading" aria-live="polite">
      <div className={styles.sectionHeader}>
        <h2 id="checklist-heading" className={styles.sectionTitle}>
          Lista de verificación
          {totalCount > 0 && (
            <span className={styles.progress}>{doneCount}/{totalCount}</span>
          )}
        </h2>
        <div className={styles.sectionActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setShowAssignDialog(true)}
          >
            Cargar lista
          </button>
          {totalCount > 0 && (
            <button
              type="button"
              className={`${styles.btnSecondary} ${styles.btnDanger}`}
              onClick={() => setClearConfirm(true)}
            >
              Limpiar lista
            </button>
          )}
        </div>
      </div>

      {totalCount === 0 ? (
        <div className={styles.emptyState}>
          <p>Sin elementos en la lista. Cargá una plantilla o agregá pasos manualmente.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={checklist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {checklist.map(item => (
                <SortableChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={() => { toggleItem.mutateAsync(item.id).catch(notifyError); }}
                  onUpdate={text => { updateItem.mutateAsync({ itemId: item.id, text }).catch(notifyError); }}
                  onDelete={() => { removeItem.mutateAsync(item.id).catch(notifyError); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add item inline */}
      <div className={styles.addRow}>
        <input
          type="text"
          className={styles.addInput}
          placeholder="Añadir elemento..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
          aria-label="Nuevo elemento de checklist"
        />
        <button
          type="button"
          className={styles.btnAdd}
          onClick={handleAddItem}
          disabled={!newText.trim() || addItem.isPending}
          aria-label="Agregar elemento"
        >
          +
        </button>
      </div>

      {/* Assign template dialog */}
      {showAssignDialog && (
        <AssignTemplateDialog
          taskId={taskId}
          hasExistingItems={totalCount > 0}
          onClose={() => setShowAssignDialog(false)}
        />
      )}

      {/* Clear confirm dialog */}
      {clearConfirm && (
        <div className={styles.overlay} onClick={() => setClearConfirm(false)}>
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-dialog-title"
          >
            <h3 id="clear-dialog-title">¿Limpiar lista?</h3>
            <p>Se eliminarán todos los elementos. Esta acción no se puede deshacer.</p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setClearConfirm(false)} autoFocus>
                Cancelar
              </button>
              <button
                className={`${styles.btnSecondary} ${styles.btnDanger}`}
                onClick={() => { clearItems.mutateAsync().catch(notifyError); setClearConfirm(false); }}
                disabled={clearItems.isPending}
              >
                {clearItems.isPending ? 'Limpiando...' : 'Limpiar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
