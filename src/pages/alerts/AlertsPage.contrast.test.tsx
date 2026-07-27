/**
 * AlertsPage.module.css — contrato de contraste (review adversarial, change
 * `noc-alerts-dashboard`, hallazgo M6 + bajo "summaryError"). jsdom no
 * computa color contra fondo real (no hay motor de layout/paint), así que el
 * contrato se valida leyendo el `.css` crudo (mismo patrón que
 * `MessageBubble.contrast.test.tsx` / `WhatsappInboxPage.layout.test.tsx`:
 * `fs.readFileSync`, NO `?raw` de Vite — el plugin de CSS Modules intercepta
 * esa query bajo `classNameStrategy:'non-scoped'`) y calculando el ratio WCAG
 * 2.1 a mano (relative luminance + `(L1+0.05)/(L2+0.05)`) sobre los tokens
 * reales de `tokens/variables.css`.
 *
 * M6 (antes del fix): `.kpiTile:hover` y `.kpiTile[aria-pressed='true']`
 * cambiaban el fondo a `--color-surface-hover` (#f0f0f5); `.kpiLabel` /
 * `.breakdownSource` seguían en `--color-text-secondary` (#6c757d) → 4.128:1,
 * FALLA AA (4.5:1). Fix: `--color-gray-600` (#495057) en esos estados —
 * recalculado: 7.2:1 sobre #f0f0f5, 7.33:1 sobre el nuevo fondo de
 * `[aria-pressed='true']` (tinte 8% de --color-primary sobre --color-surface).
 *
 * Bajo: `.summaryError` no tenía `background-color` propio → heredaba
 * `--color-gray-50` (#f8f9fa) del layout, y #6c757d ahí da 4.448:1 (falla por
 * 0.05). Fix: `background-color: var(--color-surface)` (blanco, mismo patrón
 * que `.summary`/`.errorState` hermanos) → 4.688:1.
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

function extractRule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

const WCAG_AA_SMALL_TEXT = 4.5;

describe('AlertsPage.module.css — M6 (contraste .kpiLabel/.breakdownSource en hover/activo >= 4.5:1)', () => {
  const surfaceHover = hexToRgb(resolveToken('--color-surface-hover'));
  const primary = hexToRgb(resolveToken('--color-primary'));
  const surface = hexToRgb(resolveToken('--color-surface'));
  const gray600 = hexToRgb(resolveToken('--color-gray-600'));
  const textSecondary = hexToRgb(resolveToken('--color-text-secondary'));
  // Mismo % que declara `.kpiTile[aria-pressed='true']` — si ese número
  // cambia en el CSS, este test debe fallar (no queda desincronizado en silencio).
  const pressedBg = mix(primary, surface, 8);

  it('--color-text-secondary sobre --color-surface-hover FALLABA AA (probe original, documentado)', () => {
    expect(contrastRatio(textSecondary, surfaceHover)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('.kpiTile:hover .kpiLabel usa --color-gray-600 (no --color-text-secondary)', () => {
    const block = extractRule(css, ".kpiTile:hover .kpiLabel,");
    expect(block).toMatch(/color:\s*var\(--color-gray-600\)/);
  });

  it('--color-gray-600 sobre --color-surface-hover (estado hover) cumple >= 4.5:1', () => {
    expect(contrastRatio(gray600, surfaceHover)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('--color-gray-600 sobre el fondo de [aria-pressed="true"] (tinte 8% primary/surface) cumple >= 4.5:1', () => {
    expect(contrastRatio(gray600, pressedBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.breakdownRow hover/activo aplica el mismo fix a .breakdownSource', () => {
    const block = extractRule(css, '.breakdownRow:hover .breakdownSource,');
    expect(block).toMatch(/color:\s*var\(--color-gray-600\)/);
  });
});

describe('AlertsPage.module.css — bajo (contraste .summaryError >= 4.5:1)', () => {
  it('.summaryError declara background-color propio (--color-surface)', () => {
    const block = extractRule(css, '.summaryError {');
    expect(block).toMatch(/background-color:\s*var\(--color-surface\)/);
  });

  it('--color-text-secondary sobre --color-gray-50 (fondo heredado ANTES del fix) fallaba AA por poco', () => {
    const textSecondary = hexToRgb(resolveToken('--color-text-secondary'));
    const gray50 = hexToRgb(resolveToken('--color-gray-50'));
    expect(contrastRatio(textSecondary, gray50)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('--color-text-secondary sobre --color-surface (fondo propio, DESPUÉS del fix) cumple >= 4.5:1', () => {
    const textSecondary = hexToRgb(resolveToken('--color-text-secondary'));
    const surface = hexToRgb(resolveToken('--color-surface'));
    expect(contrastRatio(textSecondary, surface)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
