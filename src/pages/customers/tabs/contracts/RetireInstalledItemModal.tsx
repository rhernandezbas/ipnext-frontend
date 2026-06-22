import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInventoryTechnicians } from '@/hooks/useServiceInventory';
import { AssetNotInstalledError } from '@/api/serviceInventory.api';
import {
  RETIRE_DISPOSITION_LABELS,
  type RetireDisposition,
  type RetireInstalledItemInput,
  type ServiceInstalledItem,
} from '@/types/serviceInventory';
import styles from './RetireInstalledItemModal.module.css';

interface RetireInstalledItemModalProps {
  /** The item being retired (for the heading / context). */
  item: ServiceInstalledItem;
  /** Driven by the parent mutation. Disables the form while the POST is in flight. */
  saving: boolean;
  /** A parent-level error (e.g. from the mutation) to surface. Optional. */
  error: string | null;
  /**
   * Submit handler. Resolves on success (the modal then closes), or rejects:
   *  - `AssetNotInstalledError` → the modal shows the "ya no figura instalado" message
   *  - any other error          → a generic message
   */
  onRetire: (input: RetireInstalledItemInput) => Promise<void>;
  onClose: () => void;
}

/** Order the radios are shown in. */
const DISPOSITIONS: RetireDisposition[] = ['DEPOSITO', 'TECNICO', 'CLIENTE', 'DAMAGED', 'RETIRED'];

/** Short clarifying hint under each disposition. */
const DISPOSITION_HINTS: Record<RetireDisposition, string> = {
  DEPOSITO: 'Vuelve al stock del depósito.',
  TECNICO: 'Queda en poder de un técnico.',
  CLIENTE: 'El cliente conserva el equipo.',
  DAMAGED: 'Equipo dañado, fuera de servicio.',
  RETIRED: 'Se da de baja del inventario.',
};

/**
 * "Quitar" modal for an installed equipment item. Replaces the plain confirm()
 * with a destination picker: the operator chooses WHERE the equipment goes
 * (disposition), and — only for "Con un técnico" — which technician. An optional
 * free-text note can be attached.
 *
 * Submit is blocked until a technician is chosen when "Con un técnico" is
 * selected (mirrors the BE refine). On the 409 ASSET_NOT_INSTALLED the modal
 * shows a clear message instead of crashing.
 *
 * Patterns match AddByPppoeReviewModal: portal to body, Esc + backdrop close,
 * scroll lock, token-based styling, prefers-reduced-motion.
 */
export function RetireInstalledItemModal({
  item,
  saving,
  error,
  onRetire,
  onClose,
}: RetireInstalledItemModalProps) {
  const titleId = useId();
  const techSelectId = useId();
  const noteId = useId();

  const [disposition, setDisposition] = useState<RetireDisposition>('DEPOSITO');
  const [technicianId, setTechnicianId] = useState<string>('');
  const [note, setNote] = useState('');
  /** Internal error from the submit attempt (e.g. the 409 message). */
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: technicians = [], isLoading: techsLoading } = useInventoryTechnicians();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const requiresTechnician = disposition === 'TECNICO';
  const technicianMissing = requiresTechnician && !technicianId;
  const itemLabel = `${item.type}${item.serialNumber ? ` · ${item.serialNumber}` : ''}`;

  async function handleSubmit() {
    if (technicianMissing || saving) return;
    setSubmitError(null);

    const trimmedNote = note.trim();
    const input: RetireInstalledItemInput = {
      disposition,
      ...(requiresTechnician ? { technicianId } : {}),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };

    try {
      await onRetire(input);
      onClose();
    } catch (err) {
      if (err instanceof AssetNotInstalledError) {
        setSubmitError('El equipo ya no figura instalado; revisá el inventario.');
      } else {
        setSubmitError('No se pudo quitar el equipo. Probá de nuevo.');
      }
    }
  }

  const shownError = submitError ?? error;

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Quitar equipo
            </h2>
            <p className={styles.subtitle}>
              <span className={styles.typeTag}>{item.type}</span>
              <span className={styles.itemMeta}>{itemLabel}</span>
              {' — '}¿a dónde va?
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className={styles.body}>
          <fieldset className={styles.dispositionList}>
            <legend className={styles.srOnly}>Destino del equipo</legend>
            {DISPOSITIONS.map((value) => {
              const id = `retire-disp-${value}`;
              const selected = disposition === value;
              return (
                <label
                  key={value}
                  htmlFor={id}
                  className={`${styles.dispositionRow} ${selected ? styles.dispositionRowSelected : ''}`}
                >
                  <input
                    type="radio"
                    id={id}
                    name="retire-disposition"
                    className={styles.radio}
                    value={value}
                    checked={selected}
                    onChange={() => setDisposition(value)}
                  />
                  <span className={styles.dispositionInfo}>
                    <span className={styles.dispositionLabel}>{RETIRE_DISPOSITION_LABELS[value]}</span>
                    <span className={styles.dispositionHint}>{DISPOSITION_HINTS[value]}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {/* Technician picker — only for "Con un técnico" */}
          {requiresTechnician && (
            <div className={styles.field}>
              <label htmlFor={techSelectId} className={styles.label}>
                Técnico
              </label>
              <select
                id={techSelectId}
                className={styles.control}
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                disabled={techsLoading}
                aria-describedby={technicianMissing ? `${techSelectId}-hint` : undefined}
              >
                <option value="" disabled>
                  {techsLoading ? 'Cargando técnicos…' : 'Elegí un técnico…'}
                </option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {technicianMissing && (
                <span id={`${techSelectId}-hint`} className={styles.fieldHint}>
                  Elegí a qué técnico se le entrega el equipo.
                </span>
              )}
            </div>
          )}

          {/* Optional note */}
          <div className={styles.field}>
            <label htmlFor={noteId} className={styles.label}>
              Nota <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id={noteId}
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Detalle del retiro, motivo, etc."
              rows={3}
              autoComplete="off"
            />
          </div>

          {shownError && (
            <p className={styles.errorBanner} role="alert">
              {shownError}
            </p>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={handleSubmit}
            disabled={saving || technicianMissing}
          >
            {saving ? 'Quitando…' : 'Quitar'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
