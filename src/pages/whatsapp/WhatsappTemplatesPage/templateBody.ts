/**
 * templateBody (Change 3) — utilidades PURAS sobre el `body` de un template
 * con placeholders `{{N}}`. Mismo patrón `{{\w+}}` que
 * `previewMessage`/`VariablesMapForm` del composer.
 *
 * - `extractVariables`: deriva las keys de variable del body (únicas, en orden
 *   de primera aparición). El operador escribe el body y las variables salen
 *   solas — anti-error humano (no hay una lista separada que se desincronice).
 * - `splitTemplateBody`: parte el body en segmentos texto/placeholder para
 *   RESALTAR cada `{{N}}` en el preview (sin resolverlo).
 */

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/** Keys de variable del body, únicas y en orden de primera aparición. */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export interface TemplateBodySegment {
  text: string;
  /** `true` si el segmento es un placeholder `{{N}}` (para resaltarlo). */
  isVar: boolean;
}

/** Parte el body en segmentos alternados texto/placeholder (para el preview resaltado). */
export function splitTemplateBody(body: string): TemplateBodySegment[] {
  const segments: TemplateBodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(PLACEHOLDER_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: body.slice(lastIndex, start), isVar: false });
    }
    segments.push({ text: match[0], isVar: true });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ text: body.slice(lastIndex), isVar: false });
  }
  return segments;
}
