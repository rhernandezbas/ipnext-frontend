import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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

const mockRefetch = vi.fn();
const mockAddMutateAsync = vi.fn();
const mockSendMutateAsync = vi.fn();

function setAuthUser(user: AuthUser | null) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user, isLoading: false, login: vi.fn(), logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function setComments(comments: TicketComment[] | undefined, opts?: { isLoading?: boolean; isError?: boolean }) {
  vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({
    data: comments,
    isLoading: opts?.isLoading ?? false,
    isError: opts?.isError ?? false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
}

function setUnread(count: number | undefined) {
  vi.mocked(useTicketMessagesModule.useTicketUnreadCount).mockReturnValue({
    data: count, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useTicketUnreadCount>);
}

function fullUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 1, username: 'anap', email: 'ana@example.com', displayName: 'Ana Pérez', role: 'admin', permissions: [], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRefetch.mockReset();
  mockAddMutateAsync.mockReset().mockResolvedValue(undefined);
  mockSendMutateAsync.mockReset().mockResolvedValue(undefined);

  setAuthUser(fullUser());
  setComments([]);
  setUnread(0);
  vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(true);
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
  vi.mocked(useTicketMessagesModule.useSendStaffTicketReply).mockReturnValue({
    mutateAsync: mockSendMutateAsync, isPending: false,
  } as unknown as ReturnType<typeof useTicketMessagesModule.useSendStaffTicketReply>);
});

describe('TicketMessagingThread — 4 estados de fetch', () => {
  it('loading: muestra skeleton', () => {
    setComments(undefined, { isLoading: true });
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByTestId('messaging-thread-skeleton')).toBeInTheDocument();
  });

  it('error: muestra alert + botón Reintentar que llama refetch', async () => {
    const user = userEvent.setup();
    setComments(undefined, { isError: true });
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('empty: sin comentarios ni comentario de apertura muestra el estado vacío', () => {
    setComments([]);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByText(/sin mensajes/i)).toBeInTheDocument();
  });

  it('success: pinta el hilo con comentarios', () => {
    setComments([
      { id: 'c1', ticketId: 'ticket-1', authorName: 'Ana', body: 'hola', createdAt: '2026-06-01T10:00:00.000Z', attachments: [], visibility: 'internal', authorKind: 'staff' },
    ]);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByText('hola')).toBeInTheDocument();
  });
});

describe('TicketMessagingThread — comentario de apertura (#77, migrado)', () => {
  it('el description del ticket aparece como el primer mensaje, lane cliente', () => {
    setComments([]);
    render(<TicketMessagingThread ticketId="ticket-1" description="No tengo señal desde ayer." reporterName="Juan Reportero" createdAt="2024-01-15T10:00:00Z" />);
    expect(screen.getByText('Juan Reportero')).toBeInTheDocument();
    expect(screen.getByText('No tengo señal desde ayer.')).toBeInTheDocument();
  });

  it('NO se muestra cuando description está vacío', () => {
    setComments([]);
    render(<TicketMessagingThread ticketId="ticket-1" description="" reporterName="Juan" createdAt="2024-01-15T10:00:00Z" />);
    expect(screen.queryByText('Juan')).not.toBeInTheDocument();
  });
});

describe('TicketMessagingThread — indicador de no leídos', () => {
  it('muestra el badge cuando el contador es > 0', () => {
    setUnread(3);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByText(/3 sin leer/i)).toBeInTheDocument();
  });

  it('NO muestra el badge cuando el contador es 0', () => {
    setUnread(0);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.queryByText(/sin leer/i)).not.toBeInTheDocument();
  });
});

describe('TicketMessagingThread — las DOS acciones de escritura son cosas DISTINTAS', () => {
  it('renderiza AMBOS composers como formularios SEPARADOS, no un toggle', () => {
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByRole('form', { name: 'Responder al cliente' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Agregar nota interna' })).toBeInTheDocument();
    // Ningún checkbox/select/toggle que decida la visibilidad — la ruta la decide.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('escribir en un composer NO afecta el estado del otro', async () => {
    const user = userEvent.setup();
    render(<TicketMessagingThread ticketId="ticket-1" />);
    const replyBox = screen.getByPlaceholderText(/respuesta para el cliente/i) as HTMLTextAreaElement;
    const noteBox = screen.getByPlaceholderText(/nota interna/i) as HTMLTextAreaElement;
    await user.type(replyBox, 'texto público');
    expect(noteBox.value).toBe('');
    await user.type(noteBox, 'texto interno');
    expect(replyBox.value).toBe('texto público');
  });

  it('sin permiso tickets.write: NINGUNO de los dos composers se muestra (el hilo sí)', () => {
    vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(false);
    setComments([{ id: 'c1', ticketId: 'ticket-1', authorName: 'Ana', body: 'hola', createdAt: '2026-06-01T10:00:00.000Z', attachments: [], visibility: 'internal', authorKind: 'staff' }]);
    render(<TicketMessagingThread ticketId="ticket-1" />);
    expect(screen.getByText('hola')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Responder al cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Agregar nota interna' })).not.toBeInTheDocument();
  });
});
