/**
 * MessageItem.contrast.test.tsx — contrato de contraste de las 3 lanes
 * (ticket-messaging-ui). Mismo patrón que
 * `MessageBubble.note.contrast.test.tsx` (WhatsApp inbox): jsdom/happy-dom no
 * computa color contra fondo real, así que el contrato se valida leyendo el
 * `.css` crudo y calculando el ratio WCAG 2.1 a mano sobre los tokens reales
 * de `tokens/variables.css`. Los PARES de tokens usados acá (--color-note-*,
 * --color-primary-hover/--color-white, --color-gray-100/--color-text-primary)
 * son los MISMOS que `MessageBubble.module.css` ya reafirma — no se
 * re-inventa el número, se verifica que este módulo los usa (mismo criterio
 * "sin hex crudo") y se reafirma el ratio contra el CSS real de ESTE módulo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging', 'MessageItem.module.css'), 'utf-8');
const tokensCss = readFileSync(join(__dirname, '..', '..', '..', 'tokens', 'variables.css'), 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function extractRule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
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

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relLuminance(a);
  const l2 = relLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const WCAG_AA_SMALL_TEXT = 4.5;
const WCAG_UI_MIN = 3;

describe('MessageItem.module.css — tokens (sin hex crudo)', () => {
  it('.note .bubble usa --color-note-bg/--color-note-fg (NUNCA --badge-blocked-* — mentira semántica)', () => {
    const block = extractRule(css, '.note .bubble {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--color-note-bg)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-note-fg)');
  });

  it('.staff .bubble (respuesta pública al cliente) usa --color-primary-hover/--color-white', () => {
    const block = extractRule(css, '.staff .bubble {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--color-primary-hover)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-white)');
  });

  it('.client .bubble (mensaje del cliente) usa --color-gray-100/--color-text-primary', () => {
    const block = extractRule(css, '.client .bubble {');
    expect(extractDeclValue(block, 'background-color')).toBe('var(--color-gray-100)');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-primary)');
  });

  it('ningún selector del módulo usa un color hex crudo (todo pasa por var(--color-*))', () => {
    // Matchea un hex de 3/6/8 dígitos que NO esté dentro de un comentario de bloque.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('MessageItem.module.css — contraste WCAG 2.1', () => {
  it('nota interna: --color-note-fg sobre --color-note-bg cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('nota interna: --color-note-accent (ícono/borde) sobre --color-note-bg cumple >= 3:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const accent = hexToRgb(resolveToken('--color-note-accent'));
    expect(contrastRatio(accent, bg)).toBeGreaterThanOrEqual(WCAG_UI_MIN);
  });

  it('respuesta pública del staff: --color-white sobre --color-primary-hover cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-primary-hover'));
    const fg = hexToRgb(resolveToken('--color-white'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('mensaje del cliente: --color-text-primary sobre --color-gray-100 cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-gray-100'));
    const fg = hexToRgb(resolveToken('--color-text-primary'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('.time/.sender (opacity 0.85/0.92) siguen cumpliendo >= 4.5:1 en la lane staff (peor caso: blanco atenuado sobre azul)', () => {
    const bg = hexToRgb(resolveToken('--color-primary-hover'));
    const white: Rgb = [255, 255, 255];
    const timeOpacity = parseFloat(extractDeclValue(extractRule(css, '.time {'), 'opacity'));
    const blended: Rgb = [0, 1, 2].map((i) => timeOpacity * white[i]! + (1 - timeOpacity) * bg[i]!) as Rgb;
    expect(contrastRatio(blended, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
