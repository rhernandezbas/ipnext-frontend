import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import styles from './CannedResponsePicker.module.css';

interface CannedResponsePickerProps {
  /** Elegir una respuesta → se inserta su `content` en el composer (el padre decide dónde/cómo). */
  onSelect: (content: string) => void;
  /** Cerrar el popover (Esc, click afuera, elegir). El padre devuelve el foco al textarea. */
  onClose: () => void;
}

const LISTBOX_ID = 'canned-response-listbox';

/**
 * CannedResponsePicker (Ola 4 — respuestas rápidas / macros) — popover del
 * composer con la lista de respuestas rápidas, filtrable, que INSERTA el
 * `content` elegido en el textarea. Estilo Chatwoot: se abre al tipear "/" al
 * inicio del textarea vacío o con el botón 💬 del composer.
 *
 * Patrón WAI-ARIA APG "Combobox con listbox popup": un `<input role="combobox">`
 * (que recibe el foco al abrir) filtra la lista; `<ul role="listbox">` con
 * `<li role="option">`. La opción activa (teclado/mouse) se comunica vía
 * `aria-activedescendant` — el foco NUNCA sale del input (no hay roving
 * tabindex). Teclado: ↑/↓ mueven el activo, Enter elige, Esc cierra.
 *
 * DECISIÓN UX: el filtro es un input PROPIO del popover (no se sigue tipeando en
 * el textarea) — más accesible y testeable que hijackear el textarea, y deja el
 * "/" intacto en el textarea para que el padre lo reemplace al elegir. El foco
 * salta al input al abrir; al cerrar, el padre lo devuelve al textarea.
 *
 * FILTRO CLIENT-SIDE sobre el catálogo completo (matchea shortcut O content,
 * case-insensitive) — coherente con `useCannedResponses` como catálogo cacheado
 * (design Ola 4: no un `?q=` server-side por tecla).
 *
 * VARIABLES v1: si el `content` trae `{{variables}}`, se insertan LITERALES (no
 * se resuelven en v1) — documentado, es el contrato acordado.
 */
export function CannedResponsePicker({ onSelect, onClose }: CannedResponsePickerProps) {
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useCannedResponses(true);
  const all = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (q.length === 0) return all;
    return all.filter(
      (r) => r.shortcut.toLowerCase().includes(q) || r.content.toLowerCase().includes(q),
    );
  }, [all, filter]);

  // El activo se resetea al tope cada vez que cambia el conjunto filtrado — así
  // ↓/Enter siempre operan sobre una opción visible (nunca un índice colgado
  // fuera de rango tras filtrar).
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Foco al input al abrir (existir == estar abierto — el padre monta/desmonta).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Click afuera cierra (el popover no es modal — no atrapa el foco de la página).
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  function optionId(idx: number) {
    return `${LISTBOX_ID}-option-${idx}`;
  }

  function choose(idx: number) {
    const r = filtered[idx];
    if (!r) return;
    onSelect(r.content);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
        break;
      case 'Enter':
        e.preventDefault();
        choose(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        // Corta la burbuja: sin esto, un listener de Escape a nivel document
        // (p. ej. un modal ancestro) también reaccionaría (mismo criterio que
        // el Select propio del repo).
        e.stopPropagation();
        onClose();
        break;
      default:
        break;
    }
  }

  const showEmpty = !isLoading && !isError && all.length === 0;
  const showNoMatch = !isLoading && !isError && all.length > 0 && filtered.length === 0;

  return (
    <div className={styles.popover} ref={wrapperRef} data-testid="canned-response-picker">
      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          /
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className={styles.search}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar respuesta rápida…"
          aria-label="Buscar respuesta rápida"
          aria-expanded="true"
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={filtered.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
        />
      </div>

      {isLoading && (
        <p className={styles.notice} role="status">
          Cargando respuestas rápidas…
        </p>
      )}

      {!isLoading && isError && (
        <div className={styles.errorBox}>
          <p className={styles.error} role="alert">
            No se pudieron cargar las respuestas rápidas.
          </p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {showEmpty && (
        <p className={styles.notice} role="status">
          Todavía no hay respuestas rápidas.
        </p>
      )}

      {showNoMatch && (
        <p className={styles.notice} role="status">
          Sin coincidencias.
        </p>
      )}

      {/* El listbox se monta SIEMPRE que haya éxito de carga (aunque el filtro
          no matchee, para que `aria-controls` apunte a un nodo real) — pero solo
          con opciones cuando hay resultados. */}
      {!isLoading && !isError && (
        <ul id={LISTBOX_ID} role="listbox" className={styles.listbox} aria-label="Respuestas rápidas">
          {filtered.map((r, idx) => (
            <li
              key={r.id}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === activeIndex}
              className={styles.option}
              data-active={idx === activeIndex || undefined}
              // onMouseDown (no onClick): el mousedown del click-afuera dispara
              // ANTES del click; usar onMouseDown acá elige la opción antes de
              // que el listener global pueda cerrar el popover.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(idx);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className={styles.optionShortcut}>{r.shortcut}</span>
              <span className={styles.optionPreview}>{r.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
