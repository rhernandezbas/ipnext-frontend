/**
 * useWhatsapp — hooks del inbox WhatsApp (messaging-inbox F1, design §4/§5).
 * Un archivo, 4 hooks (convención del repo, molde `useTicketComments.ts` /
 * `useUispSyncStatus.ts` — no uno por hook).
 *
 *  WHATS-1 useWhatsappConversations: queryKey ['whatsapp','conversations',query],
 *          refetchInterval visible?15000:false, keepPreviousData (sin flicker)
 *  WHATS-2 useWhatsappConversation(id): enabled:!!id, queryKey
 *          ['whatsapp','conversation',id], refetchInterval visible?25000:false
 *  WHATS-3 useWhatsappMessages(id): enabled:!!id, queryKey
 *          ['whatsapp','messages',id], refetchInterval visible?5000:false
 *  WHATS-4 useSendWhatsappMessage(id): onSuccess → append optimista en el
 *          cache de mensajes + invalidate conversations; onError captura
 *          422/503 sin relanzar (el composer, FB3, lee isError/error)
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappMessage,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  listWhatsappConversations: vi.fn(),
  getWhatsappConversation: vi.fn(),
  listWhatsappMessages: vi.fn(),
  sendWhatsappMessage: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import {
  listWhatsappConversations,
  getWhatsappConversation,
  listWhatsappMessages,
  sendWhatsappMessage,
} from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useWhatsappConversations,
  useWhatsappConversation,
  useWhatsappMessages,
  useSendWhatsappMessage,
  whatsappConversationsKey,
  whatsappConversationKey,
  whatsappMessagesKey,
} from '@/hooks/useWhatsapp';

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-10T12:00:00.000Z',
  preview: 'hola, tengo un problema',
  status: 'open',
};

const PAGE_1: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [LIST_ITEM],
  total: 2,
  page: 1,
  limit: 1,
};

const PAGE_2: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [{ ...LIST_ITEM, id: 'conv-2', contactName: 'Maria Gomez' }],
  total: 2,
  page: 2,
  limit: 1,
};

const DETAIL: WhatsappConversationDetail = {
  ...LIST_ITEM,
  canReply: true,
  clientContext: { status: 'matched', clients: [{ id: 'cli-1', name: 'Juan Perez', status: 'active' }] },
};

const MESSAGE_1: WhatsappMessage = {
  id: 'msg-1',
  direction: 'inbound',
  content: 'hola, tengo un problema',
  senderName: 'Juan Perez',
  sentAt: '2026-07-10T12:00:00.000Z',
};

const MESSAGE_SENT: WhatsappMessage = {
  id: 'msg-2',
  direction: 'outbound',
  content: 'ya te ayudamos',
  senderName: 'Agente',
  sentAt: '2026-07-10T12:05:00.000Z',
};

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

describe('WHATS-1: useWhatsappConversations', () => {
  it('llama al api con el query y cachea bajo la key ["whatsapp","conversations",query]', async () => {
    vi.mocked(listWhatsappConversations).mockResolvedValue(PAGE_1);
    const { qc, wrapper } = makeWrapper();
    const query = { page: 1, limit: 1 };

    const { result } = renderHook(() => useWhatsappConversations(query), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listWhatsappConversations).toHaveBeenCalledWith(query);
    expect(result.current.data).toEqual(PAGE_1);
    expect(qc.getQueryData(whatsappConversationsKey(query))).toEqual(PAGE_1);
  });

  it('mantiene la data anterior mientras refetchea un query distinto (placeholderData keepPreviousData, sin flicker)', async () => {
    let resolveSecond!: (v: WhatsappPaginatedResult<WhatsappConversationListItem>) => void;
    const second = new Promise<WhatsappPaginatedResult<WhatsappConversationListItem>>(resolve => {
      resolveSecond = resolve;
    });
    vi.mocked(listWhatsappConversations)
      .mockResolvedValueOnce(PAGE_1)
      .mockImplementationOnce(() => second);
    const { wrapper } = makeWrapper();

    const { result, rerender } = renderHook(
      ({ query }: { query: { page: number; limit: number } }) => useWhatsappConversations(query),
      { wrapper, initialProps: { query: { page: 1, limit: 1 } } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PAGE_1);

    rerender({ query: { page: 2, limit: 1 } });

    // La 2da página está en vuelo — sin flicker, sigue mostrando la 1ra.
    expect(result.current.isFetching).toBe(true);
    expect(result.current.data).toEqual(PAGE_1);

    resolveSecond(PAGE_2);
    await waitFor(() => expect(result.current.data).toEqual(PAGE_2));
  });

  it('refetchea cada 15s SOLO con la pestaña visible (gate useDocumentVisible)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listWhatsappConversations).mockResolvedValue(PAGE_1);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useWhatsappConversations({}), { wrapper });
    await vi.waitFor(() => expect(listWhatsappConversations).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(listWhatsappConversations).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('NO refetchea si la pestaña está oculta (visible=false → refetchInterval false)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listWhatsappConversations).mockResolvedValue(PAGE_1);
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useWhatsappConversations({}), { wrapper });
    await vi.waitFor(() => expect(listWhatsappConversations).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(listWhatsappConversations).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('WHATS-2: useWhatsappConversation(id)', () => {
  it('con id vacío NO dispara el fetch (enabled:!!id)', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWhatsappConversation(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getWhatsappConversation).not.toHaveBeenCalled();
  });

  it('con id trae el detalle y cachea bajo ["whatsapp","conversation",id]', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useWhatsappConversation('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getWhatsappConversation).toHaveBeenCalledWith('conv-1');
    expect(result.current.data).toEqual(DETAIL);
    expect(qc.getQueryData(whatsappConversationKey('conv-1'))).toEqual(DETAIL);
  });

  it('bug #6 — refetchea cada 25s (NO 5s) solo con la pestaña visible: bajar la frecuencia del detalle evita saturar el sync a Chatwoot (~720/h/agente a 5s)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useWhatsappConversation('conv-1'), { wrapper });
    await vi.waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(1));

    // A los 5s (el intervalo viejo) todavía NO debería haber refetcheado.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    // A los 25s (total) sí.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getWhatsappConversation).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('WHATS-3: useWhatsappMessages(id)', () => {
  it('con id vacío NO dispara el fetch (enabled:!!id)', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWhatsappMessages(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listWhatsappMessages).not.toHaveBeenCalled();
  });

  it('con id trae los mensajes y cachea bajo ["whatsapp","messages",id]', async () => {
    vi.mocked(listWhatsappMessages).mockResolvedValue([MESSAGE_1]);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useWhatsappMessages('conv-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listWhatsappMessages).toHaveBeenCalledWith('conv-1');
    expect(result.current.data).toEqual([MESSAGE_1]);
    expect(qc.getQueryData(whatsappMessagesKey('conv-1'))).toEqual([MESSAGE_1]);
  });

  it('pausa el polling sin foco de pestaña (THREAD-1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listWhatsappMessages).mockResolvedValue([MESSAGE_1]);
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useWhatsappMessages('conv-1'), { wrapper });
    await vi.waitFor(() => expect(listWhatsappMessages).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(listWhatsappMessages).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('WHATS-4: useSendWhatsappMessage(id)', () => {
  it('onSuccess: appendea el mensaje al cache de mensajes de esa conversación (optimistic append)', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(MESSAGE_SENT);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappMessagesKey('conv-1'), [MESSAGE_1]);

    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ya te ayudamos');
    });

    expect(sendWhatsappMessage).toHaveBeenCalledWith('conv-1', 'ya te ayudamos');
    expect(qc.getQueryData(whatsappMessagesKey('conv-1'))).toEqual([MESSAGE_1, MESSAGE_SENT]);
  });

  it('onSuccess: invalida ["whatsapp","conversations"] (barato, NO invalida conversation(id))', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(MESSAGE_SENT);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ya te ayudamos');
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: whatsappConversationKey('conv-1') });
  });

  it('bug #5 — onSuccess cancela queries en vuelo del thread ANTES de aplicar el append (evita el race con el poll)', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(MESSAGE_SENT);
    const { qc, wrapper } = makeWrapper();
    const cancelSpy = vi.spyOn(qc, 'cancelQueries');
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ya te ayudamos');
    });

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: whatsappMessagesKey('conv-1') });
  });

  it('bug #5 — dedup: si el poll ya trajo el mensaje enviado (mismo id) antes de que resuelva onSuccess, no lo duplica', async () => {
    vi.mocked(sendWhatsappMessage).mockResolvedValue(MESSAGE_SENT);
    const { qc, wrapper } = makeWrapper();
    // El poll "ganó la carrera": el mensaje ya está en cache cuando llega onSuccess.
    qc.setQueryData(whatsappMessagesKey('conv-1'), [MESSAGE_1, MESSAGE_SENT]);
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ya te ayudamos');
    });

    expect(qc.getQueryData(whatsappMessagesKey('conv-1'))).toEqual([MESSAGE_1, MESSAGE_SENT]);
  });

  it('onError: 422 ventana expirada NO revienta — mutate() no crashea, isError queda accesible', async () => {
    const windowExpired = Object.assign(new Error('ventana expirada'), {
      response: { status: 422, data: { error: 'ventana expirada', code: 'MESSAGING_WINDOW_EXPIRED' } },
    });
    vi.mocked(sendWhatsappMessage).mockRejectedValue(windowExpired);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSendWhatsappMessage('conv-1'), { wrapper });

    act(() => {
      result.current.mutate('mensaje tarde');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(windowExpired);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
