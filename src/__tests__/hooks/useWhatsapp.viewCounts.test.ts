/**
 * useWhatsapp — useInboxViewCounts (inbox-views Ola 1) + invalidación del
 * counts key en las mutations que MUEVEN conversaciones entre vistas.
 * Archivo DEDICADO (mismo criterio que `useWhatsapp.status.test.ts`).
 *
 * Contrato:
 *  - VC-1 queryKey `['whatsapp','viewCounts']` — FUERA del root de
 *    conversaciones (`['whatsapp','conversations']`) A PROPÓSITO: los
 *    optimistas de status/assignee/area hacen `setQueriesData` root-scoped
 *    asumiendo el shape paginado (`old.data.map`) — un entry de counts bajo
 *    ese root sería corrompido por esos updaters.
 *  - VC-2 polling 30s gateado por `useDocumentVisible` (mismo patrón que los
 *    otros hooks del archivo).
 *  - VC-3 un fallo del GET (403 sin messaging:read / 503) deja `data`
 *    undefined + isError — el sub-menú degrada a "sin números", nunca roto.
 *  - VC-4 `useSetConversationStatus` (resolver/reabrir) invalida el counts
 *    key en `onSettled` (éxito Y error) → refetch inmediato de los badges.
 *  - VC-5 `useSetConversationAssignee` (asignar) ídem — mover assignee cambia
 *    `mine`/`unassigned`.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { WhatsappConversationListItem, WhatsappInboxViewCounts } from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  getInboxViewCounts: vi.fn(),
  setConversationStatus: vi.fn(),
  setConversationAssignee: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import { getInboxViewCounts, setConversationStatus, setConversationAssignee } from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useInboxViewCounts,
  useSetConversationStatus,
  useSetConversationAssignee,
  whatsappViewCountsKey,
} from '@/hooks/useWhatsapp';

const COUNTS: WhatsappInboxViewCounts = { mine: 4, unattended: 7, all: 23, unassigned: 5, resolved: 118 };

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
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

afterEach(() => {
  vi.useRealTimers();
});

describe('VC-1: useInboxViewCounts — fetch + key', () => {
  it('llama al api y cachea bajo whatsappViewCountsKey', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useInboxViewCounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(COUNTS);
    expect(qc.getQueryData(whatsappViewCountsKey)).toEqual(COUNTS);
  });

  it('la key vive FUERA del root de conversaciones (los optimistas root-scoped asumen shape paginado)', () => {
    expect(whatsappViewCountsKey[0]).toBe('whatsapp');
    expect(whatsappViewCountsKey[1]).not.toBe('conversations');
  });
});

describe('VC-2: useInboxViewCounts — polling 30s gateado por visibilidad', () => {
  it('refetchea cada 30s SOLO con la pestaña visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useInboxViewCounts(), { wrapper });
    await vi.waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getInboxViewCounts).toHaveBeenCalledTimes(2);
  });

  it('NO refetchea con la pestaña oculta (visible=false → refetchInterval false)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useInboxViewCounts(), { wrapper });
    await vi.waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);
  });
});

describe('VC-3: useInboxViewCounts — degrade en error (sin messaging:read / BE caído)', () => {
  it('un GET fallido deja data undefined + isError:true (el sub-menú pinta sin números, no crashea)', async () => {
    vi.mocked(getInboxViewCounts).mockRejectedValue(new Error('403 forbidden'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useInboxViewCounts(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('VC-4: useSetConversationStatus invalida el counts key en onSettled', () => {
  it('tras un resolve EXITOSO, los counts se refetchean (el badge se mueve de "Todas" a "Resueltas" ya)', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(setConversationStatus).mockResolvedValue({ ...LIST_ITEM, status: 'resolved' });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ counts: useInboxViewCounts(), mutation: useSetConversationStatus('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.counts.isSuccess).toBe(true));
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.setStatus('resolved');
    });

    await waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(2));
  });

  it('tras un resolve FALLIDO, TAMBIÉN invalida (onSettled — el rollback local no garantiza que el agregado global no haya cambiado)', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(setConversationStatus).mockRejectedValue(new Error('503'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ counts: useInboxViewCounts(), mutation: useSetConversationStatus('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.counts.isSuccess).toBe(true));
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.mutation.setStatus('resolved');
    });

    await waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(2));
  });
});

describe('VC-5: useSetConversationAssignee invalida el counts key en onSettled', () => {
  it('asignar un agente refetchea los counts (mueve mine/unassigned)', async () => {
    vi.mocked(getInboxViewCounts).mockResolvedValue(COUNTS);
    vi.mocked(setConversationAssignee).mockResolvedValue({ ...LIST_ITEM, assignee: { id: 'u1', name: 'Ana' } });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ counts: useInboxViewCounts(), mutation: useSetConversationAssignee('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.counts.isSuccess).toBe(true));
    expect(getInboxViewCounts).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.setAssignee({ id: 'u1', name: 'Ana' });
    });

    await waitFor(() => expect(getInboxViewCounts).toHaveBeenCalledTimes(2));
  });
});
