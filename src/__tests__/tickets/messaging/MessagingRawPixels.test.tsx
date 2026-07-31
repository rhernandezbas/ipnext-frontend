/**
 * MessagingRawPixels.test.tsx — FIX WAVE L3 (LOW). Los `.module.css` de
 * `messaging/` tenían píxeles/duraciones crudos sin pasar por token
 * (2px/3px/8px/48px/480px/72px/120px/160px/320px/240px, 220ms/1.4s) — mismo
 * criterio que ya se exige para el color (`sin hex crudo`, ver los
 * `*.contrast.test.tsx`), acá para tamaño/duración.
 *
 * `outline`/`outline-offset: 2px` quedan AFUERA a propósito: es una
 * convención pre-existente de TODO el repo (`Button.module.css` ya lo usa
 * crudo, no lo introduce este branch) — mismo criterio que la excepción
 * documentada para `--color-border` en el review. Tokenizarlo SOLO acá
 * crearía una inconsistencia nueva, no arreglaría una vieja.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const messagingDir = join(__dirname, '..', '..', '..', 'pages', 'tickets', 'TicketDetailPage', 'components', 'messaging');
const files = [
  'MessageItem.module.css',
  'NoteComposer.module.css',
  'PublicReplyComposer.module.css',
  'TicketMessageAttachmentView.module.css',
  'TicketMessagingThread.module.css',
];

const FLAGGED = ['2px', '3px', '8px', '48px', '480px', '72px', '120px', '160px', '320px', '240px', '220ms', '1.4s'];

function stripCommentsAndOutlineOffset(css: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // outline / outline-offset (2px) quedan afuera del check — convención
  // pre-existente de TODO el repo (ver docblock de este archivo).
  return withoutComments
    .split('\n')
    .filter((line) => !/\boutline\b/.test(line))
    .join('\n');
}

describe('messaging/*.module.css — sin píxeles/duraciones crudos fuera de token (L3)', () => {
  for (const file of files) {
    const css = readFileSync(join(messagingDir, file), 'utf-8');
    const scoped = stripCommentsAndOutlineOffset(css);

    for (const value of FLAGGED) {
      it(`${file} no usa "${value}" crudo (fuera de comentarios/outline-offset)`, () => {
        const re = new RegExp(`(?<![\\w.-])${value.replace('.', '\\.')}(?![\\w])`);
        expect(re.test(scoped)).toBe(false);
      });
    }
  }
});
