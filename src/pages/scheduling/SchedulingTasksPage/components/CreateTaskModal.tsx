import { useMemo, useState } from 'react';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';
import type { Admin } from '@/types/admin';
import type { CreateTaskPayload, TaskPriority, TaskCategory } from '@/types/scheduling';
import { CustomerPicker } from './CustomerPicker';
import styles from './CreateTaskModal.module.css';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'installation', label: 'Instalación' },
  { value: 'repair', label: 'Reparación' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'inspection', label: 'Inspección' },
  { value: 'other', label: 'Otro' },
];

interface Props {
  projects: Project[];
  workflows: Workflow[];
  technicians?: Admin[];
  onClose: () => void;
  onCreate: (data: CreateTaskPayload) => Promise<unknown>;
  loading: boolean;
}

/** First stage (lowest order) of the project's workflow, or undefined if the
 *  project has no workflow / the workflow has no stages. */
function resolveFirstStageId(project: Project | undefined, workflows: Workflow[]): string | undefined {
  const wf = workflows.find(w => w.id === project?.workflowId);
  if (!wf || wf.stages.length === 0) return undefined;
  return [...wf.stages].sort((a, b) => a.order - b.order)[0].id;
}

/** Combine a date (yyyy-mm-dd) and optional time (hh:mm) into an ISO string with
 *  offset, as required by the backend (z.string().datetime({ offset: true })). */
function toStartDate(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Full create-task form (cliente con buscador, descripción, asignado, fecha,
 * dirección, notas). The task always starts on the FIRST stage (lowest order)
 * of the selected project's workflow — the backend persistence layer requires a
 * valid stageId, so we resolve one here instead of relying on a server-side
 * default that doesn't exist.
 */
export function CreateTaskModal({ projects, workflows, technicians = [], onClose, onCreate, loading }: Props) {
  // Default to the first project that actually has a usable workflow — selecting
  // a workflow-less project would leave the form unsubmittable for no visible reason.
  const defaultProjectId =
    projects.find(p => resolveFirstStageId(p, workflows))?.id ?? projects[0]?.id ?? '';

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [category, setCategory] = useState<TaskCategory>('other');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === projectId);
  const firstStageId = useMemo(
    () => resolveFirstStageId(selectedProject, workflows),
    [workflows, selectedProject],
  );

  const canSave = title.trim().length > 0 && !!firstStageId && !loading;

  async function handleSave() {
    if (!firstStageId) {
      setError('El proyecto seleccionado no tiene etapas configuradas.');
      return;
    }
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        projectId,
        stageId: firstStageId,
        priority,
        category,
        estimatedHours,
        customerId: customerId || null,
        customerName: customerName || null,
        assigneeId: assigneeId || null,
        description: description.trim() || null,
        startDate: toStartDate(date, time),
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      setError('No se pudo crear la tarea. Revisá los datos e intentá de nuevo.');
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Nueva tarea</h2>

        {error && <p className={styles.error}>{error}</p>}

        <label className={styles.label}>
          Título *
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título de la tarea"
            autoFocus
          />
        </label>

        <div className={styles.label}>
          Cliente
          <CustomerPicker
            value={customerId}
            valueName={customerName}
            onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
          />
        </div>

        <label className={styles.label}>
          Descripción
          <textarea
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalles de la tarea…"
            rows={2}
          />
        </label>

        <div className={styles.row}>
          <label className={styles.label}>
            Asignado a
            <select className={styles.select} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Proyecto *
            <select className={styles.select} value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
        </div>

        {selectedProject && !firstStageId && (
          <p className={styles.warning}>
            El proyecto "{selectedProject.title}" no tiene un workflow asignado, así que no se
            pueden crear tareas en él. Elegí otro proyecto o asignale un workflow primero.
          </p>
        )}

        <div className={styles.row}>
          <label className={styles.label}>
            Prioridad
            <select className={styles.select} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Categoría
            <select className={styles.select} value={category} onChange={e => setCategory(e.target.value as TaskCategory)}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Fecha
            <input className={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>

          <label className={styles.label}>
            Hora
            <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>
            Horas estimadas
            <input
              className={styles.input}
              type="number"
              min={0}
              step={0.5}
              value={estimatedHours}
              onChange={e => setEstimatedHours(Math.max(0, Number(e.target.value)))}
            />
          </label>

          <label className={styles.label}>
            Dirección
            <input
              className={styles.input}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Dirección del trabajo"
            />
          </label>
        </div>

        <label className={styles.label}>
          Notas
          <textarea
            className={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Instrucciones adicionales, materiales…"
            rows={2}
          />
        </label>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!canSave}>
            {loading ? 'Creando...' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}
