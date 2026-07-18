/**
 * useWhatsapp — useSnoozeConversation / useMarkMentionsRead / usePreviousConversations
 * (Ola 6). Archivo dedicado (mismo criterio que `useWhatsapp.status.test.ts`).
 *
 * Contrato (ver `useWhatsapp.ts`):
 *  - `useSnoozeConversation(id).snooze(iso)` → `POST /snooze` con `(convId, iso)`;
 *    `onSettled` invalida lista + counts (la conversación sale de Abiertas).
 *    `isPending` scopeado por convId capturado al dispatch.
 *  - `useMarkMentionsRead().markRead(convId)` → `POST /mentions/read`; `onSettled`
 *    invalida lista + counts (sale de `view=mentioned`).
 *  - `usePreviousConversations(id, enabled)` → `GET /previous`, gateado por
 *    `enabled` (fetch-on-expand): con `enabled=false` NO pega al endpoint.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { WhatsappConversationListItem, WhatsappInboxViewCounts, WhatsappPreviousConversation } from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  snoozeConversation: vi.fn(),
  markConversationMentionsRead: vi.fn(),
  getPreviousConversations: vi.fn(),
  getInboxViewCounts: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import {
  snoozeConversation,
  markConversationMentionsRead,
  getPreviousConversations,
  getInboxViewCounts,
} from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useSnoozeConversation,
  useMarkMentionsRead,
  usePreviousConversations,
  useInboxViewCounts,
} from '@/hooks/useWhatsapp';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
};

const COUNTS: WhatsappInboxViewCounts = {
  mine: 1,
  unattended: 1,
  mentioned: 1,
  all: 1,
  unassigned: 0,
  snoozed: 0,
  resolved: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

describe('useSnoozeConversation(id).snooze', () => {
  it('llama a la API con (convId, snoozedUntil)', async () => {
    vi.mocked(snoozeConversation).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSnoozeConversation('conv-1'), { wrapper });

    act(() => {
      result.current.snooze('2026-07-20T09:00:00.000Z');
    });

    await waitFor(() =>
      expect(snoozeConversation).toHaveBeenCalledWith('conv-1', '2026-07-20T09:00:00.000Z'),
    );
  });

  it('onSettled invalida los counts (la conversación cambia de vista) → refetch', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(snoozeConversation).mockResolvedValue({ ...LIST_ITEM, snoozedUntil: '2026-07-20T09:00:00.000Z' });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ counts: useInboxViewCounts(), mutation: useSnoozeConversation('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.counts.data).toEqual(COUNTS));
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.snooze('2026-07-20T09:00:00.000Z');
    });

    await waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(2));
  });

  it('propaga opts.onError cuando el POST falla', async () => {
    vi.mocked(snoozeConversation).mockRejectedValue(new Error('422 fecha no futura'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSnoozeConversation('conv-1'), { wrapper });
    const onError = vi.fn();

    await act(async () => {
      result.current.snooze('2020-01-01T00:00:00.000Z', { onError });
    });

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

describe('useMarkMentionsRead().markRead', () => {
  it('llama a la API con el convId e invalida los counts (sale de Menciones)', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(markConversationMentionsRead).mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ counts: useInboxViewCounts(), mutation: useMarkMentionsRead() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.counts.data).toEqual(COUNTS));
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.markRead('conv-1');
    });

    await waitFor(() => expect(markConversationMentionsRead).toHaveBeenCalledWith('conv-1'));
    await waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(2));
  });
});

describe('usePreviousConversations(id, enabled) — fetch-on-expand', () => {
  const PREV: WhatsappPreviousConversation[] = [
    {
      id: 'conv-2',
      status: 'resolved',
      lastMessageAt: '2026-07-01T12:00:00.000Z',
      lastMessagePreview: 'gracias',
      assigneeName: 'Ana',
      unread: false,
      labels: [],
    },
  ];

  it('con enabled=false NO pega al endpoint (lazy)', async () => {
    vi.mocked(getPreviousConversations).mockResolvedValue(PREV);
    const { wrapper } = makeWrapper();
    renderHook(() => usePreviousConversations('conv-1', false), { wrapper });

    // Un tick para descartar un fetch tardío.
    await new Promise((r) => setTimeout(r, 0));
    expect(getPreviousConversations).not.toHaveBeenCalled();
  });

  it('con enabled=true fetchea las conversaciones previas del contacto', async () => {
    vi.mocked(getPreviousConversations).mockResolvedValue(PREV);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePreviousConversations('conv-1', true), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(PREV));
    expect(getPreviousConversations).toHaveBeenCalledWith('conv-1');
  });

  it('sin id (null) NO fetchea aunque enabled=true', async () => {
    vi.mocked(getPreviousConversations).mockResolvedValue(PREV);
    const { wrapper } = makeWrapper();
    renderHook(() => usePreviousConversations(null, true), { wrapper });

    await new Promise((r) => setTimeout(r, 0));
    expect(getPreviousConversations).not.toHaveBeenCalled();
  });
});
