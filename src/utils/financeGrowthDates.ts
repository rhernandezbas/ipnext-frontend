const MONTH_LABELS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/** "YYYY-MM" → { year, monthIndex0 }. No usa `Date` para el parseo (evita corrimiento de huso horario). */
function parseYearMonth(yearMonth: string): { year: number; monthIndex0: number } {
  const [year, month] = yearMonth.split('-').map(Number);
  return { year, monthIndex0: month - 1 };
}

function toYearMonth(year: number, monthIndex0: number): string {
  const month = String(monthIndex0 + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Rango [from, to] por defecto para las páginas de finance-growth: una
 * ventana de `monthsBack` meses TOTALES (inclusive en ambos extremos)
 * terminando en el mes de `referenceDate`. Ej. `monthsBack=6` con
 * `referenceDate` en julio ⇒ [febrero, julio] (6 meses: feb-jul).
 * Usa UTC para no depender del huso del navegador del operador.
 */
export function getDefaultYearMonthRange(
  monthsBack: number,
  referenceDate: Date = new Date(),
): { from: string; to: string } {
  const year = referenceDate.getUTCFullYear();
  const monthIndex0 = referenceDate.getUTCMonth();
  const to = toYearMonth(year, monthIndex0);

  const totalMonths = year * 12 + monthIndex0 - (monthsBack - 1);
  const fromYear = Math.floor(totalMonths / 12);
  const fromMonthIndex0 = ((totalMonths % 12) + 12) % 12;
  const from = toYearMonth(fromYear, fromMonthIndex0);

  return { from, to };
}

/** "2026-07" → "jul 2026" — label corto en español para ejes/leyendas. */
export function formatYearMonthLabel(yearMonth: string): string {
  const { year, monthIndex0 } = parseYearMonth(yearMonth);
  return `${MONTH_LABELS_ES[monthIndex0]} ${year}`;
}
