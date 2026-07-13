/**
 * MessageBubble.module.css — contrato de contraste A11Y-1 (bug #3,
 * post-review-adversarial). jsdom no computa color contra fondo real (no hay
 * motor de layout/paint), así que el contrato se valida leyendo el `.css`
 * crudo (mismo patrón que `WhatsappInboxPage.layout.test.tsx`: `fs.readFileSync`,
 * NO `?raw` de Vite — el plugin de CSS Modules intercepta esa query bajo
 * `classNameStrategy:'non-scoped'`) y calculando el ratio WCAG 2.1 a mano
 * (relative luminance + `(L1+0.05)/(L2+0.05)`) sobre los tokens reales de
 * `tokens/variables.css`.
 *
 * Antes del fix: `.outbound .bubble` usaba `--color-primary` (#0d6efd) de
 * fondo con texto blanco — incluso a opacity:1 el contraste apenas roza
 * 4.5:1 (~4.50), así que CUALQUIER opacity < 1 en `.time`/`.sender` (0.7/0.85
 * originales) caía por debajo (2.97:1 / 3.68:1). Fix: fondo outbound pasa a
 * `--color-primary-hover` (#0b5ed7, YA tokenizado — cero hex nuevo) + opacity
 * subida (`.time` 0.85, `.sender` 0.92) — deja margen real (~4.66:1 / ~5.19:1).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bubbleCssPath = join(__dirname, 'MessageBubble.module.css');
const bubbleCss = readFileSync(bubbleCssPath, 'utf-8');

const tokensCssPath = join(__dirname, '..', '..', '..', '..', 'tokens', 'variables.css');
const tokensCss = readFileSync(tokensCssPath, 'utf-8');

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
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => alpha * fg[i]! + (1 - alpha) * bg[i]!) as Rgb;
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

const WCAG_AA_SMALL_TEXT = 4.5;

describe('MessageBubble.module.css — bug #3 (A11Y-1: contraste outbound >= 4.5:1)', () => {
  it('.outbound .bubble usa --color-primary-hover (NO --color-primary — ese ni con opacity:1 deja margen)', () => {
    const block = extractRule(bubbleCss, '.outbound .bubble {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--color-primary-hover)');
  });

  it('.time sobre el fondo outbound cumple >= 4.5:1 con su opacity actual', () => {
    const outboundBg = hexToRgb(resolveToken('--color-primary-hover'));
    const white = hexToRgb(resolveToken('--color-white'));
    const timeBlock = extractRule(bubbleCss, '.time {');
    const opacity = parseFloat(extractDeclValue(timeBlock, 'opacity'));

    const blended = blend(white, outboundBg, opacity);
    expect(contrastRatio(blended, outboundBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.sender sobre el fondo outbound cumple >= 4.5:1 con su opacity actual', () => {
    const outboundBg = hexToRgb(resolveToken('--color-primary-hover'));
    const white = hexToRgb(resolveToken('--color-white'));
    const senderBlock = extractRule(bubbleCss, '.sender {');
    const opacity = parseFloat(extractDeclValue(senderBlock, 'opacity'));

    const blended = blend(white, outboundBg, opacity);
    expect(contrastRatio(blended, outboundBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('inbound (texto oscuro sobre gray-100) sigue cumpliendo >= 4.5:1 — el fix de outbound no lo rompe', () => {
    const inboundBg = hexToRgb(resolveToken('--color-gray-100'));
    const darkText = hexToRgb(resolveToken('--color-text-primary'));
    const timeBlock = extractRule(bubbleCss, '.time {');
    const senderBlock = extractRule(bubbleCss, '.sender {');
    const timeOpacity = parseFloat(extractDeclValue(timeBlock, 'opacity'));
    const senderOpacity = parseFloat(extractDeclValue(senderBlock, 'opacity'));

    const blendedTime = blend(darkText, inboundBg, timeOpacity);
    const blendedSender = blend(darkText, inboundBg, senderOpacity);
    expect(contrastRatio(blendedTime, inboundBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
    expect(contrastRatio(blendedSender, inboundBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('MessageBubble.module.css — bug CRÍTICO #2 (contraste "failed" 2.64:1 + foco invisible 1.3:1)', () => {
  it('.deliveryFailed NO fija un color propio — hereda --color-white de la burbuja outbound (los botones Reintentar/Descartar ya heredan `color:inherit`)', () => {
    const block = extractRule(bubbleCss, '.deliveryFailed {');
    expect(block).not.toMatch(/color:\s*var\(--color-text-primary\)/);
  });

  it('el texto "No se pudo enviar" sobre el fondo outbound cumple >= 4.5:1 (blanco pleno, sin opacity)', () => {
    const outboundBg = hexToRgb(resolveToken('--color-primary-hover'));
    const white = hexToRgb(resolveToken('--color-white'));
    expect(contrastRatio(white, outboundBg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('el focus-visible de Reintentar/Descartar cumple >= 3:1 contra el fondo outbound (WCAG 2.1 SC 1.4.11, no --color-primary — ese es ~1.3:1 sobre sí mismo)', () => {
    const outboundBg = hexToRgb(resolveToken('--color-primary-hover'));
    const start = bubbleCss.indexOf('.deliveryRetryBtn:focus-visible,');
    expect(start).toBeGreaterThan(-1);
    const open = bubbleCss.indexOf('{', start);
    const close = bubbleCss.indexOf('}', open);
    const block = bubbleCss.slice(open + 1, close);
    const outlineDecl = extractDeclValue(block, 'outline');
    expect(outlineDecl).not.toMatch(/--color-primary\)/);

    const tokenMatch = outlineDecl.match(/var\((--[a-z0-9-]+)\)/i);
    expect(tokenMatch).not.toBeNull();
    const outlineColor = hexToRgb(resolveToken(tokenMatch![1]!));
    expect(contrastRatio(outlineColor, outboundBg)).toBeGreaterThanOrEqual(3);
  });
});
