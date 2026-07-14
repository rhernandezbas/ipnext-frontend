import type { ChangeEvent } from 'react';
import type { CampaignVariableSource, CampaignVariableSpec } from '@/types/messagingBulk';
import styles from './VariablesMapForm.module.css';

interface VariablesMapFormProps {
  /** `template.variables` del template elegido — CampaignComposer no monta esto sin template. */
  variables: string[];
  value: CampaignVariableSpec;
  onChange: (next: CampaignVariableSpec) => void;
  /** `missing` del 422 MISSING_TEMPLATE_VARIABLES (CAMP-4) — resalta esas filas. */
  missingVariables?: string[];
}

const SOURCE_OPTIONS: Array<{ value: CampaignVariableSource; label: string }> = [
  { value: 'name', label: 'Nombre del cliente' },
  { value: 'balanceDue', label: 'Monto de deuda' },
  { value: 'literal', label: 'Valor fijo' },
];

/**
 * VariablesMapForm (F2 apply chunk 2, CAMP-1/CAMP-3, design §3.3) — mapea
 * CADA variable del template a una fuente v1 (`name`|`balanceDue`|`literal`).
 * Controlado 100% (`value`+`onChange`), sin estado propio — CampaignComposer
 * es dueño del `variablesMap` (necesita el shape completo para `createCampaign`).
 *
 * "Sin fuente elegida" (select en `''`) saca la entrada del map por completo
 * (en vez de guardar un source `''` inválido) — así `Object.keys(variablesMap)`
 * refleja exactamente qué variables están mapeadas, sin necesidad de un
 * filtro adicional en el caller para el gate de "todas mapeadas".
 */
export function VariablesMapForm({ variables, value, onChange, missingVariables = [] }: VariablesMapFormProps) {
  if (variables.length === 0) return null;

  function handleSourceChange(variable: string, source: CampaignVariableSource | '') {
    if (!source) {
      const next = { ...value };
      delete next[variable];
      onChange(next);
      return;
    }
    onChange({
      ...value,
      [variable]: { source, value: source === 'literal' ? (value[variable]?.value ?? '') : undefined },
    });
  }

  function handleLiteralChange(variable: string, literalValue: string) {
    onChange({ ...value, [variable]: { source: 'literal', value: literalValue } });
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Variables del template</legend>

      {variables.map((variable) => {
        const entry = value[variable];
        const selectId = `bulk-variable-${variable}-source`;
        const literalId = `bulk-variable-${variable}-literal`;
        const isMissing = missingVariables.includes(variable);

        return (
          <div key={variable} className={styles.row} data-missing={isMissing || undefined}>
            <label htmlFor={selectId} className={styles.varLabel}>{`{{${variable}}}`}</label>

            <select
              id={selectId}
              className={styles.select}
              value={entry?.source ?? ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                handleSourceChange(variable, e.target.value as CampaignVariableSource | '')
              }
            >
              <option value="">Elegí una fuente…</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {entry?.source === 'literal' && (
              <>
                <label htmlFor={literalId} className={styles.srOnly}>{`Valor fijo para {{${variable}}}`}</label>
                <input
                  id={literalId}
                  type="text"
                  className={styles.literalInput}
                  value={entry.value ?? ''}
                  onChange={(e) => handleLiteralChange(variable, e.target.value)}
                  placeholder="Valor…"
                />
              </>
            )}

            {isMissing && (
              <p className={styles.error} role="alert">
                Falta mapear esta variable (rechazada por el servidor).
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
