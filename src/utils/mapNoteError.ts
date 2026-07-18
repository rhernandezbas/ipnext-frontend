/**
 * mapNoteError (internal-notes F1.5 — EDITAR/ELIMINAR NOTA) — molde
 * `mapSendError.ts`. Traduce el `code` del BE (`errorHandler.ts`, body
 * `{error,code}`) de las mutaciones PATCH/DELETE de una nota interna a un
 * mensaje humano en español. El contrato BE (ya en prod) devuelve:
 *   404 INTERNAL_NOTE_NOT_FOUND · 422 NOT_AN_INTERNAL_NOTE ·
 *   409 INTERNAL_NOTE_ALREADY_DELETED · 403 INTERNAL_NOTE_FORBIDDEN ·
 *   403 PERMISSION_DENIED.
 *
 * `action` (LOW/MEDIUM review): el MISMO mapper se comparte entre editar y
 * borrar — pero un 403/422/genérico que dijera siempre "editar" es engañoso
 * cuando el agente clickeó "Eliminar". El verbo se parametriza; default
 * `'edit'` para no romper los call sites de 1 argumento. Los códigos
 * action-NEUTRAL (NOT_FOUND / ALREADY_DELETED / PERMISSION_DENIED) no llevan
 * verbo, así que no cambian con la acción.
 */
export type NoteAction = 'edit' | 'delete';

export function mapNoteError(err: unknown, action: NoteAction = 'edit'): string {
  const verb = action === 'delete' ? 'eliminar' : 'editar';
  const data = (err as { response?: { data?: { code?: string; error?: string } } })?.response?.data;
  const code = data?.code ?? data?.error;
  switch (code) {
    case 'INTERNAL_NOTE_NOT_FOUND':
      return 'Esta nota ya no existe.';
    case 'NOT_AN_INTERNAL_NOTE':
      return `Solo se pueden ${verb} notas internas.`;
    case 'INTERNAL_NOTE_ALREADY_DELETED':
      return 'La nota ya fue eliminada.';
    case 'INTERNAL_NOTE_FORBIDDEN':
      return `No tenés permiso para ${verb} esta nota.`;
    case 'PERMISSION_DENIED':
      return 'No tenés permiso para esta acción.';
    default:
      return `No se pudo ${verb} la nota. Reintentá.`;
  }
}
