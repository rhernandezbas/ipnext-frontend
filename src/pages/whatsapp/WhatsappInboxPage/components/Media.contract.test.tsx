/**
 * Media.module.css — contrato CSS (fix wave post-review-adversarial de
 * messaging-inbox-v2-media, 2 reviewers). Se lee el `.css` crudo vía
 * `fs.readFileSync` (mismo patrón que `MessageThread.contract.test.tsx`/
 * `Composer.contract.test.tsx`) — jsdom no computa layout real, así que un
 * overflow horizontal o un hover sin gatear se verifican sobre el texto del
 * módulo, no sobre un DOM renderizado.
 *
 * #3 (ALTO, overflow horizontal a 375px): `.mediaAudioWrapper` tenía
 * `min-width: 240px` fijo. `MessageThread.module.css` (`.list`) tiene
 * `overflow-y` (scroll vertical del thread) — eso hace que el eje X se
 * compute en `auto`, así que un `min-width` fijo mayor al ancho disponible
 * real (~221px a 375px de viewport, con el padding de la burbuja) generaba
 * scroll horizontal genuino. Fix: `min-width: min(240px, 100%)` — el
 * `<audio controls>` nativo se achica sin problema.
 *
 * #9 (LOW, hover sin gatear): `.errorRetryBtn:hover` era la ÚNICA regla
 * `:hover` de este módulo sin envolver en `@media (hover:hover) and
 * (pointer:fine)` — el resto (`.mediaImageWrapper:hover`,
 * `.mediaFileDownload:hover`) sí lo hace, evitando que un tap en touch quede
 * "pegado" en estado hover.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssPath = join(__dirname, 'Media.module.css');
const css = readFileSync(cssPath, 'utf-8');

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

describe('Media.module.css — bug ALTO #3 (overflow horizontal de MediaAudio a 375px)', () => {
  it('.mediaAudioWrapper usa min-width: min(240px, 100%) — nunca fuerza un ancho fijo mayor al disponible', () => {
    const block = extractRule(css, '.mediaAudioWrapper {');
    expect(extractDeclValue(block, 'min-width')).toBe('min(240px, 100%)');
  });
});

describe('Media.module.css — bug LOW #9 (errorRetryBtn:hover sin gatear por hover:hover)', () => {
  it('.errorRetryBtn:hover está envuelto en @media (hover: hover) and (pointer: fine), como el resto del módulo', () => {
    const idx = css.indexOf('.errorRetryBtn:hover');
    expect(idx).toBeGreaterThan(-1);
    const mediaStart = css.lastIndexOf('@media (hover: hover) and (pointer: fine)', idx);
    expect(mediaStart).toBeGreaterThan(-1);
    // El media query encontrado tiene que ENVOLVER a .errorRetryBtn:hover — su
    // llave de cierre debe aparecer DESPUÉS de la regla, no antes.
    const mediaOpenBrace = css.indexOf('{', mediaStart);
    let depth = 0;
    let i = mediaOpenBrace;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const mediaCloseBrace = i;
    expect(idx).toBeGreaterThan(mediaOpenBrace);
    expect(idx).toBeLessThan(mediaCloseBrace);
  });
});
