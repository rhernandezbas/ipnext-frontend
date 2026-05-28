import { useEffect, useMemo, useRef, useState } from 'react';
import { useClientDetail, useClientServices } from '@/hooks/useCustomers';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';
import type { Admin } from '@/types/admin';
import type { TaskTemplate } from '@/types/taskTemplate';
import type { CreateTaskPayload } from '@/types/scheduling';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import { CustomerPicker } from './CustomerPicker';
import { applyTaskVariables } from '../../lib/taskVariables';
import styles from './CreateTaskModal.module.css';

const DEFAULT_PRIORITY = 'Normal';

// Maps legacy template category codes (TaskTemplate still uses the old enum) to
// the seeded catalog names, so applying a template selects a real catalog option.
const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  installation: 'Instalación',
  repair: 'Reparación',
  maintenance: 'Mantenimiento',
  inspection: 'Inspección',
  other: 'Otro',
};
const DEFAULT_CATEGORY = 'Otro';

interface Props {
  projects: Project[];
  workflows: Workflow[];
  technicians?: Admin[];
  templates?: TaskTemplate[];
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
export function CreateTaskModal({ projects, workflows, technicians = [], templates = [], onClose, onCreate, loading }: Props) {
  // Default to the first project that actually has a usable workflow — selecting
  // a workflow-less project would leave the form unsubmittable for no visible reason.
  const defaultProjectId =
    projects.find(p => resolveFirstStageId(p, workflows))?.id ?? projects[0]?.id ?? '';

  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<string>(DEFAULT_PRIORITY);
  const { data: priorities = [] } = useTaskPriorities();
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const { data: categories = [] } = useTaskCategories();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // When a customer is picked, pull its detail and auto-fill the address with the
  // customer's address. Fill once per customer (ref guard) so we don't clobber a
  // manual edit on re-render / background refetch.
  const { data: customerDetail } = useClientDetail(customerId ?? '');
  // Services of the selected customer
  const { data: customerServices = [] } = useClientServices(customerId ?? '', !!customerId);
  const filledForCustomer = useRef<string | null>(null);
  useEffect(() => {
    if (!customerId) { filledForCustomer.current = null; return; }
    if (
      customerDetail &&
      String(customerDetail.id) === String(customerId) &&
      filledForCustomer.current !== String(customerId)
    ) {
      filledForCustomer.current = String(customerId);
      // Only use customer address as fallback when no service is selected yet
      if (!serviceId && customerDetail.address) setAddress(customerDetail.address);
    }
  }, [customerId, customerDetail, serviceId]);

  // When a service is explicitly chosen, autofill address from the service
  // (service > customer precedence). If the service has no address, fall back
  // to the customer address.
  useEffect(() => {
    if (!serviceId) {
      // Service deselected — restore customer address if available
      if (customerDetail?.address) setAddress(customerDetail.address);
      else setAddress('');
      return;
    }
    const svc = customerServices.find(s => String(s.id) === serviceId);
    if (svc) {
      // Service has an address → use it (overrides whatever was there)
      if (svc.address) {
        setAddress(svc.address);
      } else {
        // Service has no address → fallback to customer address
        if (customerDetail?.address) setAddress(customerDetail.address);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Reset service when customer changes
  useEffect(() => {
    setServiceId(null);
  }, [customerId]);

  // Any meaningful field the user has touched (defaults like project/priority/
  // category don't count). Used to guard against discarding work on an
  // accidental backdrop click.
  const hasData =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    !!customerId ||
    !!serviceId ||
    assigneeId.length > 0 ||
    date.length > 0 ||
    time.length > 0 ||
    address.trim().length > 0 ||
    notes.trim().length > 0;

  // Backdrop click: only discard silently when the form is empty. With data,
  // confirm first so a stray click outside the modal doesn't wipe the work.
  // The explicit Cancel button bypasses this (it's a deliberate action).
  function handleBackdropClick() {
    if (hasData && !window.confirm('Tenés datos sin guardar. ¿Cerrar y descartar la tarea?')) {
      return;
    }
    onClose();
  }

  const selectedProject = projects.find(p => p.id === projectId);
  const firstStageId = useMemo(
    () => resolveFirstStageId(selectedProject, workflows),
    [workflows, selectedProject],
  );

  const canSave = title.trim().length > 0 && !!firstStageId && !loading;

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    // Only fill fields the user hasn't touched — never clobber typed text.
    setTitle(prev => (prev.trim() ? prev : tpl.name));
    setDescription(prev => (prev.trim() ? prev : (tpl.description ?? '')));
    // Category always has a value; treat the default 'other' as "empty".
    setCategory(prev => (prev !== DEFAULT_CATEGORY ? prev : (LEGACY_CATEGORY_LABEL[tpl.category] ?? tpl.category)));
  }

  async function handleSave() {
    if (!firstStageId) {
      setError('El proyecto seleccionado no tiene estados configurados.');
      return;
    }
    setError(null);
    // Resolve merge variables ({{cliente}}, {{telefono}}, {{servicio}},
    // {{direccion}}) once, here at creation, against the chosen customer/service.
    const vars = {
      cliente: customerName,
      telefono: customerDetail?.phone ?? null,
      servicio: customerServices.find(s => String(s.id) === serviceId)?.plan ?? null,
      direccion: address.trim() || null,
    };
    const finalTitle = applyTaskVariables(title.trim(), vars);
    const finalDescription = description.trim() ? applyTaskVariables(description.trim(), vars) : null;
    try {
      await onCreate({
        title: finalTitle,
        projectId,
        stageId: firstStageId,
        priority,
        category,
        estimatedHours,
        customerId: customerId || null,
        customerName: customerName || null,
        serviceId: serviceId || null,
        assigneeId: assigneeId || null,
        description: finalDescription,
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
    <div className={styles.overlay} data-testid="create-task-overlay" onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>Nueva tarea</h2>

        {error && <p className={styles.error}>{error}</p>}

        {templates.length > 0 && (
          <label className={styles.label}>
            Aplicar plantilla
            <select className={styles.select} value={templateId} onChange={e => applyTemplate(e.target.value)}>
              <option value="">— Sin plantilla —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        )}

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

        {customerId && (
          <label className={styles.label}>
            Servicio
            <select
              className={styles.select}
              value={serviceId ?? ''}
              onChange={e => setServiceId(e.target.value || null)}
              disabled={customerServices.length === 0}
            >
              <option value="">
                {customerServices.length === 0 ? '— Sin servicios —' : '— Sin servicio —'}
              </option>
              {customerServices.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {s.plan} ({s.type})
                </option>
              ))}
            </select>
          </label>
        )}

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
            <select className={styles.select} value={priority} onChange={e => setPriority(e.target.value)}>
              {priorities.length === 0 && <option value={priority}>{priority}</option>}
              {priorities.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className={styles.label}>
            Categoría
            <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
              {categories.length === 0 && <option value={category}>{category}</option>}
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
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
