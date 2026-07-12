/**
 * MessageThread.module.css — contrato CSS de motion (bug #10,
 * post-review-adversarial). `.swap` es un fade de opacity PURA
 * (`waThreadSwap` no anima `transform`) — matarlo con `animation:none` bajo
 * `prefers-reduced-motion` lo dejaba con "zero feedback" (el thread nuevo
 * aparecía de golpe). Fix: sin movimiento que dropear, no hace falta ningún
 * override — se lee el `.css` crudo (mismo patrón que
 * `WhatsappInboxPage.layout.test.tsx`) para confirmar que el bloque
 * reduced-motion ya no anula `.swap`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const threadCssPath = join(__dirname, 'MessageThread.module.css');
const threadCss = readFileSync(threadCssPath, 'utf-8');

function extractRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('MessageThread.module.css — bug #10 (reduced-motion conserva el crossfade de opacity pura)', () => {
  it('.swap sigue declarando su animation incondicionalmente (waThreadSwap)', () => {
    const swapBlock = extractRule(threadCss, '.swap {');
    expect(swapBlock).toMatch(/animation:\s*waThreadSwap\s+160ms\s+var\(--wa-ease-out\)\s+both/);
  });

  it('ya NO existe una regla que mate .swap bajo prefers-reduced-motion', () => {
    expect(threadCss).not.toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.swap\s*\{[^}]*animation:\s*none/);
  });
});
