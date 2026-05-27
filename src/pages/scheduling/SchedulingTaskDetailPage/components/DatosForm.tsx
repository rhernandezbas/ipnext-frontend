import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Admin } from '@/types/admin';
import type { Partner } from '@/types/partner';
import { useClientServices } from '@/hooks/useCustomers';
import styles from './DatosForm.module.css';

export interface DatosFormValues {
  projectId: string | null;
  assigneeId: string | null;
  partnerId: string | null;
  customerId: string | null;
  serviceId: string | null;
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
  admins: Admin[];
  partners: Partner[];
  /** Notifies parent whenever any field changes vs initial values (REQ-EDIT-3/4) */
  onDirtyChange?: (isDirty: boolean) => void;
}

/** Convert ISO/offset string to datetime-local format "YYYY-MM-DDTHH:mm" */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return iso.slice(0, 16);
  }
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

export function DatosForm({ initial, onSubmit, isSaving, admins, partners, onDirtyChange }: DatosFormProps) {
  // Fetch services for the customer assigned to the task (if any)
  const { data: customerServices = [] } = useClientServices(
    initial.customerId ?? '',
    !!initial.customerId,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setError,
    setValue,
    control,
  } = useForm<DatosFormValues>({
    defaultValues: {
      ...initial,
      startDate: toLocalInput(initial.startDate),
      endDate: toLocalInput(initial.endDate),
    },
  });

  // Watch serviceId to autofill address when the technician changes the service.
  // Precedence: service address > task initial address (customer address fallback).
  const watchedServiceId = useWatch({ control, name: 'serviceId' });
  useEffect(() => {
    if (!watchedServiceId) return;
    const svc = customerServices.find(s => String(s.id) === String(watchedServiceId));
    if (!svc) return;
    if (svc.address) {
      setValue('address', svc.address, { shouldDirty: true });
      if (svc.lat != null && svc.lng != null) {
        setValue('coordinates', { lat: svc.lat, lng: svc.lng }, { shouldDirty: true });
      }
    } else if (initial.address) {
      // Service has no address — fall back to the customer/task address
      setValue('address', initial.address, { shouldDirty: true });
    }
  // Only re-run when the service selection changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedServiceId, customerServices]);

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
      <h2 id="datos-heading" className={styles.sectionTitle}>▣ Datos</h2>
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

          {/* Servicio */}
          <div className={styles.field}>
            <label htmlFor="serviceId" className={styles.label}>Servicio</label>
            <select
              id="serviceId"
              className={styles.select}
              disabled={!initial.customerId || customerServices.length === 0}
              {...register('serviceId')}
            >
              <option value="">
                {!initial.customerId
                  ? 'Sin cliente asignado'
                  : customerServices.length === 0
                    ? 'Sin servicios'
                    : 'Sin servicio'}
              </option>
              {customerServices.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {s.plan} ({s.type})
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
              {...register('endDate')}
            />
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
