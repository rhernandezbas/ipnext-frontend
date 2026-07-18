/**
 * mentions (Ola 6 — @menciones en la nota interna) — helpers PUROS de la
 * autocompletación de menciones del composer. El popover (`MentionPopover`) y
 * la integración viven en `Composer.tsx`; acá se testea la lógica pura:
 *
 * - `formatMentionToken`: arma el token del contrato BE `@[Nombre](userId)`,
 *   saneando los delimitadores (`]` en el nombre, `)` en el id romperían el
 *   parser del BE).
 * - `detectMentionQuery`: mientras se tipea, decide si el caret está dentro de
 *   una "palabra de mención" (`@…`) — devuelve el rango a reemplazar + el texto
 *   ya tipeado (query del filtro), o `null` si no hay mención activa.
 * - `insertMention`: reemplaza esa palabra `@…` por el token elegido.
 * - `filterMentionUsers`: filtra el catálogo por lo tipeado (case-insensitive).
 */
import { describe, it, expect } from 'vitest';
import {
  formatMentionToken,
  detectMentionQuery,
  insertMention,
  filterMentionUsers,
} from './mentions';
import type { WhatsappAssignee } from '@/types/whatsapp';

describe('formatMentionToken — contrato BE @[Nombre](userId)', () => {
  it('arma el token con nombre e id', () => {
    expect(formatMentionToken('Ana Gómez', 'u-1')).toBe('@[Ana Gómez](u-1)');
  });

  it('sanea el "]" del nombre (rompería el parser del BE)', () => {
    expect(formatMentionToken('Ana [Soporte]', 'u-1')).toBe('@[Ana [Soporte](u-1)');
  });

  it('sanea el ")" del userId', () => {
    expect(formatMentionToken('Ana', 'u-1)evil')).toBe('@[Ana](u-1evil)');
  });
});

describe('detectMentionQuery — ¿el caret está en una palabra de mención?', () => {
  it('"@" recién tipeado al inicio → mención con query vacía, start en 0', () => {
    expect(detectMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('"@ana" → query "ana", start en el "@"', () => {
    expect(detectMentionQuery('@ana', 4)).toEqual({ start: 0, query: 'ana' });
  });

  it('"@" precedido por espacio en medio del texto → detecta y ubica el start correcto', () => {
    expect(detectMentionQuery('hola @an', 8)).toEqual({ start: 5, query: 'an' });
  });

  it('"@" pegado a otra palabra (email) NO es mención', () => {
    expect(detectMentionQuery('mail@ana', 8)).toBeNull();
  });

  it('un espacio DESPUÉS del "@…" cierra la mención (ya no está en la palabra)', () => {
    expect(detectMentionQuery('@ana ', 5)).toBeNull();
  });

  it('caret ANTES del "@" (no dentro de la palabra) → null', () => {
    expect(detectMentionQuery('hola @ana', 2)).toBeNull();
  });

  it('no re-dispara dentro de un token ya insertado (@[Nombre](id) tiene "]" y ")")', () => {
    const text = '@[Ana](u-1)';
    expect(detectMentionQuery(text, text.length)).toBeNull();
  });

  it('un token completo seguido de una mención nueva detecta SOLO la nueva', () => {
    const text = '@[Ana](u-1) @be';
    expect(detectMentionQuery(text, text.length)).toEqual({ start: 12, query: 'be' });
  });
});

describe('insertMention — reemplaza la palabra @… por el token', () => {
  it('reemplaza "@an" por el token + espacio y devuelve el caret al final', () => {
    const token = '@[Ana Gómez](u-1)';
    const result = insertMention('hola @an', 5, 8, token);
    expect(result.text).toBe(`hola ${token} `);
    expect(result.caret).toBe(5 + token.length + 1);
  });

  it('preserva el texto que venía DESPUÉS del caret', () => {
    const token = '@[Ana](u-1)';
    const result = insertMention('@an, avisá', 0, 3, token);
    expect(result.text).toBe(`${token} , avisá`);
  });
});

describe('filterMentionUsers — filtra el catálogo por lo tipeado', () => {
  const users: WhatsappAssignee[] = [
    { id: 'u-1', name: 'Ana Gómez' },
    { id: 'u-2', name: 'Beto Ruiz' },
    { id: 'u-3', name: 'Ana López' },
  ];

  it('query vacía → catálogo completo', () => {
    expect(filterMentionUsers(users, '')).toHaveLength(3);
  });

  it('case-insensitive, matchea por nombre', () => {
    expect(filterMentionUsers(users, 'ana').map((u) => u.id)).toEqual(['u-1', 'u-3']);
  });

  it('sin coincidencias → []', () => {
    expect(filterMentionUsers(users, 'zzz')).toEqual([]);
  });
});
