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
}

interface DatosFormProps {
  initial: DatosFormValues;
  onSubmit: (values: DatosFormValues) => Promise<void>;
  isSaving: boolean;
  admins: SchedulingAssignee[];
  partners: Partner[];
  /** Projects available for reassignment — parent fetches via useProjects() */
  projects?: Project[];
  /** IClass OS code — if set and projectId changes, shows an inline warning */
  iclassOrderCode?: string | null;
  /** The project that was set when the task was last saved (used for warning) */
  originalProjectId?: string | null;
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

export function DatosForm({ initial, onSubmit, isSaving, admins, partners, projects = [], iclassOrderCode, originalProjectId, onDirtyChange }: DatosFormProps) {
  // Fetch contracts for the customer assigned to the task (if any)
  const { data: customerContracts = [] } = useClientContracts(
    initial.customerId ?? '',
    !!initial.customerId,
  );

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
              {[...projects].sort((a, b) => a.title.localeCompare(b.title)).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
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
