/**
 * CustomerDetailPage.module.css — contrato de contraste A11Y del SUB-HEADER
 * (combo-balance-honesto, fix wave FX2/FX3/FX6/FX13). Molde EXACTO de
 * `InfoTab.contrast.test.tsx` / `FinanceGrowthOverviewPage.contrast.test.tsx`:
 * se lee el `.css` crudo, se resuelven los tokens contra
 * `src/tokens/variables.css` y se calcula el ratio WCAG 2.1 a mano.
 *
 * Por qué existe: el apply migró los 6 hex crudos de `InfoTab.module.css` a
 * tokens y escribió el contract test de ESA card… y dejó al sub-header con
 * `#16a34a` crudo — el MISMO hex que este change documentó como bloqueante en
 * `FinanceGrowthOverviewPage.module.css`. 3.30:1 sobre blanco: FALLA AA. Y
 * encima pintaba de ese verde TODOS los estados (la deuda incluida).
 *
 * Cubre: los 4 tonos por estado (`.subHeaderValue*`), el sufijo "a favor"
 * (`.subHeaderBalanceCredit`, que nadie testeaba) y el chip de frescura
 * (`.subHeaderStaleChip`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '..', '..', 'pages', 'customers', 'CustomerDetailPage.module.css');
const rawCss = readFileSync(cssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

// Los comentarios de este change CITAN hex (para explicar la migración) — hay
// que filtrarlos antes de matchear literales, si no el propio comentario
// dispara el assert de "cero hex crudo".
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const css = stripComments(rawCss);

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function extractRule(cssText: string, selector: string): string {
  const start = cssText.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = cssText.indexOf('{', start);
  const close = cssText.indexOf('}', open);
  return cssText.slice(open + 1, close);
}

function extractDeclValue(block: string, prop: string): string {
  const m = block.match(new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`Declaración "${prop}" no encontrada en el bloque.`);
  return m[1]!.trim();
}

function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgbA: Rgb, rgbB: Rgb): number {
  const l1 = relLuminance(rgbA);
  const l2 = relLuminance(rgbB);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

const WCAG_AA_SMALL_TEXT = 4.5;
// El sub-header es `.subHeader { background: var(--color-surface) }`.
const SURFACE = hexToRgb(resolveToken('--color-surface'));

/** Resuelve `color: var(--x);` de una regla y devuelve su RGB. */
function ruleColorRgb(selector: string, prop = 'color'): { token: string; rgb: Rgb } {
  const block = extractRule(css, selector);
  const value = extractDeclValue(block, prop);
  const token = value.match(/var\((--[a-z0-9-]+)\)/i)?.[1];
  if (!token) throw new Error(`"${selector}" → ${prop}: "${value}" no es un var(--*)`);
  return { token, rgb: hexToRgb(resolveToken(token)) };
}

describe('CustomerDetailPage.module.css — cero hex crudo en las reglas del sub-header (FX2/FX13)', () => {
  it('ninguna declaración de color/fondo/BORDE/outline de las reglas .subHeader* contiene un literal #RRGGBB', () => {
    // El recorte se hace sobre el CSS CRUDO (el marcador de fin es un
    // comentario: en el texto ya despojado no existe y el slice se comería el
    // bloque legacy de abajo, que sí tiene hex crudo a propósito). Recién
    // después se sacan los comentarios, que citan hex para explicar la
    // migración.
    const start = rawCss.indexOf('.subHeader {');
    const end = rawCss.indexOf('/* ── Legacy classes');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = stripComments(rawCss.slice(start, end));

    // FX13 (R2 F7): el scan original miraba SÓLO color/background — el CSS
    // nuevo usa tokens también en `border`, así que se pinea acá (un
    // `border: 1px solid #fde68a` crudo tenía que ser un hallazgo, no un
    // punto ciego).
    const decls =
      section.match(
        /(?:^|[\s;{])(color|background|background-color|border|border-color|border-top|border-bottom|border-left|border-right|outline|outline-color):\s*([^;]+);/gm,
      ) ?? [];
    expect(decls.length).toBeGreaterThan(0);
    for (const decl of decls) {
      expect(decl).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

describe('CustomerDetailPage.module.css — color POR ESTADO del valor del saldo (FX3)', () => {
  it('.subHeaderValueDebt usa --badge-late-fg (el MISMO rojo que .balanceAmount de la card) y cumple >= 4.5:1', () => {
    const { token, rgb } = ruleColorRgb('.subHeaderValueDebt {');
    expect(token).toBe('--badge-late-fg');
    expect(contrastRatio(rgb, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.subHeaderValueCredit usa --badge-paid-fg (el MISMO verde que .balanceCredit) y cumple >= 4.5:1', () => {
    const { token, rgb } = ruleColorRgb('.subHeaderValueCredit {');
    expect(token).toBe('--badge-paid-fg');
    expect(contrastRatio(rgb, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.subHeaderValueSettled usa --badge-paid-fg (el verde "al día" del .balanceCheckIcon) y cumple >= 4.5:1', () => {
    const { token, rgb } = ruleColorRgb('.subHeaderValueSettled {');
    expect(token).toBe('--badge-paid-fg');
    expect(contrastRatio(rgb, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.subHeaderValueUnknown usa --color-text-secondary (el gris de .balanceUnknown) y cumple >= 4.5:1', () => {
    const { token, rgb } = ruleColorRgb('.subHeaderValueUnknown {');
    expect(token).toBe('--color-text-secondary');
    expect(contrastRatio(rgb, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('la DEUDA no se pinta con el token del crédito (era el bug: todo del mismo verde)', () => {
    const debt = ruleColorRgb('.subHeaderValueDebt {').token;
    const credit = ruleColorRgb('.subHeaderValueCredit {').token;
    expect(debt).not.toBe(credit);
  });

  it('.subHeaderBalanceValue (base) NO fija un color propio que pise el tono por estado', () => {
    const block = extractRule(css, '.subHeaderBalanceValue {');
    expect(block).not.toMatch(/(?:^|[\s;{])color:/);
  });
});

describe('CustomerDetailPage.module.css — sufijo "a favor" y chip de frescura (R1 L8 / FX6)', () => {
  it('.subHeaderBalanceCredit usa --badge-paid-fg y cumple >= 4.5:1 sobre la superficie', () => {
    const { token, rgb } = ruleColorRgb('.subHeaderBalanceCredit {');
    expect(token).toBe('--badge-paid-fg');
    expect(contrastRatio(rgb, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.subHeaderStaleChip usa --color-warning-bg/-fg (el MISMO par que .balanceStaleChip) y cumple >= 4.5:1', () => {
    const block = extractRule(css, '.subHeaderStaleChip {');
    expect(extractDeclValue(block, 'background')).toBe('var(--color-warning-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-warning-fg)');
    const bg = hexToRgb(resolveToken('--color-warning-bg'));
    const fg = hexToRgb(resolveToken('--color-warning-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
