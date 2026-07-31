/**
 * PublicReplyComposer.confirmSend.test.tsx — FIX WAVE H4 (HIGH). Nada
 * intercepta hoy el click de "Enviar al cliente" — un mensaje que el cliente
 * ve en su teléfono y que NO se puede editar ni borrar sale con un solo
 * click, igual que cualquier acción reversible del panel. Las mitigaciones
 * pasivas (header, hint, placeholder, label del botón) no paran un click
 * apurado.
 *
 * Fix: confirmación explícita (mismo patrón `useConfirm` que ya usa el repo
 * para acciones irreversibles, ej. `TicketDetailPage.handleDelete`) ANTES de
 * disparar `sendReply.mutateAsync`. `NoteComposer` (nota interna) queda
 * SIN fricción — no debe pedir confirmación, es reversible y nunca sale del
 * panel.
 *
 * `src/test/setup.ts` mockea `useConfirm` globalmente para resolver `true`
 * por defecto (así el resto de la suite no se rompe) — este archivo
 * sobreescribe ese mock para verificar el mensaje exacto y el camino de
 * cancelación.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketMessages');
vi.mock('@/hooks/useTicketComments');
vi.mock('@/context/ConfirmContext');
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import { useConfirm } from '@/context/ConfirmContext';
import { PublicReplyComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/PublicReplyComposer';
import { NoteComposer } from '@/pages/tickets/TicketDetailPage/components/messaging/NoteComposer';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';

const mockSendMutateAsync = vi.fn();
const mockAddMutateAsync = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMutateAsync.mockReset().mockResolvedValue(undefined);
  mockAddMutateAsync.mockReset().mockResolvedValue(undefined);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: mockSendMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
});

describe('PublicReplyComposer — confirmación explícita antes de enviar al cliente (H4)', () => {
  it('pide confirmación (useConfirm) ANTES de disparar la mutación, avisando que es irreversible', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);

    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    fireEvent.change(screen.getByPlaceholderText(/respuesta para el cliente/i), { target: { value: 'hola' } });
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));

    expect(confirmFn).toHaveBeenCalledTimes(1);
    const arg = confirmFn.mock.calls[0]![0];
    const message = typeof arg === 'string' ? arg : arg.message;
    expect(message).toMatch(/no se puede (editar|deshacer|borrar)|cliente/i);
    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledTimes(1));
  });

  it('cancelar la confirmación NO envía nada al cliente', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);

    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana" />);
    fireEvent.change(screen.getByPlaceholderText(/respuesta para el cliente/i), { target: { value: 'hola' } });
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(mockSendMutateAsync).not.toHaveBeenCalled();
  });

  it('confirmar SÍ envía, con el payload intacto (mismo contrato que antes de H4)', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);

    const user = userEvent.setup();
    render(<PublicReplyComposer ticketId="ticket-1" authorName="Ana Pérez" />);
    fireEvent.change(screen.getByPlaceholderText(/respuesta para el cliente/i), { target: { value: 'Ya reviso tu conexión' } });
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));

    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      body: 'Ya reviso tu conexión',
      authorName: 'Ana Pérez',
      files: [],
    }));
  });
});

describe('NoteComposer — la nota interna NO pide confirmación (sin fricción, H4)', () => {
  it('enviar una nota interna NO invoca useConfirm', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);

    const user = userEvent.setup();
    render(<NoteComposer ticketId="ticket-1" authorName="Ana" />);
    await user.type(screen.getByPlaceholderText(/nota interna/i), 'nota rápida');
    await user.click(screen.getByRole('button', { name: /agregar nota interna/i }));

    await waitFor(() => expect(mockAddMutateAsync).toHaveBeenCalledTimes(1));
    expect(confirmFn).not.toHaveBeenCalled();
  });
});
