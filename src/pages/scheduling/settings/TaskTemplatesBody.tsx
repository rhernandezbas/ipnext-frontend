import { useMemo, useState } from 'react';
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
  useTaskTemplates,
  useCreateTaskTemplate,
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
  useReplaceTemplateItems,
} from '@/hooks/useTaskTemplates';
import type { TaskTemplate, TaskTemplateCategory, TaskTemplateItem } from '@/types/taskTemplate';
import styles from '../SchedulingTemplatesPage.module.css';

const CATEGORY_OPTIONS: { value: TaskTemplateCategory; label: string }[] = [
  { value: 'installation', label: 'Instalación' },
  { value: 'repair',       label: 'Reparación' },
  { value: 'maintenance',  label: 'Mantenimiento' },
  { value: 'inspection',   label: 'Inspección' },
  { value: 'other',        label: 'Otro' },
];

const CATEGORY_LABEL: Record<TaskTemplateCategory, string> = CATEGORY_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<TaskTemplateCategory, string>,
);

// ── SVG icons ───────────────────────────────────────────────────────────────
function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ── Sortable item for drag-reorder in modal ─────────────────────────────────
interface SortableItemProps {
  id: string;
  text: string;
  onTextChange: (text: string) => void;
  onDelete: () => void;
}

function SortableItem({ id, text, onTextChange, onDelete }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={styles.itemRow}>
      <span className={styles.dragHandle} {...attributes} {...listeners} aria-label="Arrastrar">⠿</span>
      <input
        className={styles.itemInput}
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder="Texto del paso..."
      />
      <button className={styles.itemDeleteBtn} onClick={onDelete} title="Eliminar paso" type="button">
        <IconTrash />
      </button>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
interface LocalItem {
  localId: string;
  text: string;
  serverId?: string;
}

interface FormState {
  name: string;
  description: string;
  category: TaskTemplateCategory;
}

const EMPTY: FormState = { name: '', description: '', category: 'other' };

interface TemplateModalProps {
  initial?: FormState;
  initialItems?: TaskTemplateItem[];
  templateId?: string;
  onClose: () => void;
  onSave: (data: Omit<TaskTemplate, 'id'>, items: { text: string }[]) => Promise<void>;
  loading: boolean;
}

let localIdCounter = 0;
function newLocalId() { return `local-${++localIdCounter}`; }

function TemplateModal({ initial, initialItems, onClose, onSave, loading }: TemplateModalProps) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY);
  const [items, setItems] = useState<LocalItem[]>(
    (initialItems ?? []).map(i => ({ localId: newLocalId(), text: i.text, serverId: i.id }))
  );
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIdx = prev.findIndex(i => i.localId === active.id);
        const newIdx = prev.findIndex(i => i.localId === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function addItem() {
    setItems(prev => [...prev, { localId: newLocalId(), text: '' }]);
  }

  async function handleSubmit() {
    setError(null);
    try {
      await onSave(
        {
          name: form.name.trim(),
          description: form.description.trim() === '' ? null : form.description,
          category: form.category,
        },
        items.filter(i => i.text.trim() !== '').map(i => ({ text: i.text.trim() }))
      );
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; details?: Array<{ path?: string[]; message?: string }> } } }).response?.data;
      if (resp?.details && resp.details.length > 0) {
        setError(resp.details.map(d => `${(d.path ?? []).join('.')}: ${d.message ?? 'inválido'}`).join('; '));
      } else if (resp?.error) {
        setError(resp.error);
      } else {
        setError('No se pudo guardar la plantilla');
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{initial ? 'Editar plantilla' : 'Nueva plantilla'}</h2>

        <label className={styles.label}>
          Nombre *
          <input
            className={styles.input}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Instalación fibra residencial"
            autoFocus
          />
        </label>

        <label className={styles.label}>
          Categoría
          <select
            className={styles.input}
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value as TaskTemplateCategory })}
          >
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Descripción
          <textarea
            className={styles.textarea}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Detalles que se precargan al aplicar la plantilla..."
            rows={4}
          />
        </label>

        {/* Items section */}
        <div className={styles.itemsSection}>
          <span className={styles.itemsLabel}>Pasos de verificación</span>
          {items.length === 0 ? (
            <p className={styles.itemsEmpty}>Sin elementos. Agregá el primero abajo.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map(i => i.localId)} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableItem
                    key={item.localId}
                    id={item.localId}
                    text={item.text}
                    onTextChange={text => setItems(prev => prev.map(i => i.localId === item.localId ? { ...i, text } : i))}
                    onDelete={() => setItems(prev => prev.filter(i => i.localId !== item.localId))}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
          <button className={styles.btnAddItem} type="button" onClick={addItem}>
            + Agregar paso
          </button>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={!form.name.trim() || loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>¿Eliminar plantilla?</h2>
        <p className={styles.confirmText}>Se eliminará <strong>{name}</strong>. Esta acción no se puede deshacer.</p>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnDanger} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Body ─────────────────────────────────────────────────────────────────────
/** Plantillas de tareas — toolbar (buscar + recargar + añadir) + tabla + modales,
 *  sin header de página. Reusado por SchedulingTemplatesPage y SchedulingSettingsPage. */
export function TaskTemplatesBody() {
  const { data: templates = [], isLoading, refetch } = useTaskTemplates();
  const createMutation = useCreateTaskTemplate();
  const updateMutation = useUpdateTaskTemplate();
  const deleteMutation = useDeleteTaskTemplate();
  const replaceItemsMutation = useReplaceTemplateItems();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
    );
  }, [templates, search]);

  async function handleCreate(data: Omit<TaskTemplate, 'id'>, items: { text: string }[]) {
    const created = await createMutation.mutateAsync(data);
    if (items.length > 0) {
      await replaceItemsMutation.mutateAsync({ id: created.id, items });
    }
    setShowCreate(false);
  }

  async function handleEdit(data: Omit<TaskTemplate, 'id'>, items: { text: string }[]) {
    if (!editing) return;
    await updateMutation.mutateAsync({ id: editing.id, data });
    await replaceItemsMutation.mutateAsync({ id: editing.id, items });
    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    await deleteMutation.mutateAsync(deleting.id);
    setDeleting(null);
  }

  return (
    <>
      <div className={styles.tableSection}>
        <div className={styles.tableControls}>
          <div className={styles.searchControl}>
            <span className={styles.searchIcon}><IconSearch /></span>
            <input
              className={styles.searchInput}
              placeholder="Buscar plantilla..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.headerRight}>
            <button className={styles.btnIcon} title="Recargar" onClick={() => void refetch()}>
              <IconRefresh />
            </button>
            <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
              Añadir
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className={styles.empty}>Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className={styles.empty}>
                  {templates.length === 0 ? 'No hay plantillas todavía. Creá una con el botón Añadir.' : 'No se encontraron plantillas.'}
                </td></tr>
              ) : (
                filtered.map(tpl => (
                  <tr key={tpl.id} className={styles.row}>
                    <td className={styles.nameCell}>{tpl.name}</td>
                    <td className={styles.categoryCell}>
                      <span className={styles.categoryPill} data-category={tpl.category}>
                        {CATEGORY_LABEL[tpl.category]}
                      </span>
                    </td>
                    <td className={styles.descCell}>
                      {tpl.description ?? <span className={styles.descEmpty}>(sin descripción)</span>}
                    </td>
                    <td className={styles.actionsCell}>
                      <button className={styles.actionBtn} title="Editar" onClick={() => setEditing(tpl)}>
                        <IconPencil />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        title="Eliminar"
                        onClick={() => setDeleting(tpl)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <TemplateModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          loading={createMutation.isPending || replaceItemsMutation.isPending}
        />
      )}
      {editing && (
        <TemplateModal
          initial={{ name: editing.name, description: editing.description ?? '', category: editing.category }}
          initialItems={editing.items ?? []}
          templateId={editing.id}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
          loading={updateMutation.isPending || replaceItemsMutation.isPending}
        />
      )}
      {deleting && (
        <ConfirmDialog name={deleting.name} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      )}
    </>
  );
}
