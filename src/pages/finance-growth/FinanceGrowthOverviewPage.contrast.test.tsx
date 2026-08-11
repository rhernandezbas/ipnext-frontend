/**
 * FinanceGrowthOverviewPage.module.css — contrato de contraste A11Y
 * (combo-balance-honesto, A11Y-1 (B), finance-sync-lane-visibility). Molde
 * EXACTO de `FinancialSection.contrast.test.tsx` / `InfoTab.contrast.test.tsx`.
 *
 * Cubre el par NUEVO `.syncLaneError` (design §7/§8): token PROPIO (NUNCA
 * reusa `.syncDegraded`, que significa otra cosa), `--color-danger` sobre
 * `--color-surface` — pasa AA por 3 centésimas (4.53:1): si el fondo del
 * panel cambia, este test lo caza.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, 'FinanceGrowthOverviewPage.module.css');
const css = readFileSync(cssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

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

describe('FinanceGrowthOverviewPage.module.css — .syncLaneError (A11Y-1 (B))', () => {
  it('usa un token var(--*) propio, no un literal #RRGGBB', () => {
    const block = extractRule(css, '.syncLaneError {');
    const value = extractDeclValue(block, 'color');
    expect(value).toMatch(/^var\(--/);
    expect(value).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('NO reusa --color-warning-fg (el token de .syncDegraded — significa otra cosa)', () => {
    const block = extractRule(css, '.syncLaneError {');
    expect(extractDeclValue(block, 'color')).not.toBe('var(--color-warning-fg)');
  });

  it('el color resuelto cumple >= 4.5:1 sobre --color-surface', () => {
    const block = extractRule(css, '.syncLaneError {');
    const value = extractDeclValue(block, 'color');
    const tokenName = value.match(/var\((--[a-z0-9-]+)\)/i)?.[1];
    expect(tokenName).toBeTruthy();
    const fg = hexToRgb(resolveToken(tokenName!));
    const surface = hexToRgb(resolveToken('--color-surface'));
    expect(contrastRatio(fg, surface)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
