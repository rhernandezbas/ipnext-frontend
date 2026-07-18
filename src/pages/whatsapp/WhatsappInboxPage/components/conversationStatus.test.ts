/**
 * conversationStatus — mapeo COMPARTIDO status→(variante de color, label)
 * entre `ConversationListItem` (F1) y `ConversationStatusToggle`
 * (F1.5-C v1 — RESOLVER/REABRIR), + `nextConversationStatus` (la regla de
 * "a qué status salta el botón Resolver/Reabrir").
 */
import { describe, it, expect } from 'vitest';
import {
  CONVERSATION_STATUS_VARIANT,
  CONVERSATION_STATUS_LABEL,
  nextConversationStatus,
} from './conversationStatus';

describe('CONVERSATION_STATUS_VARIANT / CONVERSATION_STATUS_LABEL', () => {
  it('mapea los 3 status conocidos a variante+label', () => {
    expect(CONVERSATION_STATUS_VARIANT['open']).toBe('active');
    expect(CONVERSATION_STATUS_VARIANT['pending']).toBe('blocked');
    expect(CONVERSATION_STATUS_VARIANT['resolved']).toBe('inactive');

    expect(CONVERSATION_STATUS_LABEL['open']).toBe('Abierta');
    expect(CONVERSATION_STATUS_LABEL['pending']).toBe('Pendiente');
    expect(CONVERSATION_STATUS_LABEL['resolved']).toBe('Resuelta');
  });

  it('Ola 6: "snoozed" mapea a "Pospuesta" con variante ámbar (late), no al fallback gris + texto crudo', () => {
    expect(CONVERSATION_STATUS_VARIANT['snoozed']).toBe('late');
    expect(CONVERSATION_STATUS_LABEL['snoozed']).toBe('Pospuesta');
  });
});

describe('nextConversationStatus — v1 SOLO alterna open↔resolved', () => {
  it('open → resolved', () => {
    expect(nextConversationStatus('open')).toBe('resolved');
  });

  it('resolved → open (único status que ofrece el camino inverso)', () => {
    expect(nextConversationStatus('resolved')).toBe('open');
  });

  it('pending → resolved (se trata como "no resuelta"; v1 no expone un botón dedicado a pending)', () => {
    expect(nextConversationStatus('pending')).toBe('resolved');
  });

  it('un status desconocido (drift de Chatwoot) → resolved (mismo criterio que "no resuelta", nunca crashea)', () => {
    expect(nextConversationStatus('weird_status')).toBe('resolved');
  });
});
