/**
 * ComposerAriaLive.test.tsx — FIX WAVE M2 (MEDIUM). El contador de
 * caracteres de `PublicReplyComposer` llevaba `aria-live="polite"` — un
 * lector de pantalla anuncia el número en CADA tecla que el operador tipea.
 * Y `NoteComposer` tenía el mismo `aria-live` inútil sobre un hint de texto
 * ESTÁTICO (nunca cambia). Ambos se sacan.
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketMessages');
vi.mock('@/hooks/useTicketComments');
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import { PublicReplyComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/PublicReplyComposer';
import { NoteComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/NoteComposer';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
});

describe('PublicReplyComposer — el contador de caracteres NO es aria-live (M2)', () => {
  it('el contador "N / 4000" no tiene aria-live (anunciaría por cada tecla)', () => {
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    const counter = screen.getByText(/\/ 4000/i);
    expect(counter).not.toHaveAttribute('aria-live');
  });
});

describe('NoteComposer — el hint estático no lleva aria-live inútil (M2)', () => {
  it('el hint "Hasta 3 imágenes…" no tiene aria-live (texto que nunca cambia)', () => {
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    const hint = screen.getByText(/hasta 3 imágenes/i);
    expect(hint).not.toHaveAttribute('aria-live');
  });
});
