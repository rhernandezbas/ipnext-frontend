import { useEffect, useMemo, useRef, useState } from 'react';
import { useClientDetail, useClientContracts } from '@/hooks/useCustomers';
import { buildContractLabel } from '@/lib/buildContractLabel';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';

type SchedulingAssignee = { id: string; name: string };
import type { TaskTemplate } from '@/types/taskTemplate';
import type { CreateTaskPayload } from '@/types/scheduling';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import { useConfirm } from '@/context/ConfirmContext';
import { CustomerPicker } from './CustomerPicker';
import { NodeSelector } from '@/components/NodeSelector';
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

/** Optional seed values when the modal is opened from another entity (e.g. a
 *  ticket). Only prefills "soft" fields — NEVER the required contract, so the
 *  operator must still consciously pick a contract before submitting. */
export interface CreateTaskInitialValues {
  title?: string;
  customerId?: string;
  customerName?: string;
  description?: string;
  /** Pre-selected start datetime as a "YYYY-MM-DDTHH:mm" local string (e.g. from
   *  a calendar slot click). Soft field — never the required contract. */
  startDate?: string;
  /** Pre-selected assignee id (e.g. the technician row of a calendar slot). */
  assigneeId?: string;
  /** Originating ticket id, appended to the payload as-is (BE-graceful). */
  ticketId?: string | null;
}

interface Props {
  projects: Project[];
  workflows: Workflow[];
  technicians?: SchedulingAssignee[];
  templates?: TaskTemplate[];
  onClose: () => void;
  onCreate: (data: CreateTaskPayload) => Promise<unknown>;
  loading: boolean;
  initialValues?: CreateTaskInitialValues;
  /** When set, the modal opens in this mode AND the mode toggle is hidden (mode
   *  locked). Used by the Tareas Nodos page to force network mode. Absent ⇒
   *  current behaviour (toggle visible, starts in 'customer'). */
  defaultMode?: 'customer' | 'network';
}

/** First stage (lowest order) of the project's workflow, or undefined if the
 *  project has no workflow / the workflow has no stages. */
function resolveFirstStageId(project: Project | undefined, workflows: Workflow[]): string | undefined {
  const wf = workflows.find(w => w.id === project?.workflowId);
  if (!wf || wf.stages.length === 0) return undefined;
  return [...wf.stages].sort((a, b) => a.order - b.order)[0].id;
}

/** Convert a datetime-local string ("YYYY-MM-DDTHH:mm") to ISO 8601 with offset,
 *  as required by the backend (z.string().datetime({ offset: true })). */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Format a Date as "YYYY-MM-DDTHH:mm" in LOCAL time (datetime-local input format). */
function toLocalInputString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Full create-task form (cliente con buscador, descripción, asignado, fecha,
 * dirección, notas). The task always starts on the FIRST stage (lowest order)
 * of the selected project's workflow — the backend persistence layer requires a
 * valid stageId, so we resolve one here instead of relying on a server-side
 * default that doesn't exist.
 */
export function CreateTaskModal({ projects, workflows, technicians = [], templates = [], onClose, onCreate, loading, initialValues, defaultMode }: Props) {
  /** When a defaultMode is provided the mode is LOCKED and a "Nodo RED" badge is
   *  shown. Node tasks are created ONLY from the Tareas Nodos page (#40b fix-a). */
  const modeLocked = defaultMode != null;
  /** Task mode: 'customer' (default) or 'network'. No longer user-togglable — the
   *  network branch is reached only via defaultMode='network' from the Nodos page. */
  const taskMode: 'customer' | 'network' = defaultMode ?? 'customer';
  /** Selected network site id for network tasks. */
  const [networkSiteId, setNetworkSiteId] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [projectId, setProjectId] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(initialValues?.customerId ?? null);
  const [customerName, setCustomerName] = useState<string | null>(initialValues?.customerName ?? null);
  // NOTE: contractId is INTENTIONALLY never seeded — the operator must pick the
  // required contract themselves even when creating a task from a ticket.
  const [contractId, setContractId] = useState<string | null>(null);
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? '');
  const [priority, setPriority] = useState<string>(DEFAULT_PRIORITY);
  const { data: priorities = [] } = useTaskPriorities();
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const { data: categories = [] } = useTaskCategories();
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? '');
  const [endDate, setEndDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  // When a customer is picked, pull its detail and auto-fill the address with the
  // customer's address. Fill once per customer (ref guard) so we don't clobber a
  // manual edit on re-render / background refetch.
  const { data: customerDetail } = useClientDetail(customerId ?? '');
  // Contracts of the selected customer
  const { data: customerContracts = [], isLoading: contractsLoading } = useClientContracts(customerId ?? '', !!customerId);
  const filledForCustomer = useRef<string | null>(null);
  useEffect(() => {
    if (!customerId) { filledForCustomer.current = null; return; }
    if (
      customerDetail &&
      String(customerDetail.id) === String(customerId) &&
      filledForCustomer.current !== String(customerId)
    ) {
      filledForCustomer.current = String(customerId);
      // Only use customer address as fallback when no contract is selected yet
      if (!contractId && customerDetail.address) setAddress(customerDetail.address);
    }
  }, [customerId, customerDetail, contractId]);

  // ── Network-site address prefill (#40) ───────────────────────────────────────
  // When a NetworkSite is selected in network mode, prefill the address from the
  // already-cached site list (same query key NodeSelector fetches — zero new
  // endpoints). Ref-guarded (mirror of filledForCustomer) so a manual edit is
  // never clobbered on re-render/background refetch. Editable.
  const { data: networkSites = [] } = useNetworkSites();
  const filledForSite = useRef<string | null>(null);
  useEffect(() => {
    if (taskMode !== 'network') return;
    if (!networkSiteId) { filledForSite.current = null; return; }
    if (filledForSite.current === networkSiteId) return;
    const site = networkSites.find(s => s.id === networkSiteId);
    if (!site) return;
    filledForSite.current = networkSiteId;
    // site.address may be empty — only the address pre-fills (city is metadata,
    // not part of the work address). Empty address ⇒ leave the field empty.
    setAddress(site.address ?? '');
  }, [taskMode, networkSiteId, networkSites]);

  // When a contract is explicitly chosen, autofill address from the contract
  // (contract > customer precedence). If the contract has no address, fall back
  // to the customer address.
  useEffect(() => {
    if (!contractId) {
      // Contract deselected — restore customer address if available
      if (customerDetail?.address) setAddress(customerDetail.address);
      else setAddress('');
      return;
    }
    const svc = customerContracts.find(s => String(s.id) === contractId);
    if (svc) {
      // Contract has an address → use it (overrides whatever was there)
      if (svc.address) {
        setAddress(svc.address);
      } else {
        // Contract has no address → fallback to customer address
        if (customerDetail?.address) setAddress(customerDetail.address);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  // Reset contract when customer changes
  useEffect(() => {
    setContractId(null);
  }, [customerId]);

  // When the user sets Start (or its time) and End is still empty, default End
  // to Start + 1h. If End already has a value, leave it alone — the user owns
  // it. Same UX as DatosForm (task detail page).
  useEffect(() => {
    if (!startDate) return;
    if (endDate) return; // respect existing End value
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEndDate(toLocalInputString(end));
    // Intentionally only run when startDate changes — re-running on endDate
    // would clobber the user's manual edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  // Any meaningful field the user has touched (defaults like project/priority/
  // category don't count). Used to guard against discarding work on an
  // accidental backdrop click.
  const hasData =
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    !!customerId ||
    !!contractId ||
    !!networkSiteId ||
    assigneeId.length > 0 ||
    startDate.length > 0 ||
    endDate.length > 0 ||
    address.trim().length > 0 ||
    notes.trim().length > 0;

  // Backdrop click: only discard silently when the form is empty. With data,
  // confirm first so a stray click outside the modal doesn't wipe the work.
  // The explicit Cancel button bypasses this (it's a deliberate action).
  async function handleBackdropClick() {
    if (hasData && !(await confirm({ message: 'Tenés datos sin guardar. ¿Cerrar y descartar la tarea?', confirmLabel: 'Descartar' }))) {
      return;
    }
    onClose();
  }

  const selectedProject = projects.find(p => p.id === projectId);
  const firstStageId = useMemo(
    () => resolveFirstStageId(selectedProject, workflows),
    [workflows, selectedProject],
  );

  const canSave =
    title.trim().length > 0 &&
    !!projectId &&
    !!firstStageId &&
    description.trim().length > 0 &&
    !loading &&
    (taskMode === 'customer'
      ? !!customerId && !!contractId
      : !!networkSiteId);

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
    if (!description.trim()) {
      setError('La descripción es obligatoria.');
      return;
    }
    if (!firstStageId) {
      setError('El proyecto seleccionado no tiene estados configurados.');
      return;
    }
    setError(null);
    // Validate end >= start when both are present
    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
        setError('La fecha de fin debe ser mayor o igual a la de inicio.');
        return;
      }
    }
    // Resolve merge variables ({{cliente}}, {{telefono}}, {{contrato}}, {{servicio}},
    // {{direccion}}) once, here at creation, against the chosen customer/contract.
    const resolvedContract = customerContracts.find(s => String(s.id) === contractId) ?? null;
    const contratoLabel = resolvedContract ? buildContractLabel(resolvedContract) : null;
    const vars = {
      cliente: customerName,
      telefono: customerDetail?.phone ?? null,
      contrato: contratoLabel,
      servicio: contratoLabel, // backward compat: {{servicio}} resolves to contract label
      direccion: address.trim() || null,
    };
    const finalTitle = applyTaskVariables(title.trim(), vars);
    const finalDescription = description.trim() ? applyTaskVariables(description.trim(), vars) : null;
    try {
      const basePayload = {
        title: finalTitle,
        projectId,
        stageId: firstStageId,
        priority,
        category,
        estimatedHours,
        assigneeId: assigneeId || null,
        description: finalDescription,
        startDate: toIso(startDate),
        endDate: toIso(endDate),
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      const payload: CreateTaskPayload =
        taskMode === 'network'
          ? {
              ...basePayload,
              kind: 'network',
              networkSiteId: networkSiteId || null,
              customerId: null,
              customerName: null,
              contractId: null,
            }
          : {
              ...basePayload,
              kind: 'customer',
              customerId: customerId || null,
              customerName: customerName || null,
              contractId: contractId || null,
            };

      // Append ticketId ONLY when present so the payload stays clean for the
      // normal create flow (BE-graceful until tickets-actions-be ships).
      if (initialValues?.ticketId != null) {
        payload.ticketId = initialValues.ticketId;
      }
      await onCreate(payload);
      onClose();
    } catch (err) {
      // Surface the backend validation message when present (e.g. a 400
      // VALIDATION_ERROR). Falls back to a generic message otherwise. This catch
      // is what keeps a failed create from bubbling up as an uncaught rejection.
      const resp = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      setError(resp?.error ?? resp?.message ?? 'No se pudo crear la tarea. Revisá los datos e intentá de nuevo.');
    }
  }

  return (
    <div className={styles.overlay} data-testid="create-task-overlay" onClick={() => void handleBackdropClick()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Nueva tarea" onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>Nueva tarea</h2>
          {/* RED mode badge — node tasks are created ONLY from the Tareas Nodos
              page, which locks the mode (defaultMode='network'). A static badge
              shows the context. In customer context (no defaultMode) the modal is
              customer-ONLY: no toggle, no path to network mode (#40b fix-a, was the
              #29 segmented control). */}
          {modeLocked && (
            <span className={styles.modeBadge} data-variant="network" aria-label="Tipo de tarea: Nodo RED">
              Nodo RED
            </span>
          )}
        </div>

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
          {/* #21 — text + * share one wrapper: .label is a flex column, so as
              separate children the asterisk stacked on its own line. */}
          <span>Título <span className={styles.required} aria-hidden="true">*</span></span>
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título de la tarea"
            autoFocus
          />
        </label>

        {taskMode === 'customer' ? (
          <>
            <div className={styles.label}>
              <span>Cliente <span className={styles.required} aria-hidden="true">*</span></span>
              <CustomerPicker
                value={customerId}
                valueName={customerName}
                onChange={(id, name) => { setCustomerId(id); setCustomerName(name); }}
              />
            </div>

            {customerId && (
              <label className={styles.label}>
                <span>Contrato <span className={styles.required} aria-hidden="true">*</span></span>
                <select
                  className={styles.select}
                  value={contractId ?? ''}
                  onChange={e => setContractId(e.target.value || null)}
                  disabled={contractsLoading || customerContracts.length === 0}
                >
                  <option value="">
                    {contractsLoading ? '— Cargando contratos… —' : '— Sin contrato —'}
                  </option>
                  {customerContracts.map(s => (
                    <option key={s.id} value={String(s.id)}>
                      {buildContractLabel(s)}
                    </option>
                  ))}
                </select>
                {!contractsLoading && customerContracts.length === 0 && (
                  <span className={styles.hint}>Este cliente no tiene contratos activos. No se puede crear la tarea.</span>
                )}
              </label>
            )}
          </>
        ) : (
          <div className={styles.label}>
            <span>Nodo de red <span className={styles.required} aria-hidden="true">*</span></span>
            <NodeSelector value={networkSiteId} onChange={setNetworkSiteId} />
          </div>
        )}

        <label className={styles.label}>
          <span>Descripción <span className={styles.required} aria-hidden="true">*</span></span>
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
            <span>Proyecto <span className={styles.required} aria-hidden="true">*</span></span>
            <select
              className={styles.select}
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              aria-label="Proyecto"
              disabled={projects.length === 0}
            >
              <option value="">— Seleccionar proyecto —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            {projects.length === 0 && (
              <span className={styles.hint}>
                {taskMode === 'network'
                  ? 'No hay proyectos de red configurados. Marcá un proyecto en Scheduling → Configuración → Proyectos de red.'
                  : 'No hay proyectos disponibles.'}
              </span>
            )}
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
            Inicia
            <input
              className={styles.input}
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>

          <div className={styles.label}>
            <label htmlFor="create-task-end-date">Termina</label>
            <input
              id="create-task-end-date"
              className={styles.input}
              type="datetime-local"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              disabled={!startDate}
              aria-describedby={!startDate ? 'create-end-hint' : undefined}
            />
            {!startDate && (
              <span id="create-end-hint" className={styles.hint}>
                Primero indicá la fecha de inicio
              </span>
            )}
          </div>
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
