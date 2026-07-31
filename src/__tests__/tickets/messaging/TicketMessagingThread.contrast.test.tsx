/**
 * TicketMessagingThread.contrast.test.tsx — mismo patrón que
 * `MessageItem.contrast.test.tsx`: sin hex crudo, y los pares de token
 * usados (--badge-active-*, --badge-late-*) cumplen >= 4.5:1 contra
 * `tokens/variables.css` real.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
  join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging', 'TicketMessagingThread.module.css'),
  'utf-8',
);
const tokensCss = readFileSync(join(__dirname, '..', '..', '..', 'tokens', 'variables.css'), 'utf-8');

type Rgb = [number, number, number];

function resolveToken(name: string): string {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`Token "${name}" no encontrado.`);
  return m[1]!;
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

describe('TicketMessagingThread.module.css — sin hex crudo', () => {
  it('no tiene ningún color hex fuera de comentarios', () => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('TicketMessagingThread.module.css — contraste WCAG 2.1', () => {
  it('.unreadBadge (--badge-active-fg sobre --badge-active-bg) cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--badge-active-bg'));
    const fg = hexToRgb(resolveToken('--badge-active-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('.errorText (--badge-late-fg sobre --badge-late-bg) cumple >= 4.5:1', () => {
    const bg = hexToRgb(resolveToken('--badge-late-bg'));
    const fg = hexToRgb(resolveToken('--badge-late-fg'));
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
