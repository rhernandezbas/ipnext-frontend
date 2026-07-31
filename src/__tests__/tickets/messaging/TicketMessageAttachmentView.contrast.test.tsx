/**
 * TicketMessageAttachmentView.contrast.test.tsx — FIX WAVE H3 (HIGH). Este
 * módulo era el ÚNICO de `messaging/` sin test de contraste, y era justo
 * donde el review adversarial midió 8 fallos: `TicketMessageAttachmentView`
 * fijaba `--color-text-secondary`/`--color-primary` (colores pensados para
 * fondo blanco) pero SIEMPRE se renderiza DENTRO de una burbuja de
 * `MessageItem` (nota ámbar / staff azul-oscuro / cliente gris) — nunca
 * suelto sobre blanco. Medido a mano ANTES del fix (fórmula WCAG 2.1,
 * luminancia relativa — mismo patrón que `MessageItem.contrast.test.tsx`):
 *
 *   .fileLink (--color-primary) en lane staff (--color-primary-hover) → 1.30:1
 *   .mediaCaption/.unavailable (--color-text-secondary) en staff          → 1.25:1
 *   .fileLink en lane note (--color-note-bg)                              → 4.04:1
 *   .mediaCaption/.unavailable en lane note                               → 4.21:1
 *   .fileLink en lane client (--color-gray-100)                          → 3.80:1
 *   .mediaCaption/.unavailable en lane client                            → 3.95:1
 *
 * Los 6 pares fallan 4.5:1 (y 2 de ellos — staff — ni siquiera llegan a
 * 3:1). El fix (`color: inherit` en `.fileLink`/`.mediaCaption`/`.unavailable`)
 * hereda el color que `MessageItem.module.css` YA fija por lane
 * (`--color-note-fg`/`--color-white`/`--color-text-primary`, cada uno
 * verificado >=4.5:1 contra su propio fondo). Este archivo:
 *   1. fija el contrato `color: inherit` (no vuelve a pasar sin que este test rompa),
 *   2. recalcula los 3 ratios finales (uno por lane) contra los tokens reales,
 *   3. documenta el CONTRAFÁCTICO — el par PRE-fix medía por debajo de 4.5:1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const messagingDir = join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging');
const css = readFileSync(join(messagingDir, 'TicketMessageAttachmentView.module.css'), 'utf-8');
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

describe('TicketMessageAttachmentView.module.css — sin hex crudo', () => {
  it('no tiene ningún color hex fuera de comentarios', () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('TicketMessageAttachmentView.module.css — contrato color: inherit (H3)', () => {
  it('.fileLink hereda el color de la burbuja (color: inherit) — NUNCA un color fijo pensado para blanco', () => {
    const block = extractRule(css, '.fileLink {');
    expect(extractDeclValue(block, 'color')).toBe('inherit');
  });

  it('.mediaCaption hereda el color de la burbuja', () => {
    const block = extractRule(css, '.mediaCaption {');
    expect(extractDeclValue(block, 'color')).toBe('inherit');
  });

  it('.unavailable hereda el color de la burbuja', () => {
    const block = extractRule(css, '.unavailable {');
    expect(extractDeclValue(block, 'color')).toBe('inherit');
  });
});

describe('TicketMessageAttachmentView — ratios finales por lane (heredados de MessageItem, WCAG 2.1)', () => {
  it('lane nota: --color-note-fg heredado sobre --color-note-bg cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('lane staff (respuesta al cliente): --color-white heredado sobre --color-primary-hover cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-primary-hover'));
    const fg = hexToRgb(resolveToken('--color-white'));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('lane cliente: --color-text-primary heredado sobre --color-gray-100 cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-gray-100'));
    const fg = hexToRgb(resolveToken('--color-text-primary'));
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('CONTRAFÁCTICO — el par PRE-fix (--color-primary sobre --color-primary-hover, lane staff) efectivamente fallaba', () => {
    const staffBg = hexToRgb(resolveToken('--color-primary-hover'));
    const oldFileLinkColor = hexToRgb(resolveToken('--color-primary'));
    expect(contrastRatio(oldFileLinkColor, staffBg)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('CONTRAFÁCTICO — el par PRE-fix (--color-text-secondary sobre --color-primary-hover, lane staff) efectivamente fallaba', () => {
    const staffBg = hexToRgb(resolveToken('--color-primary-hover'));
    const oldSecondaryColor = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(oldSecondaryColor, staffBg)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('CONTRAFÁCTICO — el par PRE-fix (--color-text-secondary sobre --color-gray-100, lane cliente) efectivamente fallaba', () => {
    const clientBg = hexToRgb(resolveToken('--color-gray-100'));
    const oldSecondaryColor = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(oldSecondaryColor, clientBg)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });
});

// ── H3 "sumá también" — otros textos secundarios de la mensajería que no
// tenían test de contraste dedicado (.counter/.counterOver/.headerHint/.hint/
// .loginPrompt de ambos composers, .emptyState del hilo). Se recalculan acá
// contra sus superficies reales (--color-surface / --color-note-bg) para
// dejar el contrato completo en un solo lugar.

const replyCss = readFileSync(join(messagingDir, 'PublicReplyComposer.module.css'), 'utf-8');
const noteCss = readFileSync(join(messagingDir, 'NoteComposer.module.css'), 'utf-8');
const threadCss = readFileSync(join(messagingDir, 'TicketMessagingThread.module.css'), 'utf-8');

function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => alpha * fg[i]! + (1 - alpha) * bg[i]!) as Rgb;
}

describe('Textos secundarios de la mensajería — ratios finales (H3, cobertura sumada)', () => {
  it('PublicReplyComposer .counter (--color-text-secondary) sobre --color-surface cumple >= 4.5:1', () => {
    const block = extractRule(replyCss, '.counter {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
    const bg = hexToRgb(resolveToken('--color-surface'));
    const fg = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('PublicReplyComposer .counterOver (--badge-late-fg) sobre --color-surface cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-surface'));
    const fg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('PublicReplyComposer .headerHint/.hint/.loginPrompt (--color-text-secondary) sobre --color-surface cumplen >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-surface'));
    const fg = hexToRgb(resolveToken('--color-text-secondary'));
    const ratio = contrastRatio(fg, bg);
    for (const selector of ['.headerHint {', '.hint {', '.loginPrompt {']) {
      const block = extractRule(replyCss, selector);
      expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
    }
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('NoteComposer .headerHint (--color-note-fg a opacity 0.9) sobre --color-note-bg cumple >= 4.5:1', () => {
    const block = extractRule(noteCss, '.headerHint {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-note-fg)');
    const opacity = parseFloat(extractDeclValue(block, 'opacity'));
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const blended = blend(fg, bg, opacity);
    expect(contrastRatio(blended, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('NoteComposer .hint (--color-note-fg a opacity 0.85) sobre --color-note-bg cumple >= 4.5:1', () => {
    const block = extractRule(noteCss, '.hint {');
    const opacity = parseFloat(extractDeclValue(block, 'opacity'));
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    const blended = blend(fg, bg, opacity);
    expect(contrastRatio(blended, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('NoteComposer .loginPrompt (--color-note-fg) sobre --color-note-bg cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-bg'));
    const fg = hexToRgb(resolveToken('--color-note-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('TicketMessagingThread .emptyState (--color-text-secondary) sobre --color-surface (fondo ambiente) cumple >= 4.5:1', () => {
    const block = extractRule(threadCss, '.emptyState {');
    expect(extractDeclValue(block, 'color')).toBe('var(--color-text-secondary)');
    const bg = hexToRgb(resolveToken('--color-surface'));
    const fg = hexToRgb(resolveToken('--color-text-secondary'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});
