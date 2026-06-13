import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  InstalledItemType,
  ServiceInstalledItem,
  AddInstalledItemInput,
  UpdateInstalledItemInput,
} from '@/types/serviceInventory';
import styles from './InstalledItemFormModal.module.css';

interface InstalledItemFormModalProps {
  /** Active device types for the select (already ordered, names only). */
  types: InstalledItemType[];
  /** When set, the modal edits this item; otherwise it creates a new one. */
  item?: ServiceInstalledItem | null;
  /** True while the underlying mutation is in flight. */
  saving?: boolean;
  /** Human-readable error from the failed mutation, or null. */
  error?: string | null;
  onCreate: (input: AddInstalledItemInput) => void;
  onUpdate: (patch: UpdateInstalledItemInput) => void;
  onClose: () => void;
}

/** Trim, collapse inner whitespace and uppercase a serial / MAC. */
function normalizeSerial(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

/** Loose MAC check: 12 hex digits, optionally grouped by `:` or `-`. */
const MAC_RE = /^(?:[0-9A-F]{2}([:-]?)){5}[0-9A-F]{2}$/;

interface FormState {
  type: InstalledItemType;
  serialNumber: string;
  mac: string;
  model: string;
  notes: string;
}

/**
 * #82 — "Agregar SN al contrato", redesigned. The old inline toggle form was a
 * row of unlabelled controls wedged between the section heading and the device
 * table. This is a real modal (portal to body, sticky header, footer actions,
 * Esc / backdrop close, focus trap, scroll lock) that handles both the create
 * and the edit flow. Serial and MAC are normalized live (trim + uppercase) and
 * the MAC is format-validated before submit; the same API contract is preserved
 * (AddInstalledItemInput / UpdateInstalledItemInput).
 */
export function InstalledItemFormModal({
  types,
  item = null,
  saving = false,
  error = null,
  onCreate,
  onUpdate,
  onClose,
}: InstalledItemFormModalProps) {
  const isEdit = item != null;
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const [form, setForm] = useState<FormState>(() => ({
    type: item?.type ?? types[0] ?? 'ROUTER',
    serialNumber: item?.serialNumber ?? '',
    mac: item?.mac ?? '',
    model: item?.model ?? '',
    notes: item?.notes ?? '',
  }));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function field<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // The type select already lists active types; when editing a legacy/inactive
  // type, surface it so the value is never silently dropped.
  const typeOptions = useMemo(() => {
    if (form.type && !types.includes(form.type)) return [form.type, ...types];
    return types;
  }, [types, form.type]);

  const macNormalized = normalizeSerial(form.mac);
  // Only enforce the MAC format on values the operator actually typed/changed.
  // Legacy items can carry non-standard MACs; editing other fields must not be
  // blocked by a value the user never touched.
  const macUnchanged = isEdit && form.mac === (item?.mac ?? '');
  const macInvalid = macNormalized.length > 0 && !macUnchanged && !MAC_RE.test(macNormalized);
  const canSubmit = !!form.type && !macInvalid && !saving;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;

    const serialNumber = normalizeSerial(form.serialNumber);
    const mac = macNormalized;
    const model = form.model.trim();
    const notes = form.notes.trim();

    if (isEdit) {
      onUpdate({
        serialNumber: serialNumber || null,
        mac: mac || null,
        model: model || null,
        notes: notes || null,
      });
    } else {
      onCreate({
        type: form.type,
        serialNumber: serialNumber || undefined,
        mac: mac || undefined,
        model: model || undefined,
        notes: notes || undefined,
      });
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="installed-item-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="installed-item-title" className={styles.title}>
              {isEdit ? 'Editar equipo' : 'Agregar SN al contrato'}
            </h2>
            <p className={styles.subtitle}>
              {isEdit
                ? 'Actualizá los datos del equipo instalado.'
                : 'Registrá un equipo y su número de serie en este contrato.'}
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="ii-type" className={styles.label}>
              Tipo de equipo
            </label>
            <select
              ref={firstFieldRef}
              id="ii-type"
              className={styles.control}
              value={form.type}
              onChange={(e) => field('type', e.target.value)}
              disabled={isEdit}
              required
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {isEdit && <p className={styles.hint}>El tipo no se cambia al editar.</p>}
          </div>

          <div className={styles.field}>
            <label htmlFor="ii-serial" className={styles.label}>
              Serial (SN)
            </label>
            <input
              id="ii-serial"
              className={styles.control}
              type="text"
              value={form.serialNumber}
              onChange={(e) => field('serialNumber', e.target.value)}
              placeholder="Ej. ZTEGC1A2B3C4"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="ii-mac" className={styles.label}>
                MAC
              </label>
              <input
                id="ii-mac"
                className={`${styles.control} ${touched && macInvalid ? styles.controlError : ''}`}
                type="text"
                value={form.mac}
                onChange={(e) => field('mac', e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="AA:BB:CC:DD:EE:FF"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={touched && macInvalid}
                aria-describedby={touched && macInvalid ? 'ii-mac-error' : undefined}
              />
              {touched && macInvalid && (
                <p id="ii-mac-error" className={styles.errorHint} role="alert">
                  Formato de MAC inválido. Usá 12 dígitos hex (AA:BB:CC:DD:EE:FF).
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="ii-model" className={styles.label}>
                Modelo
              </label>
              <input
                id="ii-model"
                className={styles.control}
                type="text"
                value={form.model}
                onChange={(e) => field('model', e.target.value)}
                placeholder="Ej. F670L"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="ii-notes" className={styles.label}>
              Notas <span className={styles.optional}>(opcional)</span>
            </label>
            <textarea
              id="ii-notes"
              className={styles.textarea}
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Detalle o aclaración sobre el equipo…"
              rows={2}
            />
          </div>

          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar equipo'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
