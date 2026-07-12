/**
 * Composer.module.css — contrato CSS de motion (bugs #9 y #10,
 * post-review-adversarial). Se lee el `.css` crudo vía `fs.readFileSync`
 * (mismo patrón que `WhatsappInboxPage.layout.test.tsx` — `?raw` de Vite
 * queda interceptado por el plugin de CSS Modules bajo
 * `classNameStrategy:'non-scoped'`).
 *
 * #9: `.error` no tenía fade de entrada (`.notice` sí) — inconsistencia
 * visual. #10: `.notice`/`.error`/`.swap` son fades de opacity PURA (sin
 * `transform`) — matarlos con `animation:none` bajo `prefers-reduced-motion`
 * los deja con "zero feedback"; la regla correcta es dropear MOVIMIENTO, no
 * feedback (no hay movimiento acá, así que no hace falta override alguno).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const composerCssPath = join(__dirname, 'Composer.module.css');
const composerCss = readFileSync(composerCssPath, 'utf-8');

function extractRule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector "${selector}" no encontrado en el CSS.`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractReducedMotionBlock(css: string): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start === -1) throw new Error('No se encontró el bloque @media (prefers-reduced-motion: reduce).');
  const openBraceIdx = css.indexOf('{', start);
  let depth = 0;
  let i = openBraceIdx;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return css.slice(openBraceIdx + 1, i);
}

describe('Composer.module.css — bug #9 (.error con el mismo fade de entrada que .notice)', () => {
  it('.error declara animation: waNoticeIn (mismo keyframe/timing que .notice)', () => {
    const errorBlock = extractRule(composerCss, '.error {');
    expect(errorBlock).toMatch(/animation:\s*waNoticeIn\s+200ms\s+var\(--wa-ease-out\)\s+both/);
  });
});

describe('Composer.module.css — bug #10 (reduced-motion conserva el fade de opacity pura)', () => {
  it('el bloque reduced-motion YA NO mata la animación de .notice ni de .error', () => {
    const block = extractReducedMotionBlock(composerCss);
    expect(block).not.toMatch(/\.notice\s*\{[^}]*animation:\s*none/);
    expect(block).not.toMatch(/\.error\s*\{[^}]*animation:\s*none/);
  });

  it('el bloque reduced-motion SIGUE neutralizando el scale real de :active (eso sí es movimiento)', () => {
    const block = extractReducedMotionBlock(composerCss);
    expect(block).toMatch(/\.sendButton:active:not\(:disabled\)\s*\{[^}]*transform:\s*none/);
  });
});
