import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import styles from './TemplateSelector.module.css';

interface TemplateSelectorProps {
  templates: TemplateSummaryDto[];
  isLoading: boolean;
  isError: boolean;
  selected: TemplateSummaryDto | null;
  onSelect: (template: TemplateSummaryDto | null) => void;
}

const EMPTY_VALUE = '';

/**
 * TemplateSelector (F2 apply chunk 2, TPL-1/TPL-2; migrado al `Select` propio
 * en messaging-bulk-v11 FE apply chunk 1 — PROHIBIDO el `<select>` nativo de
 * cara al operador). El fetch (`useTemplates`, gateado a
 * `messaging.templates`) y el permiso viven en `CampaignComposer` — este
 * componente es presentacional puro, 4 ramas (loading/error/empty/success,
 * patrón F1).
 *
 * Templates NO `sendable` (pending/rejected/unsubmitted) SE MUESTRAN pero
 * `disabled`, con nota "(no aprobado)" — informativo en vez de ocultarlos sin
 * explicación (spec: "no aparecen o van disabled con nota").
 */
export function TemplateSelector({ templates, isLoading, isError, selected, onSelect }: TemplateSelectorProps) {
  const options: SelectOption[] = [
    { value: EMPTY_VALUE, label: 'Seleccioná un template…' },
    ...templates.map((t) => ({
      value: t.contentSid,
      label: t.sendable ? t.friendlyName : `${t.friendlyName} (no aprobado)`,
      disabled: !t.sendable,
    })),
  ];

  function handleChange(contentSid: string) {
    if (!contentSid) {
      onSelect(null);
      return;
    }
    onSelect(templates.find((t) => t.contentSid === contentSid) ?? null);
  }

  return (
    <div className={styles.section}>
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
          <Select
            label="Template"
            options={options}
            value={selected?.contentSid ?? EMPTY_VALUE}
            onChange={handleChange}
            placeholder="Seleccioná un template…"
          />

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
