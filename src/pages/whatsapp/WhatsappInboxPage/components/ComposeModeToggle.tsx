import styles from './ComposeModeToggle.module.css';

export type ComposeMode = 'reply' | 'note';

interface ComposeModeToggleProps {
  mode: ComposeMode;
  onChange: (mode: ComposeMode) => void;
}

/**
 * ComposeModeToggle — segmented radiogroup Reply/Nota (messaging-inbox-notes
 * F1.5 fase D — NOTA PRIVADA, design §3.1). Radios NATIVOS
 * (`<input type="radio">`), NO `role="tab"`: hay UN solo composer (el
 * textarea es compartido) — lo que cambia es el MODO de una misma superficie
 * de escritura, exactamente lo que modela un radiogroup. Beneficios gratis:
 * navegación por flechas ←/→ y `aria-checked`/estado nativo del browser, sin
 * JS de teclado custom.
 *
 * 100% controlado (`mode`+`onChange`), sin estado propio — foco tras cambiar
 * de modo y el anuncio `aria-live` viven en `Composer` (el dueño del
 * textarea que recibe el foco).
 */
export function ComposeModeToggle({ mode, onChange }: ComposeModeToggleProps) {
  return (
    <fieldset className={styles.fieldset} role="radiogroup" aria-label="Modo de redacción">
      <div className={styles.toggle}>
        <span className={styles.pill} data-testid="compose-mode-pill" data-mode={mode} aria-hidden="true" />

        <label className={styles.segment}>
          <input
            type="radio"
            name="compose-mode"
            value="reply"
            className={styles.radioInput}
            checked={mode === 'reply'}
            onChange={() => onChange('reply')}
          />
          <span className={styles.segmentLabel}>Respuesta</span>
        </label>

        <label className={styles.segment}>
          <input
            type="radio"
            name="compose-mode"
            value="note"
            className={styles.radioInput}
            checked={mode === 'note'}
            onChange={() => onChange('note')}
          />
          <span className={styles.segmentLabel}>Nota interna</span>
        </label>
      </div>
    </fieldset>
  );
}
