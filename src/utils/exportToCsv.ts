/**
 * Shared CSV export utility.
 *
 * Properly escapes values containing commas, double-quotes, and newlines
 * (RFC 4180). Prepends a UTF-8 BOM so Excel opens accented characters correctly.
 *
 * Usage:
 *   exportToCsv(rows, [
 *     { label: 'Fecha',    value: (r) => formatDateTimeShort(r.createdAt) },
 *     { label: 'Operador', value: (r) => r.actorName ?? '—' },
 *   ], 'historial.csv');
 */

/** One column descriptor: human-readable header + how to extract a string cell. */
export interface CsvColumn<T> {
  /** Header label shown in the first row. */
  label: string;
  /** Extract a plain-string cell value from a data row. */
  value: (row: T) => string;
}

/** Escape a single CSV cell per RFC 4180 (wrap in quotes if needed). */
function escapeCsvCell(raw: string): string {
  if (/[",\n\r]/.test(raw)) {
    return '"' + raw.replace(/"/g, '""') + '"';
  }
  return raw;
}

/**
 * Build a CSV string from `rows` using the given column descriptors, then
 * trigger a browser `<a>` download for `filename`.
 *
 * Does nothing when `rows` is empty.
 */
export function exportToCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  if (!rows.length) return;

  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(','))
    .join('\n');

  // U+FEFF BOM + CSV so Excel handles UTF-8 (accented chars in español).
  const bom = String.fromCharCode(0xfeff);
  const csv = bom + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
