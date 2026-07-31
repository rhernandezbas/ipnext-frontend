/**
 * ComposerFeedback.contrast.test.tsx — contraste WCAG 2.1 de los mensajes de
 * error/éxito de AMBOS composers (`NoteComposer`/`PublicReplyComposer`) y de
 * los acentos ámbar/azul de cada tarjeta. Mismo patrón que
 * `MessageItem.contrast.test.tsx`: se lee el `.css` crudo y se calcula el
 * ratio a mano contra `tokens/variables.css` (jsdom/happy-dom no computa
 * color real).
 *
 * Este archivo documenta un hallazgo REAL, no hipotético: medido a mano
 * (`node -e`, fórmula WCAG 2.1) ANTES de esta corrección, `--color-danger`
 * sobre `--color-note-bg` daba ~4.07:1 y `--color-success-strong` sobre
 * blanco daba ~3.30:1 — ambos por debajo de 4.5:1. Se migraron a
 * `--badge-late-*`/`--badge-paid-*` (superficie propia, ya usados en toda la
 * app, ~6.5-6.8:1) — este test fija esa corrección como contrato.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const messagingDir = join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging');
const noteCss = readFileSync(join(messagingDir, 'NoteComposer.module.css'), 'utf-8');
const replyCss = readFileSync(join(messagingDir, 'PublicReplyComposer.module.css'), 'utf-8');
const tokensCss = readFileSync(join(__dirname, '..', '..', '..', 'tokens', 'variables.css'), 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado en tokens/variables.css`);
  return m[1]!;
}

function extractRule(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado.`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

function extractDeclValue(block: string, prop: string): string {
  const m = block.match(new RegExp(`(?:^|[\\s;{])${prop}:\\s*([^;]+);`));
  if (!m) throw new Error(`Declaración "${prop}" no encontrada.`);
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

describe('NoteComposer/PublicReplyComposer — .error/.success usan superficie PROPIA (--badge-*), no texto plano sobre el fondo ambiente', () => {
  for (const [name, css] of [['NoteComposer', noteCss], ['PublicReplyComposer', replyCss]] as const) {
    it(`${name} .error usa --badge-late-bg/--badge-late-fg`, () => {
      const block = extractRule(css, '.error {');
      expect(extractDeclValue(block, 'background')).toBe('var(--badge-late-bg)');
      expect(extractDeclValue(block, 'color')).toBe('var(--badge-late-fg)');
    });

    it(`${name} .success usa --badge-paid-bg/--badge-paid-fg`, () => {
      const block = extractRule(css, '.success {');
      expect(extractDeclValue(block, 'background')).toBe('var(--badge-paid-bg)');
      expect(extractDeclValue(block, 'color')).toBe('var(--badge-paid-fg)');
    });
  }

  it('--badge-late-fg sobre --badge-late-bg cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--badge-late-bg'));
    const fg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('--badge-paid-fg sobre --badge-paid-bg cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--badge-paid-bg'));
    const fg = hexToRgb(resolveToken('--badge-paid-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });

  it('CONTRAFÁCTICO — el par PRE-fix (--color-danger sobre --color-note-bg) efectivamente fallaba (documenta el bug real)', () => {
    const noteBg = hexToRgb(resolveToken('--color-note-bg'));
    const danger = hexToRgb(resolveToken('--color-danger'));
    expect(contrastRatio(danger, noteBg)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });

  it('CONTRAFÁCTICO — el par PRE-fix (--color-success-strong sobre blanco) efectivamente fallaba', () => {
    const white = hexToRgb('#ffffff');
    const success = hexToRgb(resolveToken('--color-success-strong'));
    expect(contrastRatio(success, white)).toBeLessThan(WCAG_AA_SMALL_TEXT);
  });
});

describe('NoteComposer — submitBtn (amber) contraste', () => {
  it('--color-white sobre --color-note-accent cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--color-note-accent'));
    const fg = hexToRgb('#ffffff');
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_SMALL_TEXT);
  });
});

describe('Tarjetas — sin hex crudo (todo pasa por var(--color-*)/var(--badge-*))', () => {
  it('NoteComposer.module.css no tiene hex crudo fuera de comentarios', () => {
    const withoutComments = noteCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('PublicReplyComposer.module.css no tiene hex crudo fuera de comentarios', () => {
    const withoutComments = replyCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
