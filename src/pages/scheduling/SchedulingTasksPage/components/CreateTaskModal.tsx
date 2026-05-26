import { useMemo, useState } from 'react';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';
import type { CreateTaskPayload, TaskPriority, TaskCategory } from '@/types/scheduling';
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
  onClose: () => void;
  onCreate: (data: CreateTaskPayload) => Promise<unknown>;
  loading: boolean;
}

/**
 * Minimal create-task form. The task always starts on the FIRST stage (lowest
 * order) of the selected project's workflow — the backend persistence layer
 * requires a valid stageId, so we resolve one here instead of relying on a
 * server-side default that doesn't exist.
 */
export function CreateTaskModal({ projects, workflows, onClose, onCreate, loading }: Props) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [category, setCategory] = useState<TaskCategory>('other');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = projects.find(p => p.id === projectId);
  const firstStageId = useMemo(() => {
    const wf = workflows.find(w => w.id === selectedProject?.workflowId);
    if (!wf || wf.stages.length === 0) return undefined;
    return [...wf.stages].sort((a, b) => a.order - b.order)[0].id;
  }, [workflows, selectedProject]);

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

        <label className={styles.label}>
          Proyecto *
          <select className={styles.select} value={projectId} onChange={e => setProjectId(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>

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
