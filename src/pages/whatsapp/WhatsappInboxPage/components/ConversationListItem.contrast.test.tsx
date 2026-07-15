/**
 * ConversationListItem.contrast.test.tsx — contrato de contraste del chip de
 * campaña (messaging-bulk-inbox Change 2). Mismo criterio que
 * `Media.contrast.test.tsx`/`MessageBubble.contrast.test.tsx`: jsdom no computa
 * color contra fondo real, así que se lee el `.module.css` crudo y se calcula
 * el ratio WCAG 2.1 a mano sobre los tokens reales de `tokens/variables.css`.
 *
 * Principio (design §3, apple-design §12): el chip de campaña es una SUPERFICIE
 * PROPIA (fondo `--color-campaign-bg`, texto `--color-campaign-fg`) — el texto
 * NUNCA se apoya en el fondo variable de la fila (surface / surface-hover /
 * seleccionada = `--badge-active-bg`), así el contraste es determinístico sin
 * importar el estado de la fila. Regla INNEGOCIABLE de la tarea: contraste del
 * chip ≥ 4.5:1 CALCULADO.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const itemCss = readFileSync(join(__dirname, 'ConversationListItem.module.css'), 'utf-8');
const tokensCss = readFileSync(join(__dirname, '..', '..', '..', '..', 'tokens', 'variables.css'), 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function extractRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
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

describe('ConversationListItem.module.css — chip de campaña (contraste ≥ 4.5:1 CALCULADO)', () => {
  it('.campaignChip usa el fondo dedicado --color-campaign-bg (superficie propia, no la fila)', () => {
    const block = extractRule(itemCss, '.campaignChip {');
    expect(extractDeclValue(block, 'background')).toBe('var(--color-campaign-bg)');
  });

  it('.campaignName usa el texto dedicado --color-campaign-fg', () => {
    const block = extractRule(itemCss, '.campaignName {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-campaign-fg)');
  });

  it('--color-campaign-fg sobre --color-campaign-bg da ≥ 4.5:1', () => {
    const ratio = contrastRatio(
      hexToRgb(resolveToken('--color-campaign-fg')),
      hexToRgb(resolveToken('--color-campaign-bg')),
    );
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
