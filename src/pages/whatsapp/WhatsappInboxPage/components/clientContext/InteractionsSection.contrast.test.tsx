/**
 * InteractionsSection.contrast.test.tsx (messaging-inbox-v2 F1.5 spec #2 —
 * ESTADOS ABIERTO/CERRADO). Clon del patrón de `FinancialSection.contrast.test.tsx`
 * (mismo `MessageBubble.contrast.test.tsx` original): se lee el `.css` crudo
 * (classNameStrategy:'non-scoped' intercepta `?raw`) y se calcula el ratio
 * WCAG 2.1 a mano sobre los tokens reales de `tokens/variables.css`.
 *
 * Cubre el tratamiento MUTED de los tickets/tareas cerrados (`.int-subjectClosed`,
 * `.int-itemClosed`, `.int-taskLabel`) — todos usan `--color-text-secondary`,
 * que sobre `--color-surface` da ~4.69:1 (cumple 4.5:1 AA small text).
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

describe('ClientContextPanel.module.css — contraste InteractionsSection (tickets/tareas cerrados, muted)', () => {
  it('.int-itemClosed usa --color-text-secondary (color base del ítem cerrado)', () => {
    const block = extractRule(css, '.int-itemClosed {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
  });

  it('.int-subjectClosed usa --color-text-secondary', () => {
    const block = extractRule(css, '.int-subjectClosed {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
  });

  it('.int-taskLabel (label "Cerrada"/"Descartada") usa --color-text-secondary', () => {
    const block = extractRule(css, '.int-taskLabel {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
  });

  it('--color-text-secondary sobre --color-surface cumple >= 4.5:1 (texto muted de cerrados)', () => {
    const white = hexToRgb(resolveToken('--color-surface'));
    const muted = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(muted, white)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
