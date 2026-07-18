import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /**
   * Aditivo — color hex OPCIONAL renderizado como un dot antes del label (en la
   * opción y en el trigger cuando esa opción está elegida). Data-driven (no un
   * token): lo usan filtros cuyo catálogo trae color propio, ej. el filtro de
   * etiquetas del inbox (Ola 5). Ausente → sin dot (cero cambio para los
   * callers previos, ej. el filtro de campaña).
   */
  swatch?: string;
}

interface SelectProps {
  options: SelectOption[];
  /** Value actual. Si no matchea ninguna `option.value`, el trigger muestra `placeholder`. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Renderiza un `<label>` visible asociado (nombre accesible). Si no hay `label` ni `aria-label`, el combobox queda sin nombre. */
  label?: string;
  /** Nombre accesible SIN renderizar un `<label>` visible — usar cuando el caller ya provee su propio label externo. */
  'aria-label'?: string;
  id?: string;
  /** Marca el combobox como inválido para lectores de pantalla (aditivo — default: sin atributo). */
  'aria-invalid'?: boolean;
  /** Asocia el combobox a un mensaje de error/ayuda externo por id (aditivo — default: sin atributo). */
  'aria-describedby'?: string;
}

/**
 * Select (molecule) — combobox/listbox PROPIO accesible (messaging-bulk-v11
 * FE apply chunk 1). Reemplaza el `<select>` nativo genérico (regla nueva del
 * WORKFLOW, ver CLAUDE.md del chunk).
 *
 * Patrón WAI-ARIA APG "Select-Only Combobox": el trigger es un
 * `<button role="combobox">` — el foco SIEMPRE se queda en el trigger, nunca
 * entra al popup. La opción "activa" (highlight de teclado/mouse) se comunica
 * vía `aria-activedescendant` (no roving tabindex — no hace falta mover el
 * foco real porque no hay un `<input>` de texto que escriba, es select-only).
 *
 * Controlado 100% (`value` + `onChange`), sin estado propio de selección —
 * mismo criterio que `VariablesMapForm`/`TemplateSelector` (el caller es dueño
 * del value). El único estado interno es UI puro: abierto/cerrado + índice activo.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = 'Seleccioná una opción…',
  disabled = false,
  label,
  'aria-label': ariaLabel,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reactId = useId();
  const baseId = id ?? `select-${reactId}`;
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  function optionId(idx: number) {
    return `${baseId}-option-${idx}`;
  }

  function firstEnabledIndex(): number {
    return options.findIndex((o) => !o.disabled);
  }

  function lastEnabledIndex(): number {
    for (let i = options.length - 1; i >= 0; i--) {
      if (!options[i].disabled) return i;
    }
    return -1;
  }

  function nextEnabledIndex(from: number): number {
    for (let i = from + 1; i < options.length; i++) {
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function prevEnabledIndex(from: number): number {
    for (let i = from - 1; i >= 0; i--) {
      if (!options[i].disabled) return i;
    }
    return from;
  }

  // Cierra al clickear afuera. FIX-6 — chequeamos el WRAPPER entero (trigger +
  // label + listbox), no trigger/listbox por separado: un mousedown en el
  // `<label htmlFor>` NO debe contar como "afuera". Antes lo hacía → cerraba, y
  // el click del label (que se reenvía al button) lo reabría: parpadeo
  // close+reopen. Con el wrapper, el label queda "adentro" y no cierra.
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!wrapperRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Al abrir, la opción activa arranca en la seleccionada (o la primera habilitada).
  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia `open`, no en cada render
  }, [open]);

  // FIX-2 — mantené la opción activa (teclado) DENTRO del viewport del listbox
  // (`max-height: 280px`): al navegar más allá de las primeras opciones, la
  // resaltada quedaba fuera de vista. `?.` en el método porque jsdom no
  // implementa `scrollIntoView` (y para no romper si el nodo no existe).
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = document.getElementById(`${baseId}-option-${activeIndex}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, baseId]);

  function openList() {
    if (disabled) return;
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
  }

  function toggle() {
    if (disabled) return;
    if (open) closeList();
    else openList();
  }

  function commit(idx: number) {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // FIX-3 — cuando el Select MANEJA la tecla estando abierto, además de
  // `preventDefault` corta la burbuja (`stopPropagation`). Es reusable
  // app-wide: sin esto, dentro de un modal con un listener de Escape a nivel
  // `document` (p. ej. `PreviewModal`), el Escape que cierra el dropdown
  // cerraría TAMBIÉN el modal. NO frenamos teclas que no manejamos, ni las de
  // navegación con el dropdown cerrado (ahí sólo abrimos y dejamos burbujear).
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openList();
        else {
          e.stopPropagation();
          setActiveIndex((i) => nextEnabledIndex(i));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openList();
        else {
          e.stopPropagation();
          setActiveIndex((i) => prevEnabledIndex(i < 0 ? options.length : i));
        }
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex(firstEnabledIndex());
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex(lastEnabledIndex());
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) {
          e.stopPropagation();
          commit(activeIndex);
        } else openList();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          closeList();
        }
        break;
      case 'Tab':
        // Tab NO se detiene: debe seguir moviendo el foco (y respetar un
        // focus-trap padre). Sólo cerramos el dropdown.
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {label && (
        <label htmlFor={baseId} id={labelId} className={styles.label}>
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        id={baseId}
        className={styles.trigger}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={!label ? ariaLabel : undefined}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        data-placeholder={!selectedOption || undefined}
      >
        <span className={styles.value}>
          {selectedOption?.swatch && (
            <span className={styles.swatch} style={{ backgroundColor: selectedOption.swatch }} aria-hidden="true" />
          )}
          {/* El TEXTO va en su propio span: `.value` es un flex wrapper (para
              alinear el swatch opcional) y `text-overflow:ellipsis` NO aplica a
              un flex container — el ellipsis (con min-width:0 para que el
              flex-item pueda encogerse) vive en `.valueText`. */}
          <span className={styles.valueText}>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul id={listboxId} ref={listRef} role="listbox" className={styles.listbox} aria-labelledby={label ? labelId : undefined}>
          {options.map((opt, idx) => (
            <li
              key={opt.value}
              id={optionId(idx)}
              role="option"
              aria-selected={opt.value === value}
              aria-disabled={opt.disabled || undefined}
              className={styles.option}
              data-active={idx === activeIndex || undefined}
              onClick={() => commit(idx)}
              onMouseEnter={() => !opt.disabled && setActiveIndex(idx)}
            >
              <span className={styles.check} aria-hidden="true">
                {opt.value === value ? '✓' : ''}
              </span>
              {opt.swatch && (
                <span className={styles.swatch} style={{ backgroundColor: opt.swatch }} aria-hidden="true" />
              )}
              <span className={styles.optionLabel}>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
