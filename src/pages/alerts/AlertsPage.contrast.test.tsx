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
 *
 * MEDIO-4 + BAJO-1 (3ª review adversarial): los helpers de parseo se mudaron a
 * `@/test/cssContract` — ver ahí el porqué (el pase silencioso de los hex con
 * alpha, y el `resolveToken` sin anclar ni escapar que resolvía
 * `--color-.rimary` a `#0d6efd`). Este archivo se queda SOLO con los contratos
 * de contraste, que es lo suyo.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  contrastRatio,
  declaration,
  extractRule,
  hexToRgb,
  makeTokenResolver,
  mix,
  readCss,
  type Rgb,
} from '@/test/cssContract';

const cssPath = join(__dirname, 'AlertsPage.module.css');
const css = readCss(cssPath);

const tokensCssPath = join(__dirname, '..', '..', 'tokens', 'variables.css');
const tokensCss = readCss(tokensCssPath);

const resolveToken = makeTokenResolver(tokensCss);

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
  // BAJO-3: el indicador de mezcla ("×1") es font-size-xs — el más chico y el
  // más sensible al contraste. Los TRES fondos de la fila, con una sola regla.
  { what: '.breakdownMix sobre .breakdownRow (base)', textSelector: '.breakdownMix {', bgSelector: '.breakdownRow {', min: WCAG_AA_SMALL_TEXT },
  { what: '.breakdownMix sobre .breakdownRow:hover', textSelector: '.breakdownMix {', bgSelector: '.breakdownRow:hover {', min: WCAG_AA_SMALL_TEXT },
  { what: ".breakdownMix sobre .breakdownRow[aria-pressed='true']", textSelector: '.breakdownMix {', bgSelector: ".breakdownRow[aria-pressed='true'] {", min: WCAG_AA_SMALL_TEXT },
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

  /**
   * MEDIO-4 (3ª review adversarial): el docblock prometía "sintaxis desconocida
   * = throw, nunca un pase silencioso" y el parser tenía un pase silencioso
   * justo ahí. `resolveToken` aceptaba `#[0-9a-fA-F]{3,8}` pero `hexToRgb` solo
   * manejaba 3 y 6 dígitos: con un hex de 8 (con canal alpha) NO tiraba —
   * decodificaba MAL, leyendo `GG BB AA` como `RR GG BB`.
   * Probe del revisor: `#0d6efd80` → `[110, 253, 128]`, un color INVENTADO.
   * El día que alguien metiera un token con alpha en `variables.css`, los 20
   * contratos de arriba se calcularían sobre ese color fantasma y pasarían.
   *
   * El contraste de un color con alpha NO es computable sin saber qué hay
   * detrás, así que la única respuesta honesta es fallar ruidosamente.
   */
  it('MEDIO-4: un hex de 8 dígitos (con alpha) REVIENTA — antes decodificaba mal en silencio', () => {
    // Rastro del defecto: así decodificaba el parser viejo (`parseInt` sobre los
    // 8 dígitos y shifts de 16/8 → leía GG BB AA como si fueran RR GG BB).
    const decodeComoElParserViejo = (hex: string) => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    expect(decodeComoElParserViejo('#0d6efd80')).toEqual([110, 253, 128]);
    // …un color INVENTADO, y sin tirar. Ahora tira.
    expect(() => hexToRgb('#0d6efd80')).toThrow(/alpha/i);
    expect(() => resolveCssColor('#0d6efd80')).toThrow(/alpha/i);
  });

  it('MEDIO-4: un hex de 4 dígitos (#rgba) también revienta', () => {
    expect(() => hexToRgb('#0d6f')).toThrow(/alpha/i);
    expect(() => resolveCssColor('#0d6f')).toThrow(/alpha/i);
  });

  it('MEDIO-4: cualquier otro largo de hex revienta (5, 7) — solo #rgb y #rrggbb son válidos', () => {
    expect(() => hexToRgb('#0d6ef')).toThrow(/largo no soportado/i);
    expect(() => hexToRgb('#0d6efd1')).toThrow(/largo no soportado/i);
    // …y los válidos siguen funcionando.
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#0d6efd')).toEqual([13, 110, 253]);
  });

  /**
   * BAJO-1 (3ª review adversarial): `resolveToken` usaba una regex SIN anclar y
   * SIN `escapeRegExp` — que sí se usaban en `extractRule` y `declaration`, en
   * el mismo archivo. Probado por el revisor:
   * `resolveToken('--color-.rimary')` devolvía `#0d6efd`, porque el `.` de la
   * regex matcheaba la `p` de `--color-primary`.
   */
  it('BAJO-1: resolveToken escapa el nombre — un metacarácter de regex NO puede resolver a otro token', () => {
    expect(resolveToken('--color-primary')).toBe('#0d6efd');
    expect(() => resolveToken('--color-.rimary')).toThrow(/no encontrado/i);
    expect(() => resolveToken('--color-primar[yz]')).toThrow(/no encontrado/i);
  });

  it('BAJO-1: resolveToken se ancla — un token no puede resolverse por ser SUFIJO de otro', () => {
    // `--color-gray-600` existe; `-gray-600` (sufijo del anterior) NO es un token.
    expect(() => resolveToken('-gray-600')).toThrow(/no encontrado/i);
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
