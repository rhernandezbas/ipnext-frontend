/**
 * MessageItem.ariaStructure.test.tsx — FIX WAVE M3 (MEDIUM).
 *
 * 1) `role="listitem"` vivía en el `<article>`, que NO es hijo directo del
 *    `<div role="list">` del hilo (`TicketMessagingThread`) — hay un `<div>`
 *    genérico (`data-testid="message-item-row"`) en el medio. Por spec ARIA,
 *    `listitem` debe ser hijo directo de `list`; con un contenedor genérico
 *    interpuesto la relación se rompe. Fix: `role="listitem"` pasa al `<div>`
 *    que SÍ es el hijo directo del list.
 *
 * 2) `aria-label="Archivos adjuntos"` estaba sobre un `<div>` sin rol — un
 *    `div` con rol implícito `generic` no expone ese nombre en el árbol de
 *    accesibilidad. Fix: `role="group"` para que el label se anuncie.
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

describe('MessageItem — role="listitem" en el hijo directo de role="list" (M3)', () => {
  it('el elemento que lleva data-testid="message-item-row" (hijo directo del list) es el que tiene role="listitem"', () => {
    render(
      <div role="list">
        <MessageItem comment={baseComment({ visibility: 'public', authorKind: 'staff' })} isNew={false} />
      </div>,
    );
    const row = screen.getByTestId('message-item-row');
    expect(row).toHaveAttribute('role', 'listitem');
  });

  it('el listitem sigue teniendo el accessible name correcto por lane', () => {
    render(
      <div role="list">
        <MessageItem comment={baseComment({ visibility: 'public', authorKind: 'staff' })} isNew={false} />
      </div>,
    );
    expect(screen.getByRole('listitem')).toHaveAccessibleName(/Respuesta al cliente de Ana/i);
  });
});

describe('MessageItem — "Archivos adjuntos" se anuncia (M3)', () => {
  it('el contenedor de adjuntos tiene role="group" para que aria-label se exponga', () => {
    render(
      <MessageItem
        comment={baseComment({
          visibility: 'public',
          authorKind: 'staff',
          attachments: [{ id: 'att-1', commentId: 'c1', url: '/api/tickets/messages/attachments/att-1/file', filename: 'foto.jpg', kind: 'image' }],
        })}
        isNew={false}
      />,
    );
    expect(screen.getByRole('group', { name: /archivos adjuntos/i })).toBeInTheDocument();
  });
});
