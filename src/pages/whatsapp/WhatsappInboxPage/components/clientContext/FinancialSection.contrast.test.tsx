/**
 * FinancialSection.module.css (compartido: ClientContextPanel.module.css) —
 * contrato de contraste A11Y (messaging-inbox-v2 F1.5, tasks F4). Mismo
 * patrón que `MessageBubble.contrast.test.tsx`: se lee el `.css` crudo
 * (classNameStrategy:'non-scoped' intercepta `?raw`) y se calcula el ratio
 * WCAG 2.1 a mano sobre los tokens reales de `tokens/variables.css`.
 *
 * Cubre los 2 pares del design (§7.1): el monto de deuda en `--badge-late-fg`
 * sobre blanco (evita el `--color-danger` #dc3545 que da ~3.9:1) y el par
 * NUEVO `--badge-paid-bg/-fg` ("al día").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, '..', 'ClientContextPanel.module.css');
const css = readFileSync(cssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', '..', '..', '..', 'tokens', 'variables.css');
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

describe('ClientContextPanel.module.css — contraste FinancialSection (deuda roja + al-día verde)', () => {
  it('.fin-amountDebt usa --badge-late-fg (NO --color-danger, que da ~3.9:1 y falla 4.5:1)', () => {
    const block = extractRule(css, '.fin-amountDebt {');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-late-fg)');
  });

  it('.fin-amountDebt (--badge-late-fg sobre blanco) cumple >= 4.5:1', () => {
    const white = hexToRgb(resolveToken('--color-surface'));
    const debtFg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(debtFg, white)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.fin-badgePaid usa el par NUEVO --badge-paid-bg/--badge-paid-fg', () => {
    const block = extractRule(css, '.fin-badgePaid {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--badge-paid-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--badge-paid-fg)');
  });

  it('--badge-paid-bg/--badge-paid-fg cumple >= 4.5:1 (badge "Al día")', () => {
    const bg = hexToRgb(resolveToken('--badge-paid-bg'));
    const fg = hexToRgb(resolveToken('--badge-paid-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.fin-amountPaid (--badge-paid-fg sobre blanco) cumple >= 4.5:1', () => {
    const white = hexToRgb(resolveToken('--color-surface'));
    const paidFg = hexToRgb(resolveToken('--badge-paid-fg'));
    expect(contrastRatio(paidFg, white)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('los links del panel (id-link/cand-link/int-link) usan --color-primary-hover, NO --color-primary (~3.9:1, falla) — .svc-link se borró (CSS muerto, bug BAJO review adversarial)', () => {
    for (const selector of ['.id-link {', '.cand-link {', '.int-link {']) {
      const block = extractRule(css, selector);
      expect(extractDeclValue(block, 'color')).toBe('var(--color-primary-hover)');
    }
  });
});
