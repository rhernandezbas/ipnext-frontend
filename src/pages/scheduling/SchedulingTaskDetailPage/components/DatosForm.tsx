import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Partner } from '@/types/partner';

/**
 * Minimal structural shape used by the assignee picker.
 * Matches both legacy Admin and the new RbacUser DTO — only id+name
 * are needed for the select.
 */
type SchedulingAssignee = { id: string; name: string };
import type { Project } from '@/types/project';
import { useClientContracts } from '@/hooks/useCustomers';
import { useIClassNodes } from '@/hooks/useIClassNodes';
import { buildContractLabel } from '@/lib/buildContractLabel';
import styles from './DatosForm.module.css';

export interface DatosFormValues {
  projectId: string | null;
  assigneeId: string | null;
  partnerId: string | null;
  customerId: string | null;
  contractId: string | null;
  /** ISO 8601 or datetime-local string */
  startDate: string | null;
  /** ISO 8601 or datetime-local string */
  endDate: string | null;
  travelTimeTo: number | null;
  travelTimeFrom: number | null;
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  /** IClass city/locality code — editable on network+fibra tasks (#3 tech-debt). */
  iclassCityCode?: string | null;
}

interface DatosFormProps {
  initial: DatosFormValues;
  onSubmit: (values: DatosFormValues) => Promise<void>;
  isSaving: boolean;
  admins: SchedulingAssignee[];
  partners: Partner[];
  /** Projects available for reassignment — parent fetches via useProjects() */
  projects?: Project[];
  /** Task kind (#40) — filters the project select so a customer task only ever
   *  offers customer projects and a network task only ever offers network ones.
   *  Mirrors the create modal + the BE UpdateTask guard. Omitted ⇒ no filter
   *  (back-compat with callers that pre-date #40). */
  kind?: 'customer' | 'network';
  /** IClass OS code — if set and projectId changes, shows an inline warning */
  iclassOrderCode?: string | null;
  /** The project that was set when the task was last saved (used for warning) */
  originalProjectId?: string | null;
  /** Network branch type — determines whether the locality field is shown.
   *  Only 'fibra' tasks show the iclassCityCode select (feature #54/#66). */
  networkType?: 'red' | 'fibra' | null;
  /** Notifies parent whenever any field changes vs initial values (REQ-EDIT-3/4) */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Convert ISO/offset string to datetime-local format "YYYY-MM-DDTHH:mm" in LOCAL time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return toLocalInputString(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

/** Format a Date as "YYYY-MM-DDTHH:mm" in local time (datetime-local input format). */
function toLocalInputString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert datetime-local string to ISO 8601 */
function toIso(local: string): string | null {
  if (!local) return null;
  try {
    return new Date(local).toISOString();
  } catch {
    return null;
  }
}

export function DatosForm({ initial, onSubmit, isSaving, admins, partners, projects = [], kind, iclassOrderCode, originalProjectId, networkType, onDirtyChange }: DatosFormProps) {
  // Localidad (iclassCityCode) is only editable on network+fibra tasks (#3 tech-debt, #54/#66).
  const showLocalidad = kind === 'network' && networkType === 'fibra';
  // Filter the project select by the task's kind (#40 FIX-3). A customer task
  // only ever offers customer projects; a network task only ever offers network
  // ones. Omitted kind ⇒ no filter (back-compat). Mirror of CreateTaskModal +
  // the BE UpdateTask guard, so reassignment can never trip the 422.
  const selectableProjects =
    kind === 'network'
      ? projects.filter(p => p.isNetworkProject === true)
      : kind === 'customer'
        ? projects.filter(p => !p.isNetworkProject)
        : projects;

  // Keep the task's CURRENT project VISIBLE even when the kind filter excludes
  // it. Without this, a customer task whose project was later flagged
  // isNetworkProject=true (or a network task whose project lost the flag) would
  // render the placeholder while RHF silently holds the stale id — saving any
  // field re-submits the out-of-kind projectId and the BE answers 422
  // INVALID_PROJECT_KIND, leaving the task un-editable with an empty-looking
  // field. We pin the current project to the option list marked "(fuera de
  // tipo)" so the value stays selectable/valid and the user can consciously
  // re-pick a valid one. The option is NOT disabled on purpose: the value must
  // remain a legal select value so the DOM and the form stay in sync.
  const currentProjectInList = initial.projectId
    ? projects.find(p => p.id === initial.projectId)
    : undefined;
  const currentProjectExcluded =
    currentProjectInList != null &&
    !selectableProjects.some(p => p.id === currentProjectInList.id);
  const projectOptions: Array<{ id: string; label: string }> = [
    ...selectableProjects.map(p => ({ id: p.id, label: p.title })),
    ...(currentProjectExcluded && currentProjectInList
      ? [{ id: currentProjectInList.id, label: `${currentProjectInList.title} (fuera de tipo)` }]
      : []),
  ];
  // Fetch contracts for the customer assigned to the task (if any)
  const { data: customerContracts = [] } = useClientContracts(
    initial.customerId ?? '',
    !!initial.customerId,
  );

  // IClass node catalog — fetched unconditionally (useIClassNodes has no `enabled` param;
  // adding one would require changing the shared hook and all its callers, out of scope here).
  // Filtering for eligibility (active && selectable) matches CreateTaskModal's approach.
  const { data: iclassNodes = [] } = useIClassNodes();
  const localidadOptions = showLocalidad
    ? iclassNodes.filter(n => n.active && n.selectable)
    : [];

  // #3-F1: if the task's current iclassCityCode is NOT in the filtered catalog
  // (e.g. the node was deactivated after the task was created), add a fallback
  // option so the select renders it and doesn't silently reset to '' → null on save.
  const currentCityNotInCatalog =
    showLocalidad &&
    !!initial.iclassCityCode &&
    !localidadOptions.some(n => n.code === initial.iclassCityCode);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
    setValue,
    getValues,
    control,
  } = useForm<DatosFormValues>({
    defaultValues: {
      ...initial,
      startDate: toLocalInput(initial.startDate),
      endDate: toLocalInput(initial.endDate),
      iclassCityCode: initial.iclassCityCode ?? null,
    },
  });

  // Hydrate the contract <select> with the task's initial contractId ONCE the
  // contracts finish loading. On mount customerContracts is empty (async query),
  // so the matching <option> doesn't exist yet and react-hook-form's
  // defaultValue silently falls back to "Sin contrato". Re-apply the value when
  // the options arrive. Ref-guarded so it runs only once and never clobbers a
  // selection the technician makes afterwards.
  const hydratedContractRef = useRef(false);
  useEffect(() => {
    if (hydratedContractRef.current) return;
    if (!initial.contractId) return;
    if (customerContracts.some(s => String(s.id) === String(initial.contractId))) {
      setValue('contractId', String(initial.contractId));
      hydratedContractRef.current = true;
    }
  }, [customerContracts, initial.contractId, setValue]);

  // Same hydration race for the Asignado + Proyecto selects: on a cold refresh
  // the admins/projects queries resolve AFTER mount, so their <option>s don't
  // exist yet and RHF's defaultValue silently falls back to the empty option.
  // Re-apply the value once the options arrive (ref-guarded, runs once each,
  // never clobbers a later manual selection). Fixes #2 (refresh drops both).
  const hydratedAssigneeRef = useRef(false);
  useEffect(() => {
    if (hydratedAssigneeRef.current) return;
    if (!initial.assigneeId) return;
    if (admins.some(a => a.id === initial.assigneeId)) {
      setValue('assigneeId', initial.assigneeId);
      hydratedAssigneeRef.current = true;
    }
  }, [admins, initial.assigneeId, setValue]);

  const hydratedProjectRef = useRef(false);
  useEffect(() => {
    if (hydratedProjectRef.current) return;
    if (!initial.projectId) return;
    if (projects.some(p => p.id === initial.projectId)) {
      setValue('projectId', initial.projectId);
      hydratedProjectRef.current = true;
    }
  }, [projects, initial.projectId, setValue]);

  // Hydrate iclassCityCode when the node catalog arrives async. Same ref-guarded
  // pattern as contracts/assignee/project — prevents the async options race from
  // silently resetting the select to "Sin localidad". Runs only when the field
  // is visible (network+fibra tasks) and only once per mount (#3 tech-debt).
  // #3-F1: also fires when the node is NOT in the catalog (fallback option) so
  // the select is pre-populated and the value isn't lost on save.
  const hydratedLocalidadRef = useRef(false);
  useEffect(() => {
    if (!showLocalidad) return;
    if (hydratedLocalidadRef.current) return;
    if (!initial.iclassCityCode) return;
    // Fire when: (a) the code is in the eligible catalog, OR (b) the catalog has
    // finished loading (iclassNodes resolved) and the fallback option is shown.
    const inCatalog = localidadOptions.some(n => n.code === initial.iclassCityCode);
    const fallbackReady = currentCityNotInCatalog && iclassNodes.length >= 0;
    if (inCatalog || fallbackReady) {
      setValue('iclassCityCode', initial.iclassCityCode);
      hydratedLocalidadRef.current = true;
    }
  }, [localidadOptions, iclassNodes, initial.iclassCityCode, showLocalidad, currentCityNotInCatalog, setValue]);

  // Watch projectId to compute the IClass warning inline.
  const currentProjectId = useWatch({ control, name: 'projectId' });
  const showIClassWarning = (iclassOrderCode ?? null) != null && currentProjectId !== originalProjectId;

  // Watch contractId to autofill address when the technician changes the contract.
  // Precedence: contract address > task initial address (customer address fallback).
  const watchedContractId = useWatch({ control, name: 'contractId' });
  useEffect(() => {
    if (!watchedContractId) return;
    const svc = customerContracts.find(s => String(s.id) === String(watchedContractId));
    if (!svc) return;
    if (svc.address) {
      setValue('address', svc.address, { shouldDirty: true });
      if (svc.lat != null && svc.lng != null) {
        setValue('coordinates', { lat: svc.lat, lng: svc.lng }, { shouldDirty: true });
      }
    } else if (initial.address) {
      // Contract has no address — fall back to the customer/task address
      setValue('address', initial.address, { shouldDirty: true });
    }
  // Only re-run when the contract selection changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedContractId, customerContracts]);

  // Watch startDate to drive end-date UX: disable End while Start is empty, and
  // auto-default End to Start + 1h when End is empty. If End already has a value
  // (initial or user-edited), leave it alone — the user owns it.
  const watchedStartDate = useWatch({ control, name: 'startDate' });
  useEffect(() => {
    if (!watchedStartDate) return;
    const currentEnd = getValues('endDate');
    if (currentEnd) return; // respect existing End value
    const start = new Date(watchedStartDate);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setValue('endDate', toLocalInputString(end), { shouldDirty: true, shouldValidate: false });
    // Only re-run when startDate changes. setValue/getValues are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedStartDate]);

  // Bubble react-hook-form's dirty state up to the parent so confirm-on-leave covers
  // every Datos field (assignee/dates/partner/travel) — not just the map override.
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onValid = async (data: DatosFormValues) => {
    // Validate endDate >= startDate
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate).getTime();
      const end = new Date(data.endDate).getTime();
      if (end < start) {
        setError('endDate', { message: 'Fecha de fin debe ser mayor o igual a la de inicio' });
        return;
      }
    }
    // Convert datetime-local to ISO
    const payload: DatosFormValues = {
      ...data,
      startDate: data.startDate ? toIso(data.startDate) : null,
      endDate: data.endDate ? toIso(data.endDate) : null,
      travelTimeTo: data.travelTimeTo ? Number(data.travelTimeTo) : null,
      travelTimeFrom: data.travelTimeFrom ? Number(data.travelTimeFrom) : null,
      // Only include iclassCityCode when the field is visible; otherwise preserve
      // the existing value from initial so the PATCH doesn't wipe it.
      iclassCityCode: showLocalidad
        ? (data.iclassCityCode || null)
        : (initial.iclassCityCode ?? null),
    };
    await onSubmit(payload);
  };

  return (
    <section className={styles.section} aria-labelledby="datos-heading">
      <h2 id="datos-heading" className={styles.sectionTitle}>Datos</h2>
      <form onSubmit={(e) => { void handleSubmit(onValid)(e); }} noValidate>
        <div className={styles.grid}>
          {/* Asignado a */}
          <div className={styles.field}>
            <label htmlFor="assigneeId" className={styles.label}>Asignado a</label>
            <select id="assigneeId" className={styles.select} {...register('assigneeId')}>
              <option value="">Sin asignar</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Partner */}
          <div className={styles.field}>
            <label htmlFor="partnerId" className={styles.label}>Partner</label>
            <select id="partnerId" className={styles.select} {...register('partnerId')}>
              <option value="">Sin partner</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Proyecto */}
          <div className={styles.field}>
            <label htmlFor="projectId" className={styles.label}>Proyecto</label>
            <select
              id="projectId"
              className={styles.select}
              {...register('projectId', { required: 'Proyecto requerido' })}
            >
              <option value="">Seleccionar proyecto…</option>
              {[...projectOptions].sort((a, b) => a.label.localeCompare(b.label)).map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {showIClassWarning && (
              <p className={styles.iclassWarning}>
                Esta tarea ya tiene OS en IClass. El cambio no afecta la OS creada.
              </p>
            )}
            {errors.projectId && (
              <span className={styles.error} role="alert">{errors.projectId.message}</span>
            )}
          </div>

          {/* Contrato */}
          <div className={styles.field}>
            <label htmlFor="contractId" className={styles.label}>Contrato</label>
            <select
              id="contractId"
              className={styles.select}
              disabled={!initial.customerId || customerContracts.length === 0}
              {...register('contractId')}
            >
              <option value="">
                {!initial.customerId
                  ? 'Sin cliente asignado'
                  : customerContracts.length === 0
                    ? 'Sin contratos'
                    : 'Sin contrato'}
              </option>
              {customerContracts.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {buildContractLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Localidad (iclassCityCode) — solo para tareas de nodo fibra (#3 tech-debt, #54/#66) */}
          {showLocalidad && (
            <div className={styles.field}>
              <label htmlFor="iclassCityCode" className={styles.label}>Localidad</label>
              <select
                id="iclassCityCode"
                className={styles.select}
                {...register('iclassCityCode')}
              >
                <option value="">Sin localidad</option>
                {/* #3-F1: fallback option when the current code is no longer in the
                    active catalog (node deactivated post-creation). Keeps the value
                    visible and prevents a silent null on save. */}
                {currentCityNotInCatalog && (
                  <option value={initial.iclassCityCode!}>{initial.iclassCityCode}</option>
                )}
                {localidadOptions.map(n => (
                  <option key={n.id} value={n.code}>
                    {n.code} — {n.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Inicia */}
          <div className={styles.field}>
            <label htmlFor="startDate" className={styles.label}>Inicia</label>
            <input
              id="startDate"
              className={styles.input}
              type="datetime-local"
              {...register('startDate')}
            />
            {errors.startDate && (
              <span className={styles.error} role="alert">{errors.startDate.message}</span>
            )}
          </div>

          {/* Termina */}
          <div className={styles.field}>
            <label htmlFor="endDate" className={styles.label}>Termina</label>
            <input
              id="endDate"
              className={styles.input}
              type="datetime-local"
              disabled={!watchedStartDate}
              aria-describedby={!watchedStartDate ? 'endDate-hint' : undefined}
              {...register('endDate')}
            />
            {!watchedStartDate && (
              <span id="endDate-hint" className={styles.hint}>
                Primero indicá la fecha de inicio
              </span>
            )}
            {errors.endDate && (
              <span className={styles.error} role="alert">{errors.endDate.message}</span>
            )}
          </div>

          {/* Tiempo de ida */}
          <div className={styles.field}>
            <label htmlFor="travelTimeTo" className={styles.label}>Tiempo de ida (min)</label>
            <input
              id="travelTimeTo"
              className={styles.input}
              type="number"
              min={0}
              step={1}
              {...register('travelTimeTo', { min: { value: 0, message: 'Debe ser 0 o mayor' } })}
            />
            {errors.travelTimeTo && (
              <span className={styles.error} role="alert">{errors.travelTimeTo.message}</span>
            )}
          </div>

          {/* Tiempo de vuelta */}
          <div className={styles.field}>
            <label htmlFor="travelTimeFrom" className={styles.label}>Tiempo de vuelta (min)</label>
            <input
              id="travelTimeFrom"
              className={styles.input}
              type="number"
              min={0}
              step={1}
              {...register('travelTimeFrom', { min: { value: 0, message: 'Debe ser 0 o mayor' } })}
            />
            {errors.travelTimeFrom && (
              <span className={styles.error} role="alert">{errors.travelTimeFrom.message}</span>
            )}
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={isSaving}
            aria-label={isSaving ? 'Guardando cambios' : 'Guardar cambios'}
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  );
}
