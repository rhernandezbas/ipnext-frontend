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
   * v1.1 (BE en PROD) — `template.body` del template elegido. Si viene,
   * muestra CADA `{{N}}` resaltado en su contexto real ("...saldo de
   * **{{2}}**...") — anti-error humano: el operador ve QUÉ es la variable
   * ANTES de mapearla, en vez de mapear a ciegas por número. Opcional (no
   * rompe si el caller todavía no lo pasa).
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

/** Cuánto texto de contexto mostrar a cada lado del `{{N}}` resaltado antes de truncar con "…". */
const CONTEXT_MAX_CHARS = 40;

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

function truncateStart(text: string, max: number): string {
  return text.length <= max ? text : `…${text.slice(text.length - max)}`;
}

function truncateEnd(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

interface VariableContext {
  prefix: string;
  token: string;
  suffix: string;
}

/**
 * Contexto REAL de una variable dentro de `template.body` — el texto plano
 * inmediatamente antes/después de su `{{N}}`, cortado en el placeholder
 * VECINO más cercano (nunca se cuela el `{{M}}` de otra variable en el
 * contexto de esta), truncado a `CONTEXT_MAX_CHARS` por lado si el segmento
 * es muy largo. `null` si la variable no aparece literalmente en el body
 * (defensivo — no debería pasar si `variables` viene del mismo template).
 */
function variableContext(body: string, variable: string): VariableContext | null {
  const parts = splitTemplateBody(body);
  const idx = parts.findIndex((p) => 'variable' in p && p.variable === variable);
  if (idx === -1) return null;

  const prevPart = parts[idx - 1];
  const nextPart = parts[idx + 1];
  const prevText = prevPart && 'text' in prevPart ? prevPart.text : '';
  const nextText = nextPart && 'text' in nextPart ? nextPart.text : '';

  return {
    prefix: truncateStart(prevText, CONTEXT_MAX_CHARS),
    token: `{{${variable}}}`,
    suffix: truncateEnd(nextText, CONTEXT_MAX_CHARS),
  };
}

/** Label sr-only del input de valor fijo — referencia el contexto real cuando está disponible. */
function literalLabel(variable: string, context: VariableContext | null): string {
  if (!context) return `Valor fijo para {{${variable}}}`;
  return `Valor fijo para {{${variable}}} (${context.prefix}${context.token}${context.suffix})`;
}

/**
 * VariablesMapForm (F2 apply chunk 2, CAMP-1/CAMP-3, design §3.3; migrado al
 * `Select` propio + descripciones de contexto en messaging-bulk-v11 FE apply
 * chunk 1) — mapea CADA variable del template a una fuente v1
 * (`name`|`balanceDue`|`literal`).
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

      {variables.map((variable) => {
        const entry = value[variable];
        const selectId = `bulk-variable-${variable}-source`;
        const literalId = `bulk-variable-${variable}-literal`;
        const isMissing = missingVariables.includes(variable);
        const context = templateBody ? variableContext(templateBody, variable) : null;

        return (
          <div key={variable} className={styles.row} data-missing={isMissing || undefined}>
            {context && (
              <p className={styles.context}>
                {context.prefix}
                <mark className={styles.highlight}>{context.token}</mark>
                {context.suffix}
              </p>
            )}

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
                  {literalLabel(variable, context)}
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
    </fieldset>
  );
}
