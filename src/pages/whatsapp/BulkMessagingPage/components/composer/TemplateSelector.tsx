import type { ChangeEvent } from 'react';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import styles from './TemplateSelector.module.css';

interface TemplateSelectorProps {
  templates: TemplateSummaryDto[];
  isLoading: boolean;
  isError: boolean;
  selected: TemplateSummaryDto | null;
  onSelect: (template: TemplateSummaryDto | null) => void;
}

const SELECT_ID = 'bulk-template-select';

/**
 * TemplateSelector (F2 apply chunk 2, TPL-1/TPL-2) — <select> nativo SOLO de
 * templates. El fetch (`useTemplates`, gateado a `messaging.templates`) y el
 * permiso viven en `CampaignComposer` — este componente es presentacional
 * puro, 4 ramas (loading/error/empty/success, patrón F1).
 *
 * Templates NO `sendable` (pending/rejected/unsubmitted) SE MUESTRAN pero
 * `disabled`, con nota "(no aprobado)" — informativo en vez de ocultarlos sin
 * explicación (spec: "no aparecen o van disabled con nota").
 */
export function TemplateSelector({ templates, isLoading, isError, selected, onSelect }: TemplateSelectorProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const contentSid = e.target.value;
    if (!contentSid) {
      onSelect(null);
      return;
    }
    onSelect(templates.find((t) => t.contentSid === contentSid) ?? null);
  }

  return (
    <div className={styles.section}>
      <label htmlFor={SELECT_ID} className={styles.label}>
        Template
      </label>

      {isLoading && (
        <p className={styles.notice} role="status">
          Cargando templates…
        </p>
      )}

      {!isLoading && isError && (
        <p className={styles.error} role="alert">
          No se pudieron cargar los templates. Reintentá.
        </p>
      )}

      {!isLoading && !isError && templates.length === 0 && (
        <p className={styles.notice} role="status">
          No hay templates disponibles.
        </p>
      )}

      {!isLoading && !isError && templates.length > 0 && (
        <>
          <select id={SELECT_ID} className={styles.select} value={selected?.contentSid ?? ''} onChange={handleChange}>
            <option value="">Seleccioná un template…</option>
            {templates.map((t) => (
              <option key={t.contentSid} value={t.contentSid} disabled={!t.sendable}>
                {t.friendlyName}
                {!t.sendable ? ' (no aprobado)' : ''}
              </option>
            ))}
          </select>

          {selected && (
            <div className={styles.details}>
              <p className={styles.templateName}>{selected.friendlyName}</p>
              {selected.variables.length > 0 ? (
                <p className={styles.variablesList}>
                  Variables: {selected.variables.map((v) => `{{${v}}}`).join(', ')}
                </p>
              ) : (
                <p className={styles.variablesList}>Este template no tiene variables.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
