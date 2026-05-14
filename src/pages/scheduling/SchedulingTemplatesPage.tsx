import { useState } from 'react';
import {
  useTaskTemplates,
  useCreateTaskTemplate,
  useUpdateTaskTemplate,
  useDeleteTaskTemplate,
} from '@/hooks/useTaskTemplates';
import type { TaskTemplate, TaskTemplateCategory } from '@/types/taskTemplate';

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

interface FormState {
  name: string;
  description: string;
  category: TaskTemplateCategory;
}

const EMPTY: FormState = { name: '', description: '', category: 'other' };

function TemplateModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: FormState;
  onClose: () => void;
  onSubmit: (data: Omit<TaskTemplate, 'id'>) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() === '' ? null : form.description,
        category: form.category,
      });
      onClose();
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: string; details?: Array<{ path?: string[]; message?: string }> } } }).response?.data;
      if (resp?.details && resp.details.length > 0) {
        setError(resp.details.map(d => `${(d.path ?? []).join('.')}: ${d.message ?? 'inválido'}`).join('; '));
      } else if (resp?.error) {
        setError(resp.error);
      } else {
        setError('No se pudo guardar la plantilla');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-1, white)', padding: 24, borderRadius: 8, width: 480, maxWidth: '90vw' }}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Categoría</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as TaskTemplateCategory })}
              style={{ width: '100%', padding: 8 }}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
              style={{ width: '100%', padding: 8 }}
            />
          </div>
          {error && (
            <div role="alert" style={{ color: 'var(--danger, #c00)', marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SchedulingTemplatesPage() {
  const { data: templates = [], isLoading } = useTaskTemplates();
  const { mutateAsync: createTpl } = useCreateTaskTemplate();
  const { mutateAsync: updateTpl } = useUpdateTaskTemplate();
  const { mutate: deleteTpl } = useDeleteTaskTemplate();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    deleteTpl(id);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Plantillas de tareas</h1>
        <button onClick={() => setShowCreate(true)}>+ Nueva plantilla</button>
      </div>

      {isLoading ? (
        <p>Cargando…</p>
      ) : templates.length === 0 ? (
        <p>No hay plantillas todavía. Creá una con el botón de arriba.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border, #ddd)' }}>
              <th style={{ textAlign: 'left', padding: 8 }}>Nombre</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Categoría</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Descripción</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(tpl => (
              <tr key={tpl.id} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                <td style={{ padding: 8, fontWeight: 500 }}>{tpl.name}</td>
                <td style={{ padding: 8 }}>{CATEGORY_LABEL[tpl.category]}</td>
                <td style={{ padding: 8, color: 'var(--text-3, #666)' }}>
                  {tpl.description ?? <em>(sin descripción)</em>}
                </td>
                <td style={{ padding: 8, textAlign: 'right' }}>
                  <button onClick={() => setEditing(tpl)} style={{ marginRight: 4 }}>Editar</button>
                  <button onClick={() => handleDelete(tpl.id, tpl.name)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <TemplateModal
          title="Nueva plantilla"
          onClose={() => setShowCreate(false)}
          onSubmit={async data => { await createTpl(data); }}
        />
      )}

      {editing && (
        <TemplateModal
          title="Editar plantilla"
          initial={{
            name: editing.name,
            description: editing.description ?? '',
            category: editing.category,
          }}
          onClose={() => setEditing(null)}
          onSubmit={async data => { await updateTpl({ id: editing.id, data }); }}
        />
      )}
    </div>
  );
}
