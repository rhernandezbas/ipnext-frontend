/**
 * TicketTabs.crossTicketState.test.tsx — FIX WAVE C1 (CRITICAL). La ruta es
 * `/admin/tickets/:id` y React Router NO remonta el árbol al cambiar solo el
 * param — así que si `TicketMessagingThread` (y los composers/`seenIdsRef`
 * dentro de ella) no llevan `key={ticketId}`, un DRAFT escrito en el ticket A
 * sobrevive al navegar al ticket B y se manda al cliente EQUIVOCADO.
 *
 * Este test simula exactamente ese escenario: renderiza `TicketTabs` para el
 * ticket A, escribe un draft en el composer público, y vuelve a renderizar
 * (mismo árbol, SIN unmount explícito — `rerender`, igual que un cambio de
 * `:id` bajo el mismo `<Route>`) con ticket B. El draft NO debe sobrevivir.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuthUser } from '@/types/auth';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTicketComments');
vi.mock('@/hooks/useTicketMessages');
vi.mock('@/hooks/useMyPermissions');

import * as useAuthModule from '@/hooks/useAuth';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';

import { TicketTabs } from '@/pages/tickets/TicketDetailPage/components/TicketTabs';

const mockAddMutateAsync = vi.fn();
const mockSendMutateAsync = vi.fn();

function setAuthUser(user: AuthUser | null) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user, isLoading: false, login: vi.fn(), logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function fullUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 1, username: 'anap', email: 'ana@example.com', displayName: 'Ana Pérez', role: 'admin', permissions: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddMutateAsync.mockReset().mockResolvedValue(undefined);
  mockSendMutateAsync.mockReset().mockResolvedValue(undefined);

  setAuthUser(fullUser());
  vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
  vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({
    data: [], isLoading: false, isError: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
  vi.mocked(useTicketMessagesModule.useTicketUnreadCount).mockReturnValue({
    data: 0, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useTicketUnreadCount>);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: mockSendMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
});

describe('TicketTabs — el draft NO sobrevive un cambio de ticketId sin unmount (C1)', () => {
  it('el borrador de "Responder al cliente" del ticket A NO aparece en el ticket B', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketTabs ticketId="ticket-A" description="desc A" tasks={[]} />);

    const replyBox = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    await user.type(replyBox, 'Hola Juan, paso manana a las 10');
    expect(replyBox.value).toBe('Hola Juan, paso manana a las 10');

    // Mismo árbol — SIN desmontar — como cuando React Router solo cambia :id.
    rerender(<TicketTabs ticketId="ticket-B" description="desc B" tasks={[]} />);

    const replyBoxAfter = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    expect(replyBoxAfter.value).toBe('');
  });

  it('el borrador de "Nota interna" del ticket A tampoco sobrevive', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketTabs ticketId="ticket-A" description="desc A" tasks={[]} />);

    const noteBox = screen.getByPlaceholderText(/nota interna/i) as HTMLTextAreaElement;
    await user.type(noteBox, 'nota confidencial del ticket A');
    expect(noteBox.value).toBe('nota confidencial del ticket A');

    rerender(<TicketTabs ticketId="ticket-B" description="desc B" tasks={[]} />);

    const noteBoxAfter = screen.getByPlaceholderText(/nota interna/i) as HTMLTextAreaElement;
    expect(noteBoxAfter.value).toBe('');
  });

  it('el submit del composer público, tras cambiar de ticket sin escribir nada nuevo, no reenvía el draft viejo (payload limpio)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TicketTabs ticketId="ticket-A" description="desc A" tasks={[]} />);
    const replyBox = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    await user.type(replyBox, 'texto que NO debe llegar a B');

    rerender(<TicketTabs ticketId="ticket-B" description="desc B" tasks={[]} />);

    const replyBoxAfter = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    await user.type(replyBoxAfter, 'texto correcto de B');
    await user.click(screen.getByRole('button', { name: /enviar al cliente/i }));

    expect(mockSendMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: 'ticket-B', body: 'texto correcto de B' }),
    );
    expect(mockSendMutateAsync).not.toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('NO debe llegar') }),
    );
  });
});
