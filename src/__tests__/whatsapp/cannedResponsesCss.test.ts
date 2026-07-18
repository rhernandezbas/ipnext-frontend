/**
 * Respuestas rápidas / macros (Ola 4) — pins a nivel CSS (molde
 * `templateSendCardCss.test.ts`/`bulkA11y.test.ts`: parsea las CSS Modules
 * nuevas del change y verifica el cinturón anti-stacking-context).
 *
 * MOTION-1  NINGUNA de las CSS Modules nuevas usa `animation-fill-mode: both`
 *           (ni el shorthand `animation: … both`): en Chrome `both` RETIENE el
 *           stacking context del elemento mientras el fill sigue aplicado,
 *           aunque el keyframe final sea transform:none — anti-patrón que el
 *           repo arregló en `db18c0cf` tras 3 recurrencias EN PROD del dropdown
 *           enterrado. El `CannedResponsePicker` (popover position:absolute +
 *           z-index + transform en el keyframe) es JUSTO la categoría que muerde.
 * MOTION-2  el popover del picker entra con `backwards` (jamás `both`) y su
 *           keyframe termina en `transform: none` (sin residuo).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

/** CSS Modules NUEVAS de este change (Ola 4). */
const NEW_CSS = [
  'src/pages/whatsapp/WhatsappInboxPage/components/CannedResponsePicker.module.css',
  'src/components/settings/cannedResponses/CannedResponsesSection.module.css',
  'src/components/settings/cannedResponses/CannedResponseFormModal.module.css',
];

const PICKER_CSS = NEW_CSS[0];

function readCss(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

/** CSS SIN comentarios `/* … *​/` — los comentarios explicativos mencionan
 *  `animation-fill-mode: both` en prosa (para documentar la lección) y no deben
 *  contar como uso real de la propiedad. */
function readCssNoComments(relPath: string): string {
  return readCss(relPath).replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Bloque completo de un `@keyframes` por nombre, contando llaves anidadas (helper de `templateSendCardCss.test.ts`). */
function keyframesBlock(css: string, name: string): string {
  const marker = `@keyframes ${name}`;
  const start = css.indexOf(marker);
  expect(start, `@keyframes ${name}`).toBeGreaterThanOrEqual(0);
  const braceStart = css.indexOf('{', start);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return css.slice(braceStart, i);
}

describe('MOTION-1: ninguna CSS Module nueva usa fill-mode "both" (retiene stacking context → dropdown enterrado)', () => {
  for (const relPath of NEW_CSS) {
    it(`${relPath} — sin animation-fill-mode: both ni shorthand "animation: … both"`, () => {
      const css = readCssNoComments(relPath);
      expect(css, `${relPath}: animation-fill-mode: both`).not.toMatch(/animation-fill-mode:\s*both\b/);
      expect(css, `${relPath}: shorthand "animation: … both"`).not.toMatch(/animation:\s*[^;]*\bboth\b/);
    });
  }
});

describe('MOTION-2: el popover del picker entra con "backwards" y sin transform residual', () => {
  it('.popover usa una animación con fill-mode "backwards"', () => {
    const css = readCss(PICKER_CSS);
    expect(css).toMatch(/\.popover\s*\{[^}]*animation:\s*[\w-]+\s+[^;]*\bbackwards\b/);
  });

  it('todo @keyframes del picker que declara transform termina en transform: none', () => {
    const css = readCss(PICKER_CSS);
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of new Set(names)) {
      const block = keyframesBlock(css, name);
      const toBlock = block.match(/(?:to|100%)\s*\{([^}]*)\}/)?.[1] ?? '';
      if (/transform\s*:/.test(toBlock)) {
        expect(toBlock, `@keyframes ${name} — estado final sin transform residual`).toMatch(/transform:\s*none\s*;/);
      }
    }
  });
});
