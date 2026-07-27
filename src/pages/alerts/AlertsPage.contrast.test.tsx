/**
 * AlertsPage.module.css — contrato de contraste (review adversarial, change
 * `noc-alerts-dashboard`, hallazgos M6 + "summaryError" + MEDIO-4). jsdom no
 * computa color contra fondo real (no hay motor de layout/paint), así que el
 * contrato se valida leyendo el `.css` crudo (mismo patrón que
 * `MessageBubble.contrast.test.tsx` / `WhatsappInboxPage.layout.test.tsx`:
 * `fs.readFileSync`, NO `?raw` de Vite — el plugin de CSS Modules intercepta
 * esa query bajo `classNameStrategy:'non-scoped'`) y calculando el ratio WCAG
 * 2.1 a mano (relative luminance + `(L1+0.05)/(L2+0.05)`) sobre los tokens
 * reales de `tokens/variables.css`.
 *
 * MEDIO-4 (2ª review adversarial): la versión anterior de este archivo NO hacía
 * cumplir nada. El fondo del estado activo estaba HARDCODEADO en el test
 * (`mix(primary, surface, 8)`) con un comentario que afirmaba "si ese número
 * cambia en el CSS, este test debe fallar" — falso: el test nunca leía el
 * `color-mix()` del CSS. Probado por el revisor: cambiando el CSS a 60% (ratio
 * real 3.383:1, REPRUEBA AA) los 14 tests pasaban igual. Mismo agujero en
 * hover: nada ataba `.kpiTile:hover` a `--color-surface-hover`.
 *
 * Fix: TODO color — de texto y de fondo — se PARSEA del CSS real
 * (`cssColorOf`, que resuelve `var(--token)` contra `tokens/variables.css` y
 * evalúa `color-mix(in srgb, A p%, B)` con el porcentaje que el CSS declare).
 * El test ya no sabe qué colores "debería" haber: lee los que hay y exige el
 * ratio. Cambiar el 8% a 60%, o el fondo de :hover a algo oscuro, o el color
 * del label a uno más claro, FALLA.
 *
 * La matemática WCAG (`relLuminance` / `contrastRatio`) fue reimplementada y
 * verificada de forma independiente por el revisor — no se toca.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, 'AlertsPage.module.css');
const css = readFileSync(cssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** color-mix(in srgb, A p%, B) — misma fórmula lineal que usa el browser para sRGB. */
function mix(a: Rgb, b: Rgb, percentA: number): Rgb {
  const p = percentA / 100;
  return [0, 1, 2].map((i) => p * a[i]! + (1 - p) * b[i]!) as Rgb;
}

function relLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio: (L1+0.05)/(L2+0.05), L1 >= L2. */
function contrastRatio(rgbA: Rgb, rgbB: Rgb): number {
  const l1 = relLuminance(rgbA);
  const l2 = relLuminance(rgbB);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** MEDIO-4: el selector se ancla a PRINCIPIO DE LÍNEA. Con `indexOf` a secas,
 *  buscar `.breakdownSource {` encontraba primero
 *  `.breakdownRow[aria-pressed='true'] .breakdownSource {` y el "estado base"
 *  se validaba contra la regla del estado activo — un falso verde silencioso. */
function extractRule(source: string, selector: string): string {
  const m = new RegExp(`^${escapeRegExp(selector)}`, 'm').exec(source);
  if (!m) throw new Error(`Selector "${selector}" no encontrado (a principio de línea) en el CSS.`);
  const open = source.indexOf('{', m.index);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

/** Valor crudo de una declaración dentro de un bloque, anclado para que
 *  `border-color:` no matchee cuando se pide `color:`. */
function declaration(block: string, prop: string): string {
  const m = new RegExp(`(?:^|;|\\n)\\s*${escapeRegExp(prop)}:\\s*([^;]+);`).exec(block);
  if (!m) throw new Error(`Declaración "${prop}" no encontrada en el bloque:\n${block}`);
  return m[1]!.trim();
}

const VAR_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
const COLOR_MIX_RE = /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+?)\s*\)$/;

/** Resuelve un valor de color de CSS a RGB: `var(--token)`, hex literal, o
 *  `color-mix(in srgb, A p%, B)` — con el porcentaje y los colores QUE DECLARA
 *  EL CSS, no los que este test suponga. Sintaxis desconocida = throw (falla
 *  ruidosa; nunca un pase silencioso). */
function resolveCssColor(value: string): Rgb {
  const v = value.trim();

  const varMatch = VAR_RE.exec(v);
  if (varMatch) return hexToRgb(resolveToken(varMatch[1]!));

  if (v.startsWith('#')) return hexToRgb(v);

  const mixMatch = COLOR_MIX_RE.exec(v);
  if (mixMatch) {
    return mix(resolveCssColor(mixMatch[1]!), resolveCssColor(mixMatch[3]!), parseFloat(mixMatch[2]!));
  }

  throw new Error(`Valor de color no soportado por el parser del test: "${value}"`);
}

/** Color de una propiedad de un selector, leído del CSS real. */
function cssColorOf(selector: string, prop: 'color' | 'background-color'): Rgb {
  return resolveCssColor(declaration(extractRule(css, selector), prop));
}

const WCAG_AA_SMALL_TEXT = 4.5;
/** WCAG 2.1: "large text" = >= 18.66px bold o >= 24px. `.kpiValue` es
 *  font-size-2xl (24px) / 3xl (30px) + font-weight-bold → 3:1. */
const WCAG_AA_LARGE_TEXT = 3;

/**
 * Cada fila ata un TEXTO a su FONDO REAL. Los dos extremos salen del CSS: si
 * alguien cambia el `color-mix` del estado activo, el fondo de :hover, o el
 * color del label, el ratio se recalcula solo y la fila falla.
 */
const CONTRAST_CONTRACTS: Array<{
  what: string;
  textSelector: string;
  bgSelector: string;
  min: number;
}> = [
  // Tiles de severidad — los 3 estados (base / hover / activo).
  { what: '.kpiLabel sobre .kpiTile (base)', textSelector: '.kpiLabel {', bgSelector: '.kpiTile {', min: WCAG_AA_SMALL_TEXT },
  { what: '.kpiLabel sobre .kpiTile:hover', textSelector: '.kpiTile:hover .kpiLabel,', bgSelector: '.kpiTile:hover {', min: WCAG_AA_SMALL_TEXT },
  {
    what: ".kpiLabel sobre .kpiTile[aria-pressed='true'] (color-mix parseado del CSS)",
    textSelector: ".kpiTile[aria-pressed='true'] .kpiLabel {",
    bgSelector: ".kpiTile[aria-pressed='true'] {",
    min: WCAG_AA_SMALL_TEXT,
  },
  // El NÚMERO del tile (texto grande) en los mismos 3 fondos.
  { what: '.kpiValue sobre .kpiTile (base)', textSelector: '.kpiValue {', bgSelector: '.kpiTile {', min: WCAG_AA_LARGE_TEXT },
  { what: '.kpiValue sobre .kpiTile:hover', textSelector: '.kpiValue {', bgSelector: '.kpiTile:hover {', min: WCAG_AA_LARGE_TEXT },
  { what: ".kpiValue sobre .kpiTile[aria-pressed='true']", textSelector: '.kpiValue {', bgSelector: ".kpiTile[aria-pressed='true'] {", min: WCAG_AA_LARGE_TEXT },
  { what: '.kpiTile_critical .kpiValue sobre .kpiTile (base)', textSelector: '.kpiTile_critical .kpiValue {', bgSelector: '.kpiTile {', min: WCAG_AA_LARGE_TEXT },
  { what: ".kpiTile_critical .kpiValue sobre .kpiTile[aria-pressed='true']", textSelector: '.kpiTile_critical .kpiValue {', bgSelector: ".kpiTile[aria-pressed='true'] {", min: WCAG_AA_LARGE_TEXT },
  // Tile de ACK (no es botón: solo estado base).
  { what: '.kpiLabel sobre .kpiTileAck', textSelector: '.kpiLabel {', bgSelector: '.kpiTileAck {', min: WCAG_AA_SMALL_TEXT },
  // Filas del breakdown — HERMANAS de los tiles, mismos 3 estados.
  { what: '.breakdownSource sobre .breakdownRow (base)', textSelector: '.breakdownSource {', bgSelector: '.breakdownRow {', min: WCAG_AA_SMALL_TEXT },
  { what: '.breakdownSource sobre .breakdownRow:hover', textSelector: '.breakdownRow:hover .breakdownSource,', bgSelector: '.breakdownRow:hover {', min: WCAG_AA_SMALL_TEXT },
  {
    what: ".breakdownSource sobre .breakdownRow[aria-pressed='true'] (color-mix parseado del CSS)",
    textSelector: ".breakdownRow[aria-pressed='true'] .breakdownSource {",
    bgSelector: ".breakdownRow[aria-pressed='true'] {",
    min: WCAG_AA_SMALL_TEXT,
  },
  { what: '.breakdownName sobre .breakdownRow (base)', textSelector: '.breakdownName {', bgSelector: '.breakdownRow {', min: WCAG_AA_SMALL_TEXT },
  { what: ".breakdownName sobre .breakdownRow[aria-pressed='true']", textSelector: '.breakdownName {', bgSelector: ".breakdownRow[aria-pressed='true'] {", min: WCAG_AA_SMALL_TEXT },
  { what: '.breakdownCount sobre .breakdownRow:hover', textSelector: '.breakdownCount {', bgSelector: '.breakdownRow:hover {', min: WCAG_AA_SMALL_TEXT },
  // Textos del resumen sobre el fondo de la sección / el suyo propio.
  { what: '.summaryHint sobre .summary', textSelector: '.summaryHint {', bgSelector: '.summary {', min: WCAG_AA_SMALL_TEXT },
  { what: '.summaryEmpty sobre .summary', textSelector: '.summaryEmpty {', bgSelector: '.summary {', min: WCAG_AA_SMALL_TEXT },
  { what: '.breakdownTitle sobre .summary', textSelector: '.breakdownTitle {', bgSelector: '.summary {', min: WCAG_AA_SMALL_TEXT },
  { what: '.summaryError sobre su propio background-color', textSelector: '.summaryError {', bgSelector: '.summaryError {', min: WCAG_AA_SMALL_TEXT },
];

describe('AlertsPage.module.css — MEDIO-4: el contraste se calcula sobre los colores REALES del CSS', () => {
  it.each(CONTRAST_CONTRACTS)('$what cumple el mínimo WCAG AA', ({ textSelector, bgSelector, min }) => {
    const fg = cssColorOf(textSelector, 'color');
    const bg = cssColorOf(bgSelector, 'background-color');
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe('AlertsPage.module.css — MEDIO-4: el parser NO es una tautología', () => {
  it('evalúa el PORCENTAJE que declara el CSS: un color-mix al 60% de --color-primary REPRUEBA AA', () => {
    // Probe exacto del revisor: con `color-mix(... --color-primary 60%, --color-surface)`
    // el ratio de --color-gray-600 cae a ~3.38:1 (< 4.5). Si `resolveCssColor`
    // ignorara el porcentaje (como hacía el `mix(primary, surface, 8)`
    // hardcodeado de la versión anterior), esta expectativa fallaría.
    const gray600 = hexToRgb(resolveToken('--color-gray-600'));
    const bad = resolveCssColor('color-mix(in srgb, var(--color-primary) 60%, var(--color-surface))');
    const ratio = contrastRatio(gray600, bad);
    expect(ratio).toBeLessThan(WCAG_AA_SMALL_TEXT);
    expect(ratio).toBeCloseTo(3.383, 2);
  });

  it('evalúa los COLORES que declara el CSS: mismo 8%, pero sobre otro fondo base, reprueba', () => {
    const gray600 = hexToRgb(resolveToken('--color-gray-600'));
    // Mismo porcentaje (8%), pero el segundo color del mix ya no es
    // --color-surface sino el propio gris del texto: el fondo queda casi igual
    // al texto (~1.1:1). Si el parser ignorara los COLORES y solo mirara el %,
    // esto daría el mismo resultado que el fondo real y pasaría.
    const bad = resolveCssColor('color-mix(in srgb, var(--color-primary) 8%, var(--color-gray-600))');
    expect(contrastRatio(gray600, bad)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('el fondo de :hover se LEE del CSS (no se asume --color-surface-hover)', () => {
    // Si alguien cambia `.kpiTile:hover` a otro token, esta igualdad cae y hay
    // que revisar el contraste — pero además la tabla de arriba recalcula sola.
    expect(cssColorOf('.kpiTile:hover {', 'background-color')).toEqual(
      hexToRgb(resolveToken('--color-surface-hover')),
    );
    expect(cssColorOf('.breakdownRow:hover {', 'background-color')).toEqual(
      hexToRgb(resolveToken('--color-surface-hover')),
    );
  });

  it('el fondo activo se LEE del CSS y es un color-mix real (no el gris de :hover)', () => {
    const pressed = cssColorOf(".kpiTile[aria-pressed='true'] {", 'background-color');
    const hover = cssColorOf('.kpiTile:hover {', 'background-color');
    expect(pressed).not.toEqual(hover);
    expect(declaration(extractRule(css, ".kpiTile[aria-pressed='true'] {"), 'background-color')).toMatch(
      /^color-mix\(/,
    );
  });

  it('el selector se ancla a principio de línea: `.breakdownSource {` NO resuelve a la regla del estado activo', () => {
    const base = cssColorOf('.breakdownSource {', 'color');
    const pressed = cssColorOf(".breakdownRow[aria-pressed='true'] .breakdownSource {", 'color');
    expect(base).toEqual(hexToRgb(resolveToken('--color-text-secondary')));
    expect(pressed).toEqual(hexToRgb(resolveToken('--color-gray-600')));
    expect(base).not.toEqual(pressed);
  });

  it('un valor de color no soportado revienta (nunca pasa en silencio)', () => {
    expect(() => resolveCssColor('linear-gradient(90deg, red, blue)')).toThrow(/no soportado/i);
  });
});

describe('AlertsPage.module.css — M6: probes originales del review (documentados)', () => {
  it('--color-text-secondary sobre --color-surface-hover FALLABA AA — por eso el fix a --color-gray-600', () => {
    const textSecondary = hexToRgb(resolveToken('--color-text-secondary'));
    const surfaceHover = hexToRgb(resolveToken('--color-surface-hover'));
    expect(contrastRatio(textSecondary, surfaceHover)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('.kpiTile:hover/.kpiTile[aria-pressed] .kpiLabel usa --color-gray-600 (no --color-text-secondary)', () => {
    expect(cssColorOf('.kpiTile:hover .kpiLabel,', 'color')).toEqual(hexToRgb(resolveToken('--color-gray-600')));
    expect(cssColorOf(".kpiTile[aria-pressed='true'] .kpiLabel {", 'color')).toEqual(
      hexToRgb(resolveToken('--color-gray-600')),
    );
  });

  it('.breakdownRow hover/activo aplica el mismo fix a .breakdownSource', () => {
    expect(cssColorOf('.breakdownRow:hover .breakdownSource,', 'color')).toEqual(
      hexToRgb(resolveToken('--color-gray-600')),
    );
  });

  it('--color-text-secondary sobre --color-gray-50 (fondo heredado ANTES del fix de .summaryError) fallaba AA por poco', () => {
    const textSecondary = hexToRgb(resolveToken('--color-text-secondary'));
    const gray50 = hexToRgb(resolveToken('--color-gray-50'));
    expect(contrastRatio(textSecondary, gray50)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });
});
