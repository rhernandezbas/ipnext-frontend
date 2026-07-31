import { describe, it, expect } from 'vitest';
import { mapTicketMessageError } from '@/utils/mapTicketMessageError';

function axiosErr(code: string) {
  return { response: { data: { code } } };
}

describe('mapTicketMessageError', () => {
  it('maps UNSUPPORTED_TICKET_MESSAGE_ATTACHMENT_TYPE (415)', () => {
    expect(mapTicketMessageError(axiosErr('UNSUPPORTED_TICKET_MESSAGE_ATTACHMENT_TYPE')))
      .toMatch(/formato no soportado/i);
  });

  it('maps TICKET_MESSAGE_ATTACHMENT_TOO_LARGE / FILE_TOO_LARGE (413)', () => {
    expect(mapTicketMessageError(axiosErr('TICKET_MESSAGE_ATTACHMENT_TOO_LARGE'))).toMatch(/supera el límite/i);
    expect(mapTicketMessageError(axiosErr('FILE_TOO_LARGE'))).toMatch(/supera el límite/i);
  });

  it('maps BATCH_TOO_LARGE (413) distinctly (total batch, not a single file)', () => {
    expect(mapTicketMessageError(axiosErr('BATCH_TOO_LARGE'))).toMatch(/60\s*MB|tamaño combinado/i);
  });

  it('maps TOO_MANY_TICKET_MESSAGE_ATTACHMENTS / TOO_MANY_FILES (422/400)', () => {
    expect(mapTicketMessageError(axiosErr('TOO_MANY_TICKET_MESSAGE_ATTACHMENTS'))).toMatch(/máximo 5/i);
    expect(mapTicketMessageError(axiosErr('TOO_MANY_FILES'))).toMatch(/máximo 5/i);
  });

  it('maps TICKET_MESSAGE_VALIDATION (400 — empty content or body too long)', () => {
    expect(mapTicketMessageError(axiosErr('TICKET_MESSAGE_VALIDATION'))).toMatch(/mensaje/i);
  });

  it('maps TICKET_MESSAGE_STORAGE_UNAVAILABLE (503)', () => {
    expect(mapTicketMessageError(axiosErr('TICKET_MESSAGE_STORAGE_UNAVAILABLE'))).toMatch(/no está disponible/i);
  });

  it('maps TICKET_NOT_FOUND (404)', () => {
    expect(mapTicketMessageError(axiosErr('TICKET_NOT_FOUND'))).toMatch(/ya no existe/i);
  });

  it('maps UNEXPECTED_FIELD / UPLOAD_ERROR to a generic upload failure', () => {
    expect(mapTicketMessageError(axiosErr('UNEXPECTED_FIELD'))).toMatch(/no se pudo enviar/i);
    expect(mapTicketMessageError(axiosErr('UPLOAD_ERROR'))).toMatch(/no se pudo enviar/i);
  });

  it('falls back to a generic message for an unknown/absent code', () => {
    expect(mapTicketMessageError({})).toMatch(/no se pudo enviar/i);
    expect(mapTicketMessageError(new Error('network fail'))).toMatch(/no se pudo enviar/i);
  });
});
