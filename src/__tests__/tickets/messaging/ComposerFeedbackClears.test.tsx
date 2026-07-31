/**
 * ComposerFeedbackClears.test.tsx — FIX WAVE M4 (MEDIUM). El feedback de
 * éxito ("Respuesta enviada al cliente." / "Nota interna agregada.") quedaba
 * pegado para siempre — solo se limpiaba en el PRÓXIMO submit. El operador
 * arranca un draft nuevo y sigue viendo el cartel verde del envío anterior
 * debajo, que se lee como si ESTE (el que está tipeando) ya hubiera salido.
 * Fix: tipear en el textarea limpia el feedback.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketMessages');
vi.mock('@/hooks/useTicketComments');
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import { PublicReplyComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/PublicReplyComposer';
import { NoteComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/NoteComposer';

const mockSendMutateAsync = vi.fn();
const mockAddMutateAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMutateAsync.mockReset().mockResolvedValue(undefined);
  mockAddMutateAsync.mockReset().mockResolvedValue(undefined);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: mockSendMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
});

describe('PublicReplyComposer — el feedback de éxito se limpia al tipear un draft nuevo (M4)', () => {
  it('tras enviar, escribir en el textarea saca el cartel "enviada al cliente"', async () => {
    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    await user.type(screen.getByPlaceholderText(/respuesta para el cliente/i), 'hola');
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));
    await waitFor(() => expect(screen.getByText(/enviada al cliente/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/respuesta para el cliente/i), { target: { value: 'nuevo draft' } });
    expect(screen.queryByText(/enviada al cliente/i)).not.toBeInTheDocument();
  });
});

describe('NoteComposer — el feedback de éxito se limpia al tipear un draft nuevo (M4)', () => {
  it('tras agregar la nota, escribir de nuevo saca el cartel "Nota interna agregada."', async () => {
    const user = userEvent.setup();
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    await user.type(screen.getByPlaceholderText(/nota interna/i), 'hola');
    await user.click(screen.getByRole('button', { name: /agregar nota interna/i }));
    await waitFor(() => expect(screen.getByText(/nota interna agregada/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/nota interna/i), { target: { value: 'nuevo draft' } });
    expect(screen.queryByText(/nota interna agregada/i)).not.toBeInTheDocument();
  });
});
