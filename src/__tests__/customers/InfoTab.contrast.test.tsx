/**
 * InfoTab.module.css — contrato de contraste A11Y (combo-balance-honesto,
 * A11Y-1 (A)). Molde EXACTO de `FinancialSection.contrast.test.tsx`: se lee
 * el `.css` crudo y se calcula el ratio WCAG 2.1 a mano sobre los tokens
 * reales de `tokens/variables.css` — nada de estimaciones.
 *
 * Cubre los pares del design (§8): los 6 hex crudos migrados
 * (`#fee2e2 #991b1b #dc2626 #dcfce7 #166534` — `#b91c1c` se fue con la rama
 * `.balanceOverdue` eliminada) + los 3 pares NUEVOS
 * (`.balanceUnknown`, `.balanceCredit`, `.balanceStaleChip`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '..', '..', 'pages', 'customers', 'tabs', 'InfoTab.module.css');
const rawCss = readFileSync(cssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

// El CSS de este change documenta los hex ORIGINALES en comentarios (para
// explicar la migración) — hay que filtrarlos antes de matchear literales,
// si no el propio comentario dispara el assert de "cero hex crudo".
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
// InfoTab renderiza sobre .card { background: var(--color-surface) }.
const SURFACE = hexToRgb(resolveToken('--color-surface'));

describe('InfoTab.module.css — cero hex crudo en las reglas .balance* (A11Y-1 (A))', () => {
  it('ninguna declaración color/background(-color) de .balance* contiene un literal #RRGGBB', () => {
    const balanceBlockStart = css.indexOf('.balanceTimestamp');
    const balanceSection = css.slice(balanceBlockStart);
    const colorDecls = balanceSection.match(/(?:^|[\s;{])(color|background|background-color):\s*([^;]+);/gm) ?? [];
    expect(colorDecls.length).toBeGreaterThan(0);
    for (const decl of colorDecls) {
      expect(decl).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

describe('InfoTab.module.css — contraste de los pares MIGRADOS (ex-hex crudo)', () => {
  it('.balanceDebtorBadge usa --badge-late-bg/-fg y cumple >= 4.5:1', () => {
    const block = extractRule(css, '.balanceDebtorBadge {');
    expect(extractDeclValue(block, 'background')).toBe('var(--badge-late-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-late-fg)');
    const bg = hexToRgb(resolveToken('--badge-late-bg'));
    const fg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.balanceAmount usa --badge-late-fg (NO el #dc2626 crudo original) y cumple >= 4.5:1 sobre la superficie', () => {
    const block = extractRule(css, '.balanceAmount {');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-late-fg)');
    const fg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(fg, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.balanceCheckIcon usa --badge-paid-bg/-fg y cumple >= 4.5:1', () => {
    const block = extractRule(css, '.balanceCheckIcon {');
    expect(extractDeclValue(block, 'background')).toBe('var(--badge-paid-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-paid-fg)');
    const bg = hexToRgb(resolveToken('--badge-paid-bg'));
    const fg = hexToRgb(resolveToken('--badge-paid-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('InfoTab.module.css — contraste de los pares NUEVOS (CARD-1/2/4)', () => {
  it('.balanceUnknown usa --color-text-secondary y cumple >= 4.5:1 sobre la superficie', () => {
    const block = extractRule(css, '.balanceUnknown {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
    const fg = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(fg, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.balanceCredit / .balanceCreditBadge usan --badge-paid-fg y cumplen >= 4.5:1', () => {
    const amountBlock = extractRule(css, '.balanceCredit {');
    expect(extractDeclValue(amountBlock, 'color')).toBe('var(--badge-paid-fg)');
    const badgeBlock = extractRule(css, '.balanceCreditBadge {');
    expect(extractDeclValue(badgeBlock, 'background')).toBe('var(--badge-paid-bg)');
    expect(extractDeclValue(badgeBlock, 'color')).toBe('var(--badge-paid-fg)');

    const fg = hexToRgb(resolveToken('--badge-paid-fg'));
    const bg = hexToRgb(resolveToken('--badge-paid-bg'));
    expect(contrastRatio(fg, SURFACE)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.balanceStaleChip usa --color-warning-bg/-fg y cumple >= 4.5:1', () => {
    const block = extractRule(css, '.balanceStaleChip {');
    expect(extractDeclValue(block, 'background')).toBe('var(--color-warning-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-warning-fg)');
    const bg = hexToRgb(resolveToken('--color-warning-bg'));
    const fg = hexToRgb(resolveToken('--color-warning-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
