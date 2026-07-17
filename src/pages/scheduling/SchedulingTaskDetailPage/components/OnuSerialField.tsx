import { useEffect, useState } from 'react';
import { useCan } from '@/hooks/useMyPermissions';
import { useUpdateTask } from '@/hooks/useScheduling';
import { useConfirm } from '@/context/ConfirmContext';
import { technologyFamily } from '@/types/recaptacion';
import type { TaskCategory } from '@/types/scheduling';
import styles from './OnuSerialField.module.css';

export interface OnuSerialFieldProps {
  taskId: string;
  taskCategory: TaskCategory;
  contractId: string | null;
  /** Tecnología del contrato vinculado — misma señal que ProvisionOnuSection. */
  contractTechnology?: string | null;
  /** Serial actual de la tarea (normalizado por el BE). Null = sin serial. */
  onuSerial: string | null;
}

/**
 * fiber-serial-fe (K3-FE) — mapeo del error del PUT a copy humano.
 * El contrato K3: 400 VALIDATION_ERROR cuando el serial normalizado (UPPERCASE
 * sin espacios) no da 8-24 alfanumérico. Nada de "Error 400" pelado.
 */
function mapSerialError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number; data?: { code?: string } } }).response;
    if (res?.status === 400 || res?.data?.code === 'VALIDATION_ERROR') {
      return 'Serial inválido — tiene que tener 8 a 24 caracteres alfanuméricos (los espacios y las minúsculas se normalizan solos).';
    }
  }
  return 'No se pudo guardar el serial. Reintentá.';
}

/**
 * fiber-serial-fe (K3-FE) — campo "Serial ONU" del detalle de tarea, junto a la
 * sección "Aprovisionar ONU".
 *
 * Visibilidad: MISMO gate de forma de tarea que ProvisionOnuSection
 * (installation + contrato + señal de tecnología no wireless/cable) pero SIN
 * network.manage: cargar el serial es el paso del TÉCNICO y tiene que verse
 * aunque el aprovisionamiento manual esté vedado para ese usuario (por eso el
 * campo NO vive dentro de ProvisionOnuSection, que retorna null sin permiso).
 *
 * Edición: gate scheduling.write — el mismo permiso que edita el resto de los
 * campos de la tarea (fotos, estado general; el PUT del BE lo exige). Sin
 * permiso el serial se muestra read-only.
 *
 * Guardado: PUT /scheduling/:id con { onuSerial } vía useUpdateTask (instancia
 * propia → isPending propio, sin pisar el estado del guardado de Datos). Se
 * manda el texto CRUDO (se puede pegar "hwtc 1111 2222"); el BE normaliza y el
 * input refleja el valor normalizado que devuelve la respuesta. Limpiar manda
 * null tras un confirm suave (sin tone danger: limpiar un serial es reversible
 * y no toca ONUs reales).
 */
export function OnuSerialField({
  taskId,
  taskCategory,
  contractId,
  contractTechnology,
  onuSerial,
}: OnuSerialFieldProps) {
  const canEdit = useCan('scheduling.write');
  const updateTask = useUpdateTask();
  const confirm = useConfirm();

  const [draft, setDraft] = useState(onuSerial ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // El serial del servidor es el baseline del input: cuando cambia (guardado
  // propio refetcheado, otra sesión), el draft se realinea. No hay edición
  // concurrente rica acá — es UN campo corto; el server gana.
  useEffect(() => {
    setDraft(onuSerial ?? '');
  }, [onuSerial]);

  const family = contractTechnology ? technologyFamily(contractTechnology) : 'other';
  const gateOk =
    taskCategory === 'installation' &&
    !!contractId &&
    family !== 'wireless' &&
    family !== 'cable';

  if (!gateOk) return null;

  const saving = updateTask.isPending;

  async function handleSave() {
    setError(null);
    setSavedMsg(null);
    try {
      const updated = await updateTask.mutateAsync({ id: taskId, data: { onuSerial: draft } });
      // Mostrar el normalizado devuelto sin esperar el refetch de la query.
      const normalized = (updated as { onuSerial?: string | null } | undefined)?.onuSerial;
      if (typeof normalized === 'string') setDraft(normalized);
      setSavedMsg('Serial guardado.');
    } catch (err) {
      setError(mapSerialError(err));
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'Limpiar serial de la ONU',
      message:
        'Se quita el serial cargado en la tarea — el aprovisionamiento automático deja de ' +
        'considerarla hasta que cargues uno nuevo. ¿Limpiarlo?',
      confirmLabel: 'Limpiar serial',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    setError(null);
    setSavedMsg(null);
    try {
      await updateTask.mutateAsync({ id: taskId, data: { onuSerial: null } });
      setDraft('');
      setSavedMsg('Serial limpiado.');
    } catch (err) {
      setError(mapSerialError(err));
    }
  }

  return (
    <section className={styles.section} aria-labelledby="onu-serial-title">
      <h2 id="onu-serial-title" className={styles.title}>
        Serial de la ONU
      </h2>
      <p id="onu-serial-hint" className={styles.hint}>
        Escaneá o tipeá el serial del sticker de la ONU — con esto el sistema la aprovisiona sola
        al conectarse.
      </p>

      {canEdit ? (
        <>
          <div className={styles.row}>
            <label htmlFor="onu-serial-input" className={styles.label}>
              Serial ONU
            </label>
            <div className={styles.controls}>
              <input
                id="onu-serial-input"
                type="text"
                className={styles.input}
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  setError(null);
                  setSavedMsg(null);
                }}
                disabled={saving}
                placeholder="p. ej. HWTC11112222"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'onu-serial-hint onu-serial-error' : 'onu-serial-hint'}
              />
              <button
                type="button"
                className={styles.btnSave}
                onClick={() => void handleSave()}
                disabled={saving || draft.trim().length === 0}
              >
                {saving ? 'Guardando…' : 'Guardar serial'}
              </button>
              {!!onuSerial && (
                <button
                  type="button"
                  className={styles.btnClear}
                  onClick={() => void handleClear()}
                  disabled={saving}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
          {error && (
            <p id="onu-serial-error" className={styles.error} role="alert">
              {error}
            </p>
          )}
          {savedMsg && !error && (
            <p className={styles.success} role="status">
              {savedMsg}
            </p>
          )}
        </>
      ) : (
        <p className={styles.readonly}>
          {onuSerial ? (
            <span className={styles.serialValue}>{onuSerial}</span>
          ) : (
            'Sin serial cargado.'
          )}
        </p>
      )}
    </section>
  );
}
