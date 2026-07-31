import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MessageItem } from '@/pages/tickets/TicketDetailPage/components/messaging/MessageItem';
import type { TicketComment } from '@/types/ticketComments';

function baseComment(overrides: Partial<TicketComment> = {}): TicketComment {
  return {
    id: 'c1',
    ticketId: 'ticket-1',
    authorName: 'Ana',
    body: 'hola',
    createdAt: '2026-06-01T10:00:00.000Z',
    attachments: [],
    ...overrides,
  };
}

describe('MessageItem — distinción de lane (visibility/authorKind)', () => {
  it('nota interna (visibility=internal): lleva la etiqueta de TEXTO "Nota interna" + ícono, NUNCA solo color', () => {
    render(<MessageItem comment={baseComment({ visibility: 'internal', authorKind: 'staff' })} isNew={false} />);
    expect(screen.getByText('Nota interna')).toBeInTheDocument();
    const row = screen.getByTestId('message-item-row');
    expect(row.className).toMatch(/note/);
    expect(screen.getByRole('listitem')).toHaveAccessibleName(/Nota interna de Ana/i);
  });

  it('respuesta pública del staff (visibility=public, authorKind=staff): lane outbound, accessible name distingue "al cliente"', () => {
    render(<MessageItem comment={baseComment({ visibility: 'public', authorKind: 'staff' })} isNew={false} />);
    expect(screen.queryByText('Nota interna')).not.toBeInTheDocument();
    const row = screen.getByTestId('message-item-row');
    expect(row.className).toMatch(/staff/);
    expect(screen.getByRole('listitem')).toHaveAccessibleName(/Respuesta al cliente de Ana/i);
  });

  it('mensaje del cliente (visibility=public, authorKind=client): lane inbound', () => {
    render(<MessageItem comment={baseComment({ authorName: 'Juan Cliente', visibility: 'public', authorKind: 'client' })} isNew={false} />);
    const row = screen.getByTestId('message-item-row');
    expect(row.className).toMatch(/client/);
    expect(screen.getByRole('listitem')).toHaveAccessibleName(/Mensaje de Juan Cliente/i);
  });

  it('metadata ausente (fixture legacy sin authorKind/visibility) cae al lado SEGURO — nota interna, no "al cliente"', () => {
    render(<MessageItem comment={baseComment()} isNew={false} />);
    expect(screen.getByText('Nota interna')).toBeInTheDocument();
  });

  it('renderiza cuerpo, autor y fecha', () => {
    render(<MessageItem comment={baseComment({ body: 'Reviso tu conexión', authorName: 'Ana Técnico', visibility: 'public', authorKind: 'staff' })} isNew={false} />);
    expect(screen.getByText('Reviso tu conexión')).toBeInTheDocument();
    expect(screen.getByText('Ana Técnico')).toBeInTheDocument();
  });

  it('renderiza adjuntos vía TicketMessageAttachmentView', () => {
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
    expect(screen.getByRole('button', { name: /ver foto\.jpg en grande/i })).toBeInTheDocument();
  });
});
