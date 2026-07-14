import type { CampaignVariableSpec } from '@/types/messagingBulk';

/**
 * previewMessage (messaging-bulk-v11 FE apply chunk 2, PreviewModal) —
 * arma el texto REAL que se va a enviar a partir de `template.body` +
 * `CampaignVariableSpec` (mismo shape que `VariablesMapForm`/
 * `CampaignComposer` — `source: 'name'|'balanceDue'|'literal'`).
 *
 * A diferencia de `VariablesMapForm.splitTemplateBody` (que separa el body en
 * partes para RESALTAR cada `{{N}}` en su contexto, sin resolverlo), esta
 * función RESUELVE cada placeholder a lo que el operador va a VER en el
 * mensaje final — un placeholder legible para `name`/`balanceDue` (esos dos
 * varían por-destinatario, no hay un valor único que mostrar) o el valor
 * literal tal cual para `literal` (ese sí es fijo, igual para todos).
 */

const SOURCE_PLACEHOLDER_LABELS: Record<'name' | 'balanceDue', string> = {
  name: '[Nombre del cliente]',
  balanceDue: '[Monto de deuda]',
};

/** `{{N}}` — mismo patrón que `VariablesMapForm.splitTemplateBody`. */
const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function renderPreviewMessage(body: string, variablesMap: CampaignVariableSpec): string {
  return body.replace(PLACEHOLDER_RE, (_match, variable: string) => {
    const entry = variablesMap[variable];
    if (!entry) return `[sin mapear: {{${variable}}}]`;
    if (entry.source === 'literal') {
      const value = (entry.value ?? '').trim();
      return value.length > 0 ? value : '[valor vacío]';
    }
    return SOURCE_PLACEHOLDER_LABELS[entry.source];
  });
}
