/**
 * ComposerTouchTarget.test.tsx — FIX WAVE L1 (LOW). `.pendingRemove` de
 * ambos composers es un `<button>` CRUDO (no el átomo `Button`, que ya
 * resuelve esto vía `@media (pointer: coarse) { min-height: 44px; }`) — a
 * 24px de target es la mitad del mínimo táctil recomendado (44px, WCAG
 * 2.5.5/2.5.8). Mismo patrón que `Button.module.css`: en pointer fino se
 * queda compacto (24px, no infla la UI de escritorio), pero bajo
 * `pointer: coarse` sube a >=44px.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const messagingDir = join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging');
const replyCss = readFileSync(join(messagingDir, 'PublicReplyComposer.module.css'), 'utf-8');
const noteCss = readFileSync(join(messagingDir, 'NoteComposer.module.css'), 'utf-8');

/** Extrae el bloque `@media (pointer: coarse) { ... }` completo del CSS. */
function extractCoarseMediaBlock(source: string): string {
  const start = source.indexOf('@media (pointer: coarse)');
  if (start === -1) throw new Error('No hay bloque @media (pointer: coarse) en este módulo.');
  const open = source.indexOf('{', start);
  // Encuentra el cierre del @media balanceando llaves (contiene reglas anidadas).
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return source.slice(open + 1, i);
}

describe('PublicReplyComposer/NoteComposer — .pendingRemove sube a >=44px bajo pointer: coarse (L1)', () => {
  for (const [name, css] of [['PublicReplyComposer', replyCss], ['NoteComposer', noteCss]] as const) {
    it(`${name}.module.css tiene un @media (pointer: coarse) que sube .pendingRemove a min-width/min-height >= 44px`, () => {
      const block = extractCoarseMediaBlock(css);
      expect(block).toMatch(/\.pendingRemove\s*\{[^}]*min-width:\s*(44px|var\(--space-11\))/);
      expect(block).toMatch(/\.pendingRemove\s*\{[^}]*min-height:\s*(44px|var\(--space-11\))/);
    });
  }
});
