/**
 * Merge-variable substitution for task titles/descriptions.
 *
 * Authors write tokens like `{{cliente}}` in a template or a task description;
 * at SAVE time (task creation or description save) we replace them ONCE with the
 * linked entity's data, leaving plain text. A token whose value is missing is
 * left untouched so the author notices it didn't resolve.
 */
export interface TaskVariableValues {
  cliente?: string | null;
  telefono?: string | null;
  servicio?: string | null;
  contrato?: string | null;
  direccion?: string | null;
}

// Each token: case-insensitive, tolerant of inner whitespace and accents.
const TOKEN_PATTERNS: Record<keyof TaskVariableValues, RegExp> = {
  cliente: /\{\{\s*cliente\s*\}\}/gi,
  telefono: /\{\{\s*tel[eé]fono\s*\}\}/gi,
  servicio: /\{\{\s*servicio\s*\}\}/gi,
  contrato: /\{\{\s*contrato\s*\}\}/gi,
  direccion: /\{\{\s*direcci[oó]n\s*\}\}/gi,
};

export function applyTaskVariables(text: string, vars: TaskVariableValues): string {
  if (!text) return text;
  let out = text;
  (Object.keys(TOKEN_PATTERNS) as (keyof TaskVariableValues)[]).forEach((key) => {
    const value = vars[key];
    if (value != null && value !== '') {
      out = out.replace(TOKEN_PATTERNS[key], value);
    }
  });
  return out;
}
