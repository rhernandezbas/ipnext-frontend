/**
 * useTicketMessages hooks — mutation (respuesta pública al cliente) + query
 * (contador de no leídos). Strict TDD: escrito ANTES de la implementación.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/ticketMessages.api', () => ({
  sendStaffTicketReply: vi.fn(),
  getTicketUnreadCount: vi.fn(),
}));

import * as api from '@/api/ticketMessages.api';
import { useSendStaffTicketReply, useTicketUnreadCount } from '@/hooks/useTicketMessages';
import type { TicketMessage } from '@/types/ticketMessages';

const mockApi = api as unknown as {
  sendStaffTicketReply: ReturnType<typeof vi.fn>;
  getTicketUnreadCount: ReturnType<typeof vi.fn>;
};

function msg(): TicketMessage {
  return {
    id: 'm1',
    ticketId: 'ticket-1',
    authorId: 'u1',
    authorKind: 'staff',
    visibility: 'public',
    authorName: 'Ana',
    body: 'hola',
    createdAt: '2026-06-01T00:00:00.000Z',
    attachments: [],
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

describe('useTicketMessages hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useSendStaffTicketReply calls the api and invalidates BOTH the comments thread and the unread-count query', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    mockApi.sendStaffTicketReply.mockResolvedValue(msg());

    const { result } = renderHook(() => useSendStaffTicketReply('ticket-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ticketId: 'ticket-1', body: 'hola', files: [] });
    });

    expect(mockApi.sendStaffTicketReply).toHaveBeenCalledWith({ ticketId: 'ticket-1', body: 'hola', files: [] });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['ticket-comments', 'ticket-1'] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['ticket-messages-unread-count', 'ticket-1'] }),
      );
    });
  });

  it('useTicketUnreadCount queries the api with the ticketId', async () => {
    const { wrapper } = makeWrapper();
    mockApi.getTicketUnreadCount.mockResolvedValue(2);

    const { result } = renderHook(() => useTicketUnreadCount('ticket-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.getTicketUnreadCount).toHaveBeenCalledWith('ticket-1');
    expect(result.current.data).toBe(2);
  });

  it('useTicketUnreadCount is disabled (no fetch) when ticketId is empty', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useTicketUnreadCount(''), { wrapper });
    expect(mockApi.getTicketUnreadCount).not.toHaveBeenCalled();
  });
});
