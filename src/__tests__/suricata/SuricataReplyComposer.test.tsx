/**
 * SuricataReplyComposer + SuricataReplyConfirmModal (Fase I, tasks I.1/I.3,
 * spec `suricata-ticket-reply` REPLY-1/2/5, design D10).
 *
 *  RC-1 gate      → without `suricata.reply`, the composer renders nothing (UI-8)
 *  RC-2 open      → typing + "Responder al cliente" opens the modal with the
 *                   recipient (customerName/customerPhone), the ticket and the
 *                   exact final text — the FIRST of the two explicit confirmations
 *  RC-3 cancel    → cancelling the modal sends nothing (no mutation call)
 *  RC-4 confirm   → confirming computes sha256(body) client-side and sends
 *                   `{body, confirm}` — the SECOND explicit confirmation (REPLY-2)
 *  RC-5 busy      → while the mutation is in flight, the confirm button reads
 *                   "Enviando (Playwright)..." and both actions are disabled
 *  RC-6 success   → a successful send shows visible success feedback, clears the
 *                   textarea and closes the modal
 *  RC-7 error     → a 502 SURICATA_UNAVAILABLE (today's ALWAYS case) shows an
 *                   honest message, the modal stays open, and no success text
 *                   ever appears (REPLY-5 — no silent/false success)
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useMyPermissions');
vi.mock('@/pages/suricata/hooks/useSuricataTickets');

import { useCan } from '@/hooks/useMyPermissions';
import * as useSuricataTicketsModule from '@/pages/suricata/hooks/useSuricataTickets';
import { SuricataReplyComposer } from '@/pages/suricata/SuricataTicketDetail/SuricataReplyComposer';

const mockMutateAsync = vi.fn();

function mockReplyMutation(overrides: Partial<ReturnType<typeof useSuricataTicketsModule.useReplySuricataTicket>> = {}) {
  vi.mocked(useSuricataTicketsModule.useReplySuricataTicket).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSuricataTicketsModule.useReplySuricataTicket>);
}

const PROPS = {
  ticketId: 't-1',
  customerName: 'María Gómez',
  customerPhone: '+549232455511',
  ticketSubject: 'Sin Servicio',
  ticketExternalId: '18742',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockReset().mockResolvedValue({ replyAuditId: 'audit-1' });
  vi.mocked(useCan).mockReturnValue(true);
  mockReplyMutation();
});

describe('RC-1 gate', () => {
  it('renders nothing without suricata.reply', () => {
    vi.mocked(useCan).mockReturnValue(false);
    const { container } = render(<SuricataReplyComposer {...PROPS} />);
    expect(container).toBeEmptyDOMElement();
  });
});

async function typeAndOpen(user: ReturnType<typeof userEvent.setup>, text = 'Ya revisamos tu reclamo') {
  await user.type(screen.getByLabelText(/respuesta para el cliente/i), text);
  await user.click(screen.getByRole('button', { name: /responder al cliente/i }));
}

describe('RC-2 open', () => {
  it('opens the confirm modal showing recipient, ticket and the exact text', async () => {
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user, 'Ya revisamos tu reclamo');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/maría gómez/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/\+549232455511/)).toBeInTheDocument();
    expect(within(dialog).getByText(/18742/)).toBeInTheDocument();
    expect(within(dialog).getByText('Ya revisamos tu reclamo')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /sí, enviar ahora/i })).toBeInTheDocument();
  });
});

describe('RC-3 cancel', () => {
  it('cancelling sends nothing', async () => {
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('RC-4 confirm', () => {
  it('confirming computes sha256(body) and sends {body, confirm}', async () => {
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user, 'hola');

    await user.click(screen.getByRole('button', { name: /sí, enviar ahora/i }));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      body: 'hola',
      confirm: 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79',
    });
  });
});

describe('RC-5 busy', () => {
  it('shows the Playwright-in-flight label and disables actions while pending', async () => {
    // Realistic sequence: the modal opens while `isPending` is still false
    // (otherwise the trigger button would already be disabled and nothing
    // would ever reach an open modal) — pending only becomes true AFTER
    // confirming, which the mocked hook simulates via `rerender`.
    const user = userEvent.setup();
    const { rerender } = render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user);

    mockReplyMutation({ isPending: true });
    rerender(<SuricataReplyComposer {...PROPS} />);

    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /enviando \(playwright\)/i });
    expect(confirmBtn).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});

describe('RC-6 success', () => {
  it('shows success feedback, clears the textarea and closes the modal', async () => {
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user, 'hola');
    await user.click(screen.getByRole('button', { name: /sí, enviar ahora/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/enviad/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/respuesta para el cliente/i)).toHaveValue('');
  });

  // Closing the modal restored focus to whatever opened it — the "Responder al
  // cliente" button. After a successful send the body is empty, so that button
  // is `disabled`, and `focus()` on a disabled element is a no-op: focus fell
  // to <body> and a keyboard/SR user lost their place entirely.
  it('leaves focus on a real, focusable element after a successful send', async () => {
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user, 'hola');
    await user.click(screen.getByRole('button', { name: /sí, enviar ahora/i }));

    await screen.findByRole('status');

    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByLabelText(/respuesta para el cliente/i)).toHaveFocus();
  });
});

describe('RC-7 error', () => {
  it('a 502 SURICATA_UNAVAILABLE shows an honest message, keeps the modal open, never a success', async () => {
    mockMutateAsync.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 502, data: { code: 'SURICATA_UNAVAILABLE' } },
    });
    const user = userEvent.setup();
    render(<SuricataReplyComposer {...PROPS} />);
    await typeAndOpen(user, 'hola');
    await user.click(screen.getByRole('button', { name: /sí, enviar ahora/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/todavía no está disponible/i);
    expect(screen.queryByText(/respuesta enviada/i)).not.toBeInTheDocument();
  });
});
