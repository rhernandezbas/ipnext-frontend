import type { WhatsappAssignee } from '@/types/whatsapp';

/**
 * mentions (Ola 6 — @menciones en la nota interna) — helpers PUROS de la
 * autocompletación de menciones del composer (modo NOTA). El BE parsea el
 * token `@[Nombre](userId)` de la nota para notificar al agente mencionado; el
 * FE solo tiene que INSERTAR ese token bien formado. Toda la lógica testeable
 * (formato del token, detección de la palabra `@…` bajo el caret, inserción,
 * filtro del catálogo) vive acá; el popover y el estado viven en `Composer.tsx`.
 */

/**
 * Token del contrato BE: `@[Display Name](userId)`. Se sanean los
 * delimitadores — un `]` en el nombre o un `)` en el id romperían el parser del
 * BE (cerrarían el token antes de tiempo). Es lo único que el FE debe cuidar:
 * el resto del nombre viaja literal.
 */
export function formatMentionToken(name: string, userId: string): string {
  const safeName = name.replace(/\]/g, '');
  const safeId = userId.replace(/\)/g, '');
  return `@[${safeName}](${safeId})`;
}

export interface MentionQuery {
  /** Índice del `@` que abre la mención (lo que `insertMention` reemplaza desde acá). */
  start: number;
  /** Texto ya tipeado tras el `@` (filtro del catálogo). */
  query: string;
}

/**
 * ¿El caret está dentro de una "palabra de mención" activa? Una mención abre
 * con un `@` que está al inicio del texto o precedido por espacio (así un
 * email `mail@x` NO dispara), y se extiende con caracteres que no sean
 * espacio, otro `@`, ni los delimitadores `]`/`)` — esto último evita
 * re-disparar dentro de un token YA insertado (`@[Ana](u-1)` contiene ambos).
 * Devuelve el rango + el query, o `null` si no hay mención bajo el caret.
 */
export function detectMentionQuery(text: string, caret: number): MentionQuery | null {
  const beforeCaret = text.slice(0, caret);
  const match = /(?:^|\s)@([^\s@\])]*)$/.exec(beforeCaret);
  if (!match) return null;
  const query = match[1] ?? '';
  const start = caret - query.length - 1; // -1 por el propio "@"
  return { start, query };
}

/**
 * Reemplaza la palabra `@…` (rango `[start, caret)`) por el `token` elegido,
 * más un espacio para seguir escribiendo. Devuelve el nuevo texto y la posición
 * del caret (tras el espacio) para restaurarla en el textarea.
 */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  token: string,
): { text: string; caret: number } {
  const next = `${text.slice(0, start)}${token} ${text.slice(caret)}`;
  return { text: next, caret: start + token.length + 1 };
}

/** Filtra el catálogo de agentes por lo tipeado (case-insensitive, por nombre). */
export function filterMentionUsers(users: WhatsappAssignee[], query: string): WhatsappAssignee[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return users;
  return users.filter((u) => u.name.toLowerCase().includes(q));
}
