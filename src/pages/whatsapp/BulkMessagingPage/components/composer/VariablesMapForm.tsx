import { Fragment } from 'react';
import { Select, type SelectOption } from '@/components/molecules/Select/Select';
import type { CampaignVariableSource, CampaignVariableSpec } from '@/types/messagingBulk';
import styles from './VariablesMapForm.module.css';

interface VariablesMapFormProps {
  /** `template.variables` del template elegido — CampaignComposer no monta esto sin template. */
  variables: string[];
  value: CampaignVariableSpec;
  onChange: (next: CampaignVariableSpec) => void;
  /** `missing` del 422 MISSING_TEMPLATE_VARIABLES (CAMP-4) — resalta esas filas. */
  missingVariables?: string[];
  /**
   * `template.body` del template elegido. Si viene, se muestra el mensaje
   * COMPLETO una sola vez arriba, con cada `{{N}}` resaltado EN SU LUGAR real
   * — así el operador lee la frase entera como le llega al cliente antes de
   * mapear (anti-error humano). Opcional (no rompe si el caller todavía no lo pasa).
   */
  templateBody?: string;
}

const SOURCE_OPTIONS: Array<{ value: CampaignVariableSource; label: string }> = [
  { value: 'name', label: 'Nombre del cliente' },
  { value: 'balanceDue', label: 'Monto de deuda' },
  { value: 'literal', label: 'Valor fijo' },
];

const EMPTY_SOURCE_OPTION: SelectOption = { value: '', label: 'Elegí una fuente…' };
const SOURCE_SELECT_OPTIONS: SelectOption[] = [EMPTY_SOURCE_OPTION, ...SOURCE_OPTIONS];

type TemplateBodyPart = { text: string } | { variable: string };

/** Parte `template.body` en segmentos de texto plano y placeholders `{{N}}`, en orden. */
function splitTemplateBody(body: string): TemplateBodyPart[] {
  const parts: TemplateBodyPart[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m.index > lastIndex) parts.push({ text: body.slice(lastIndex, m.index) });
    parts.push({ variable: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push({ text: body.slice(lastIndex) });
  return parts;
}

/** Label sr-only del input de valor fijo. */
function literalLabel(variable: string): string {
  return `Valor fijo para {{${variable}}}`;
}

/**
 * VariablesMapForm (F2 apply chunk 2, CAMP-1/CAMP-3, design §3.3; migrado al
 * `Select` propio en messaging-bulk-v11; rediseño #4 en bulk-composer-polish)
 * — mapea CADA variable del template a una fuente v1 (`name`|`balanceDue`|`literal`).
 *
 * Layout: el mensaje COMPLETO del template arriba, una sola vez, con cada
 * `{{N}}` resaltado en su lugar real (token gris, `<span>` con clase tokenizada
 * — NO el `<mark>` nativo que el browser pinta amarillo). Debajo, una lista
 * limpia de mapeo: una fila por variable `{{N}} → [Select fuente]` (+ input de
 * valor fijo si `literal`). Sin repetir el mensaje ni mostrar fragmentos
 * truncados por variable.
 *
 * Controlado 100% (`value`+`onChange`), sin estado propio — CampaignComposer
 * es dueño del `variablesMap` (necesita el shape completo para `createCampaign`).
 *
 * "Sin fuente elegida" (source en `''`) saca la entrada del map por completo
 * (en vez de guardar un source `''` inválido) — así `Object.keys(variablesMap)`
 * refleja exactamente qué variables están mapeadas, sin necesidad de un
 * filtro adicional en el caller para el gate de "todas mapeadas".
 */
export function VariablesMapForm({ variables, value, onChange, missingVariables = [], templateBody }: VariablesMapFormProps) {
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

      {templateBody && (
        <p className={styles.templatePreview}>
          {splitTemplateBody(templateBody).map((part, i) =>
            'variable' in part ? (
              <span key={i} className={styles.highlight}>{`{{${part.variable}}}`}</span>
            ) : (
              <Fragment key={i}>{part.text}</Fragment>
            ),
          )}
        </p>
      )}

      <div className={styles.mapList}>
        {variables.map((variable) => {
          const entry = value[variable];
          const selectId = `bulk-variable-${variable}-source`;
          const literalId = `bulk-variable-${variable}-literal`;
          const isMissing = missingVariables.includes(variable);

          return (
            <div key={variable} className={styles.row} data-missing={isMissing || undefined}>
              <Select
                id={selectId}
                label={`{{${variable}}}`}
                options={SOURCE_SELECT_OPTIONS}
                value={entry?.source ?? ''}
                onChange={(source) => handleSourceChange(variable, source as CampaignVariableSource | '')}
              />

              {entry?.source === 'literal' && (
                <>
                  <label htmlFor={literalId} className={styles.srOnly}>
                    {literalLabel(variable)}
                  </label>
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
      </div>
    </fieldset>
  );
}
