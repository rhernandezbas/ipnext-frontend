/**
 * mapSendError — molde `mapUploadError` (messaging-inbox-v2-media F1.5 fase
 * A, Tanda 2, design §6.4). code (`errorHandler.ts` del BE) → copy legible.
 */
import { describe, it, expect } from 'vitest';
import { mapSendError } from '@/utils/mapSendError';

function errWithCode(code: string) {
  return { response: { data: { code } } };
}

describe('mapSendError', () => {
  it('UNSUPPORTED_ATTACHMENT_TYPE → copy de tipo no soportado', () => {
    expect(mapSendError(errWithCode('UNSUPPORTED_ATTACHMENT_TYPE'))).toMatch(/no se puede enviar/i);
  });

  it('ATTACHMENT_TOO_LARGE → copy de tamaño excedido', () => {
    expect(mapSendError(errWithCode('ATTACHMENT_TOO_LARGE'))).toMatch(/supera el tamaño/i);
  });

  it('FILE_TOO_LARGE → misma copy que ATTACHMENT_TOO_LARGE', () => {
    expect(mapSendError(errWithCode('FILE_TOO_LARGE'))).toMatch(/supera el tamaño/i);
  });

  it('TOO_MANY_FILES → copy con el máximo de archivos', () => {
    expect(mapSendError(errWithCode('TOO_MANY_FILES'))).toMatch(/máximo 10 archivos/i);
  });

  it('MESSAGING_WINDOW_EXPIRED → copy de ventana expirada', () => {
    expect(mapSendError(errWithCode('MESSAGING_WINDOW_EXPIRED'))).toMatch(/ventana de 24 horas/i);
  });

  it('CHATWOOT_UNAVAILABLE → copy de servicio no disponible', () => {
    expect(mapSendError(errWithCode('CHATWOOT_UNAVAILABLE'))).toMatch(/no está disponible/i);
  });

  it('CONVERSATION_NOT_FOUND → copy de conversación inexistente', () => {
    expect(mapSendError(errWithCode('CONVERSATION_NOT_FOUND'))).toMatch(/ya no existe/i);
  });

  it('code desconocido/ausente → copy genérica', () => {
    expect(mapSendError(new Error('network fail'))).toMatch(/no se pudo enviar/i);
    expect(mapSendError(errWithCode('ALGO_RARO'))).toMatch(/no se pudo enviar/i);
  });
});
