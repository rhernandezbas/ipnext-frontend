/**
 * TicketMessagingThread.autoScroll.test.tsx — FIX WAVE M5 (MEDIUM). El
 * timeline tiene `max-height` + scroll, y nada lo llevaba al fondo cuando
 * llegaba un mensaje — tras enviar, el mensaje aterrizaba fuera de la vista.
 * Mismo guard que ya existe (y ya está probado) en `MessageThread` del
 * inbox de WhatsApp (bug #7 de ESE review): auto-scroll solo si (a) el
 * ticket se acaba de abrir, (b) el operador estaba cerca del fondo, o (c) el
 * último item es un envío propio del staff — nunca patea el scroll de un
 * operador que subió a leer historial viejo.
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AuthUser } from '@/types/auth';
import type { TicketComment } from '@/types/ticketComments';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTicketComments');
vi.mock('@/hooks/useTicketMessages');
vi.mock('@/hooks/useMyPermissions');

import * as useAuthModule from '@/hooks/useAuth';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import * as useTicketMessagesModule from '@/hooks/useTicketMessages';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';

import { TicketMessagingThread } from '@/pages/tickets/TicketDetailPage/components/messaging/TicketMessagingThread';

function setAuthUser(user: AuthUser | null) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user, isLoading: false, login: vi.fn(), logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function setComments(comments: TicketComment[]) {
  vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({
    data: comments, isLoading: false, isError: false, refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
}

function comment(overrides: Partial<TicketComment> = {}): TicketComment {
  return {
    id: 'c1', ticketId: 'ticket-1', authorName: 'Ana', body: 'hola',
    createdAt: '2026-06-01T10:00:00.000Z', attachments: [], visibility: 'public', authorKind: 'client',
    ...overrides,
  };
}

function setScrollPosition(
  el: HTMLElement,
  { scrollHeight, scrollTop, clientHeight }: { scrollHeight: number; scrollTop: number; clientHeight: number },
) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuthUser({ id: 1, username: 'ana', email: 'a@a.com', displayName: 'Ana', role: 'admin', permissions: [] });
  vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
  vi.mocked(useTicketMessagesModule.useTicketUnreadCount).mockReturnValue({
    data: 0, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useTicketUnreadCount>);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
});

describe('TicketMessagingThread — aria-live en el timeline (M5)', () => {
  it('el contenedor del hilo expone aria-live="polite"', () => {
    setComments([comment()]);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByTestId('messaging-thread-list')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('TicketMessagingThread — auto-scroll al fondo (M5)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    // @ts-expect-error -- restaurar: happy-dom/jsdom no lo implementan de fábrica
    delete Element.prototype.scrollIntoView;
  });

  it('abrir el hilo (mount) scrollea al fondo', () => {
    setComments([comment({ id: 'c1' })]);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(vi.mocked(Element.prototype.scrollIntoView)).toHaveBeenCalled();
  });

  it('con el operador scrolleado arriba, un mensaje nuevo del CLIENTE NO patea el scroll', () => {
    setComments([comment({ id: 'c1', authorKind: 'client' })]);
    const { rerender } = render(<TicketMessagingThread ticketId="ticket-1" />);
    setScrollPosition(screen.getByTestId('messaging-thread-list'), { scrollHeight: 2000, scrollTop: 0, clientHeight: 400 });
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    setComments([comment({ id: 'c1', authorKind: 'client' }), comment({ id: 'c2', authorKind: 'client' })]);
    rerender(<TicketMessagingThread ticketId="ticket-1" />);

    expect(vi.mocked(Element.prototype.scrollIntoView)).not.toHaveBeenCalled();
  });

  it('con el operador cerca del fondo, un mensaje nuevo SÍ scrollea', () => {
    setComments([comment({ id: 'c1', authorKind: 'client' })]);
    const { rerender } = render(<TicketMessagingThread ticketId="ticket-1" />);
    setScrollPosition(screen.getByTestId('messaging-thread-list'), { scrollHeight: 500, scrollTop: 460, clientHeight: 400 });
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    setComments([comment({ id: 'c1', authorKind: 'client' }), comment({ id: 'c2', authorKind: 'client' })]);
    rerender(<TicketMessagingThread ticketId="ticket-1" />);

    expect(vi.mocked(Element.prototype.scrollIntoView)).toHaveBeenCalled();
  });

  it('el propio envío del staff scrollea aunque el operador esté lejos del fondo', () => {
    setComments([comment({ id: 'c1', authorKind: 'client' })]);
    const { rerender } = render(<TicketMessagingThread ticketId="ticket-1" />);
    setScrollPosition(screen.getByTestId('messaging-thread-list'), { scrollHeight: 2000, scrollTop: 0, clientHeight: 400 });
    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    setComments([
      comment({ id: 'c1', authorKind: 'client' }),
      comment({ id: 'c2', authorKind: 'staff', visibility: 'public' }),
    ]);
    rerender(<TicketMessagingThread ticketId="ticket-1" />);

    expect(vi.mocked(Element.prototype.scrollIntoView)).toHaveBeenCalled();
  });
});
