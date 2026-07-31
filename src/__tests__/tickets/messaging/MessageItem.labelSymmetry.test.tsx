/**
 * MessageItem.labelSymmetry.test.tsx — FIX WAVE M1 (MEDIUM). El etiquetado
 * de las 3 lanes era ASIMÉTRICO: solo la nota interna llevaba texto VISIBLE
 * ("Nota interna"). La respuesta pública del staff se distinguía SOLO por
 * color y lado — el texto "Respuesta al cliente de …" vive únicamente en el
 * `aria-label`, invisible para un operador vidente. "¿Esto lo vio el
 * cliente?" se respondía por AUSENCIA de etiqueta, no por presencia de una.
 *
 * Fix: agrega un texto VISIBLE ("Enviado al cliente") en la lane staff,
 * mismo criterio que `.noteHeader` en la lane de nota interna.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageItem } from '@/pages/tickets/TicketDetailPage/components/messaging/MessageItem';
import type { TicketComment } from '@/types/ticketComments';

function baseComment(overrides: Partial<TicketComment> = {}): TicketComment {
  return {
    id: 'c1', ticketId: 'ticket-1', authorName: 'Ana', body: 'hola',
    createdAt: '2026-06-01T10:00:00.000Z', attachments: [], ...overrides,
  };
}

describe('MessageItem — la lane staff lleva un texto VISIBLE, no solo aria-label (M1)', () => {
  it('respuesta pública del staff muestra el texto "Enviado al cliente"', () => {
    render(<MessageItem comment={baseComment({ visibility: 'public', authorKind: 'staff' })} isNew={false} />);
    expect(screen.getByText(/enviado al cliente/i)).toBeInTheDocument();
  });

  it('el mensaje del cliente NO lleva la etiqueta "Enviado al cliente" (sería mentira — lo escribió el cliente)', () => {
    render(<MessageItem comment={baseComment({ authorName: 'Juan Cliente', visibility: 'public', authorKind: 'client' })} isNew={false} />);
    expect(screen.queryByText(/enviado al cliente/i)).not.toBeInTheDocument();
  });

  it('la nota interna sigue mostrando "Nota interna" (sin regresión)', () => {
    render(<MessageItem comment={baseComment({ visibility: 'internal', authorKind: 'staff' })} isNew={false} />);
    expect(screen.getByText('Nota interna')).toBeInTheDocument();
    expect(screen.queryByText(/enviado al cliente/i)).not.toBeInTheDocument();
  });
});
