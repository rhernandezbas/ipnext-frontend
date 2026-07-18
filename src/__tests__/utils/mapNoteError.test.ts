/**
 * mapNoteError (internal-notes F1.5 — EDITAR/ELIMINAR NOTA) — traduce el
 * `code` del BE (`errorHandler.ts`, body `{error,code}`) de las mutaciones
 * PATCH/DELETE de una nota interna a un mensaje humano en español. Molde
 * `mapSendError.ts`. Contrato BE (ya en prod):
 *   404 INTERNAL_NOTE_NOT_FOUND · 422 NOT_AN_INTERNAL_NOTE ·
 *   409 INTERNAL_NOTE_ALREADY_DELETED · 403 INTERNAL_NOTE_FORBIDDEN ·
 *   403 PERMISSION_DENIED.
 */
import { describe, it, expect } from 'vitest';
import { mapNoteError } from '@/utils/mapNoteError';

function axiosErr(code: string) {
  return { response: { data: { code } } };
}

describe('mapNoteError — códigos del contrato BE', () => {
  it('INTERNAL_NOTE_NOT_FOUND → "ya no existe"', () => {
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_NOT_FOUND'))).toMatch(/ya no existe/i);
  });

  it('NOT_AN_INTERNAL_NOTE → "solo.*notas internas"', () => {
    expect(mapNoteError(axiosErr('NOT_AN_INTERNAL_NOTE'))).toMatch(/notas internas/i);
  });

  it('INTERNAL_NOTE_ALREADY_DELETED → "ya fue eliminada"', () => {
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_ALREADY_DELETED'))).toMatch(/ya fue eliminada/i);
  });

  it('INTERNAL_NOTE_FORBIDDEN → "no tenés permiso para editar esta nota"', () => {
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_FORBIDDEN'))).toMatch(/no ten[eé]s permiso.*nota/i);
  });

  it('PERMISSION_DENIED → mensaje de permiso', () => {
    expect(mapNoteError(axiosErr('PERMISSION_DENIED'))).toMatch(/permiso/i);
  });

  it('también lee data.error como fallback del code (mismo criterio que mapSendError)', () => {
    expect(mapNoteError({ response: { data: { error: 'INTERNAL_NOTE_ALREADY_DELETED' } } })).toMatch(/ya fue eliminada/i);
  });

  it('código desconocido → mensaje genérico "no se pudo"', () => {
    expect(mapNoteError(axiosErr('WHATEVER'))).toMatch(/no se pudo/i);
  });

  it('error sin response (ej. red caída) → mensaje genérico, sin crashear', () => {
    expect(mapNoteError(new Error('network'))).toMatch(/no se pudo/i);
  });
});

describe('mapNoteError — verbo según la acción (edit vs delete)', () => {
  it('sin action explícita, default "edit" (compat con call sites de 1 arg)', () => {
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_FORBIDDEN'))).toMatch(/editar/i);
  });

  it('403 en flujo DELETE → copy con "eliminar", NO "editar"', () => {
    const msg = mapNoteError(axiosErr('INTERNAL_NOTE_FORBIDDEN'), 'delete');
    expect(msg).toMatch(/no ten[eé]s permiso.*eliminar.*nota/i);
    expect(msg).not.toMatch(/editar/i);
  });

  it('403 en flujo EDIT → copy con "editar"', () => {
    const msg = mapNoteError(axiosErr('INTERNAL_NOTE_FORBIDDEN'), 'edit');
    expect(msg).toMatch(/no ten[eé]s permiso.*editar.*nota/i);
    expect(msg).not.toMatch(/eliminar/i);
  });

  it('NOT_AN_INTERNAL_NOTE usa el verbo de la acción', () => {
    expect(mapNoteError(axiosErr('NOT_AN_INTERNAL_NOTE'), 'delete')).toMatch(/eliminar/i);
    expect(mapNoteError(axiosErr('NOT_AN_INTERNAL_NOTE'), 'edit')).toMatch(/editar/i);
  });

  it('el genérico (código desconocido) usa el verbo de la acción', () => {
    expect(mapNoteError(axiosErr('WHATEVER'), 'delete')).toMatch(/no se pudo eliminar/i);
    expect(mapNoteError(axiosErr('WHATEVER'), 'edit')).toMatch(/no se pudo editar/i);
  });

  it('los códigos action-neutral no cambian con la acción (NOT_FOUND / ALREADY_DELETED)', () => {
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_NOT_FOUND'), 'delete')).toMatch(/ya no existe/i);
    expect(mapNoteError(axiosErr('INTERNAL_NOTE_ALREADY_DELETED'), 'edit')).toMatch(/ya fue eliminada/i);
  });
});
