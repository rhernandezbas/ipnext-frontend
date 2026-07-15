import { useLayoutEffect, useRef, useState } from 'react';
import { CustomerPicker } from '@/components/molecules/CustomerPicker/CustomerPicker';
import type { CustomerSummary } from '@/types/customer';
import styles from './ManualRecipientsPicker.module.css';

/**
 * Destinatario manual (metadata FE-only para el chip). El contrato con el BE es
 * `manualClientIds: string[]` — el composer deriva los ids de `value`.
 */
export interface ManualRecipient {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  /** Lista controlada de destinatarios manuales. */
  value: ManualRecipient[];
  onChange: (next: ManualRecipient[]) => void;
  /**
   * Ids que el BE reportó como inexistentes (422 MANUAL_RECIPIENTS_NOT_FOUND) —
   * el chip correspondiente se marca como inválido (con TEXTO, nunca solo color).
   */
  invalidIds?: string[];
  /** a11y — id del input de búsqueda para asociar el <label> externo. */
  id?: string;
}

/** ✕ como SVG (nunca emoji-icono) — decorativo, el `aria-label` vive en el botón. */
function RemoveIcon() {
  return (
    <svg className={styles.removeIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Objetivo del foco tras quitar un chip (FIX 3, WCAG 2.4.3). */
type FocusTarget = { type: 'chip'; id: string } | { type: 'input' };

/**
 * ManualRecipientsPicker (manual-recipients-fe, PICK-1/PICK-2) — multi-select de
 * clientes que envuelve el `CustomerPicker` single-select. Cada elección EMPUJA a
 * la lista (dedup por id) y REMONTA el picker interno (`key`) para seguir
 * agregando sin arrastrar el texto anterior. El picker interno queda SIEMPRE en
 * `value={null}` (nunca entra en su modo chip single); los chips los renderiza
 * este wrapper, con el teléfono que llega por el 3er arg del `onChange`. Los
 * ya-agregados se excluyen de los resultados vía `excludeIds`.
 *
 * Controlado (molde `SegmentBuilder`): `CampaignComposer` es dueño de la lista
 * (la necesita para el preview y el create).
 */
export function ManualRecipientsPicker({ value, onChange, invalidIds, id }: Props) {
  const [resetKey, setResetKey] = useState(0);
  const invalid = new Set(invalidIds ?? []);
  const addedIds = value.map((r) => r.id);
  const inputId = id ?? 'manual-recipients-search';
  const count = value.length;

  // FIX 3 (WCAG 2.4.3 Focus Order) — al quitar un chip su ✕ enfocado se
  // desmonta y el foco caería al <body>. Guardamos una ref del ✕ de cada chip
  // por id y, tras el re-render, movemos el foco al destino calculado en
  // `handleRemove` (chip siguiente / anterior / input de búsqueda).
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pendingFocus = useRef<FocusTarget | null>(null);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.type === 'input') {
      document.getElementById(inputId)?.focus();
    } else {
      chipRefs.current.get(target.id)?.focus();
    }
  }, [value, inputId]);

  function handlePick(pickedId: string | null, name: string | null, client?: CustomerSummary) {
    // Remontar el picker interno en cada intento (limpia su typeahead).
    setResetKey((k) => k + 1);
    if (!pickedId) return;
    if (value.some((r) => r.id === pickedId)) return; // dedup por id
    onChange([
      ...value,
      { id: pickedId, name: client?.name ?? name ?? '(cliente)', phone: client?.phone ?? '' },
    ]);
  }

  function handleRemove(recipientId: string) {
    const idx = value.findIndex((r) => r.id === recipientId);
    const next = value.filter((r) => r.id !== recipientId);
    // Foco: al ✕ del chip que ocupa esa posición (el SIGUIENTE); si se quitó el
    // último, al ✕ del ANTERIOR (nuevo último); si la lista quedó vacía, al
    // input de búsqueda.
    if (next.length === 0) {
      pendingFocus.current = { type: 'input' };
    } else {
      const targetIdx = idx < next.length ? idx : next.length - 1;
      pendingFocus.current = { type: 'chip', id: next[targetIdx].id };
    }
    onChange(next);
  }

  return (
    // FIX 7 — <fieldset>/<legend> (como el hermano SegmentBuilder): agrupa el
    // input + la lista de chips y elimina el salto de heading h1→h3 del
    // <section><h3> anterior (1.3.1).
    <fieldset className={styles.wrap}>
      <legend className={styles.title}>Destinatarios manuales</legend>
      <p className={styles.subtitle}>
        Sumá clientes puntuales a la campaña. Se combinan con el segmento, sin duplicados.
      </p>

      <label htmlFor={inputId} className={styles.searchLabel}>Buscar cliente</label>
      <CustomerPicker
        key={resetKey}
        id={inputId}
        value={null}
        valueName={null}
        onChange={handlePick}
        excludeIds={addedIds}
      />

      {/* FIX 4 — ÚNICO live region. role=status (aria-live=polite implícito)
          cubre altas Y bajas (el número siempre cambia). La <ul> de abajo YA NO
          es aria-live (evita el doble anuncio). */}
      <p className={styles.counter} role="status" aria-live="polite">
        {count === 0
          ? 'Sin destinatarios manuales'
          : `${count} destinatario${count === 1 ? '' : 's'} manual${count === 1 ? '' : 'es'}`}
      </p>

      <ul className={styles.chipList} aria-label="Destinatarios manuales agregados">
        {value.map((r) => {
          const isInvalid = invalid.has(r.id);
          return (
            <li key={r.id} className={isInvalid ? `${styles.chip} ${styles.chipInvalid}` : styles.chip}>
              <span className={styles.chipBody}>
                <span className={styles.chipName}>{r.name}</span>
                <span className={styles.chipPhone}>{r.phone || 'sin teléfono'}</span>
                {isInvalid && <span className={styles.chipInvalidTag}>ya no existe</span>}
              </span>
              <button
                ref={(el) => {
                  if (el) chipRefs.current.set(r.id, el);
                  else chipRefs.current.delete(r.id);
                }}
                type="button"
                className={styles.remove}
                aria-label={`Quitar ${r.name}`}
                onClick={() => handleRemove(r.id)}
              >
                <RemoveIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
