/**
 * parseRecipientsCsv (bulk-csv-recipients FE, D8/D9, CSV-FE-1..CSV-FE-3) —
 * parser CSV PROPIO, puro, sin dependencias nuevas (NO papaparse). El
 * requisito es RECHAZO determinístico de estructura, no tolerancia — ver
 * `design.md` D8 del change `bulk-csv-recipients` (BE worktree).
 *
 * Contrato (CSV-FE-1): `parseRecipientsCsv(text)` devuelve un resultado
 * discriminado:
 *  - `{ok:true, contacts, invalidRows, headerSkipped}` — SOLO las filas
 *    válidas de un archivo ESTRUCTURALMENTE válido.
 *  - `{ok:false, error:{code, line?}}` — RECHAZO TOTAL del archivo, ninguna
 *    fila entra.
 *
 * La VALIDEZ del formato del teléfono (plan de numeración AR) NO se evalúa
 * acá (D9) — es autoridad exclusiva del BE (`toWhatsAppE164`). Este parser
 * sólo valida ESTRUCTURA (2 columnas, comillas, separador) y PRESENCIA
 * (nombre/teléfono no vacíos post-trim).
 */

export interface CsvContact {
  name: string;
  phone: string;
}

/** Motivo de una fila inválida DENTRO de un archivo por lo demás válido — NUNCA rechaza el archivo entero. */
export type CsvInvalidRowReason = 'sin_nombre' | 'sin_telefono';

export interface CsvInvalidRow {
  line: number;
  name?: string;
  phone?: string;
  reason: CsvInvalidRowReason;
}

/**
 * Códigos de rechazo TOTAL (CSV-FE-2). El cap de 1MB comparte
 * `DEMASIADAS_FILAS` con el cap de 5000 filas — el spec los agrupa en el
 * mismo bullet ("supera 5000 filas... o 1MB") sin nombrar un código propio
 * para bytes; son la MISMA familia de límite ("demasiado archivo").
 */
export type CsvParseErrorCode = 'ESTRUCTURA' | 'COMILLAS' | 'VACIO' | 'DEMASIADAS_FILAS';

export interface CsvParseError {
  code: CsvParseErrorCode;
  line?: number;
}

export type CsvParseResult =
  | { ok: true; contacts: CsvContact[]; invalidRows: CsvInvalidRow[]; headerSkipped: boolean }
  | { ok: false; error: CsvParseError };

/** Tope de filas de DATOS (excluye el header) — cap independiente del cap de `manualContacts` del BE (mismo número, D10). */
export const MAX_CSV_ROWS = 5000;

/** Tope de tamaño de archivo — validado ANTES de intentar parsear (CSV-FE-2). */
export const MAX_CSV_BYTES = 1024 * 1024; // 1MB

/** Separadores candidatos, en orden de PRIORIDAD de empate (Excel es-AR exporta `;`). */
const SEPARATOR_CANDIDATES = [';', ',', '\t'] as const;

interface RawRow {
  fields: string[];
  /** Línea 1-based donde EMPIEZA esta fila (la primera línea física si el campo entre comillas cruza varios `\n`). */
  startLine: number;
  /** Texto crudo de la fila (para detectar líneas totalmente vacías). */
  raw: string;
}

/** Separa UNA línea respetando comillas/`""` — usado SOLO para la autodetección de separador (la línea 1 no cruza saltos). */
function splitFieldsInLine(line: string, sep: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      continue;
    }
    if (ch === sep) {
      fields.push(field);
      field = '';
      continue;
    }
    field += ch;
  }
  fields.push(field);
  return fields;
}

/** Autodetección de separador (CSV-FE-2): el primero (en orden de prioridad) que produce EXACTAMENTE 2 columnas en `line`. */
function detectSeparator(line: string): string | null {
  for (const sep of SEPARATOR_CANDIDATES) {
    if (splitFieldsInLine(line, sep).length === 2) return sep;
  }
  return null;
}

/**
 * Tokeniza el archivo ENTERO con el separador ya elegido — a diferencia de
 * `splitFieldsInLine`, este SÍ cruza `\n` dentro de un campo entre comillas
 * (multi-línea válido en CSV) y detecta comillas sin cerrar al llegar a EOF.
 */
function tokenize(text: string, sep: string): { rows: RawRow[]; unterminatedAt: number | null } {
  const rows: RawRow[] = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let rowRawStart = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        if (ch === '\n') line++;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      continue;
    }
    if (ch === sep) {
      fields.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      fields.push(field);
      rows.push({ fields, startLine: rowStartLine, raw: text.slice(rowRawStart, i) });
      fields = [];
      field = '';
      line++;
      rowStartLine = line;
      rowRawStart = i + 1;
      continue;
    }
    field += ch;
  }

  if (inQuotes) {
    return { rows, unterminatedAt: rowStartLine };
  }

  // Última fila sin salto de línea final.
  if (field !== '' || fields.length > 0 || rowRawStart < text.length) {
    fields.push(field);
    rows.push({ fields, startLine: rowStartLine, raw: text.slice(rowRawStart) });
  }

  return { rows, unterminatedAt: null };
}

function isBlankRow(row: RawRow): boolean {
  return row.raw.trim() === '';
}

export function parseRecipientsCsv(text: string): CsvParseResult {
  // Tope de tamaño — validado ANTES de intentar parsear (CSV-FE-2).
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) {
    return { ok: false, error: { code: 'DEMASIADAS_FILAS' } };
  }

  // BOM inicial → strip (CSV-FE-2, "el BOM no contamina la primera celda").
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // CRLF/CR/LF equivalentes.
  src = src.replace(/\r\n|\r/g, '\n');

  if (src.trim() === '') {
    return { ok: false, error: { code: 'VACIO' } };
  }

  // Autodetección de separador sobre la primera línea NO vacía.
  const physicalLines = src.split('\n');
  const firstNonEmptyLine = physicalLines.find((l) => l.trim() !== '') ?? '';
  const firstNonEmptyLineIndex = physicalLines.findIndex((l) => l.trim() !== '');
  const separator = detectSeparator(firstNonEmptyLine);
  if (separator === null) {
    return { ok: false, error: { code: 'ESTRUCTURA', line: firstNonEmptyLineIndex + 1 } };
  }

  const { rows, unterminatedAt } = tokenize(src, separator);
  if (unterminatedAt !== null) {
    return { ok: false, error: { code: 'COMILLAS', line: unterminatedAt } };
  }

  // Descarta líneas COMPLETAMENTE vacías al FINAL del archivo (se ignoran, no cuentan para nada).
  let lastContentIdx = rows.length - 1;
  while (lastContentIdx >= 0 && isBlankRow(rows[lastContentIdx])) lastContentIdx--;
  const trimmedRows = rows.slice(0, lastContentIdx + 1);

  if (trimmedRows.length === 0) {
    return { ok: false, error: { code: 'VACIO' } };
  }

  // Header (fila 1 de contenido): heurística por dígitos en la 2da columna.
  const headerRow = trimmedRows[0];
  if (headerRow.fields.length !== 2) {
    return { ok: false, error: { code: 'ESTRUCTURA', line: headerRow.startLine } };
  }
  const headerSkipped = !/\d/.test(headerRow.fields[1]);
  const contentRows = headerSkipped ? trimmedRows.slice(1) : trimmedRows;

  if (contentRows.length === 0) {
    return { ok: false, error: { code: 'VACIO' } };
  }

  // Estructura: CUALQUIER fila de DATOS (no-blanco) con ≠2 columnas → rechazo TOTAL.
  for (const row of contentRows) {
    if (isBlankRow(row)) continue; // línea vacía en el medio: NO es "fila de datos" para esta regla (CSV-FE-3).
    if (row.fields.length !== 2) {
      return { ok: false, error: { code: 'ESTRUCTURA', line: row.startLine } };
    }
  }

  if (contentRows.length > MAX_CSV_ROWS) {
    return { ok: false, error: { code: 'DEMASIADAS_FILAS' } };
  }

  const contacts: CsvContact[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  for (const row of contentRows) {
    if (isBlankRow(row)) {
      invalidRows.push({ line: row.startLine, reason: 'sin_nombre' });
      continue;
    }
    const name = row.fields[0].trim();
    const phone = row.fields[1].trim();
    if (name === '') {
      invalidRows.push({ line: row.startLine, reason: 'sin_nombre', ...(phone !== '' ? { phone } : {}) });
    } else if (phone === '') {
      invalidRows.push({ line: row.startLine, reason: 'sin_telefono', name });
    } else {
      contacts.push({ name, phone });
    }
  }

  return { ok: true, contacts, invalidRows, headerSkipped };
}
