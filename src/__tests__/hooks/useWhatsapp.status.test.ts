/**
 * useWhatsapp — useSetConversationStatus (messaging-inbox-productivity
 * F1.5-C v1 — RESOLVER/REABRIR). Archivo DEDICADO (mismo criterio que
 * `useWhatsapp.send.test.ts`): esta mutation tiene su propio contrato
 * completo (optimistic update de detalle+lista + rollback + invalidate
 * onSettled) — separado para no inflar `useWhatsapp.test.ts`.
 *
 * Contrato (ver `useWhatsapp.ts`):
 *  - `onMutate` patchea `status` en el detalle cacheado (`whatsappConversationKey`)
 *    Y en TODAS las páginas cacheadas de `whatsappConversationsKey` que
 *    contengan esa conversación, ANTES de que la red resuelva.
 *  - `onError` hace rollback EXACTO (detalle + todas las listas) al valor
 *    previo al optimista.
 *  - `onSettled` invalida detalle+lista SIEMPRE (éxito o error) — el
 *    optimista se asienta en el refetch real, nunca queda "colgado".
 *  - Bug CRÍTICO #1 defensa (mismo criterio que `useSendWhatsappMessage`):
 *    todas las keys se derivan de `vars.convId` capturado en `setStatus` AL
 *    MOMENTO del dispatch, nunca del closure `id` del hook.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  setConversationStatus: vi.fn(),
  getWhatsappConversation: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import { setConversationStatus, getWhatsappConversation } from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useSetConversationStatus,
  useWhatsappConversation,
  whatsappConversationKey,
  whatsappConversationsKey,
} from '@/hooks/useWhatsapp';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const DETAIL: WhatsappConversationDetail = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
  canReply: true,
  clientContext: { status: 'matched', clients: [] },
};

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
};

const OTHER_LIST_ITEM: WhatsappConversationListItem = { ...LIST_ITEM, id: 'conv-2', contactName: 'Maria Gomez' };

const PAGE: WhatsappPaginatedResult<WhatsappConversationListItem> = {
  data: [LIST_ITEM, OTHER_LIST_ITEM],
  total: 2,
  page: 1,
  limit: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

describe('useSetConversationStatus(id).setStatus — optimistic update', () => {
  it('patchea el status en el detalle cacheado ANTES de que la red resuelva', async () => {
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    act(() => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.status).toBe('resolved');
    });
  });

  it('patchea el status en TODAS las páginas cacheadas de la lista que contienen esa conversación, sin tocar las demás filas', async () => {
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    act(() => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.status).toBe('resolved');
    });
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.status).toBe('open');
  });

  it('sin detalle cacheado (conversación nunca abierta), el optimista no crea una entrada fantasma', async () => {
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    act(() => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => expect(setConversationStatus).toHaveBeenCalled());
    expect(qc.getQueryData(whatsappConversationKey('conv-1'))).toBeUndefined();
  });

  it('sin páginas de lista cacheadas, el optimista no crashea', async () => {
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    expect(() => {
      act(() => {
        result.current.setStatus('resolved');
      });
    }).not.toThrow();
  });

  it('llama a la API con (convId, status) correctos', async () => {
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    act(() => {
      result.current.setStatus('open');
    });

    await waitFor(() => expect(setConversationStatus).toHaveBeenCalledWith('conv-1', 'open'));
  });

  it('isPending refleja la mutation en vuelo', async () => {
    // hallazgo MEDIUM #4: `setConversationStatus` resuelve el shape de
    // LISTA (`WhatsappConversationListItem`), no el de detalle — ver la nota
    // en `whatsapp.api.ts`.
    let resolve!: (v: WhatsappConversationListItem) => void;
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolve({ ...LIST_ITEM, status: 'resolved' });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe('useSetConversationStatus(id).setStatus — rollback en error', () => {
  it('si el POST falla, el detalle vuelve EXACTO al valor previo al optimista', async () => {
    vi.mocked(setConversationStatus).mockRejectedValue(new Error('503 chatwoot caído'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    await act(async () => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))).toEqual(DETAIL);
    });
  });

  it('si el POST falla, la lista vuelve EXACTA al valor previo (no queda "resolved" pisado)', async () => {
    vi.mocked(setConversationStatus).mockRejectedValue(new Error('503 chatwoot caído'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    await act(async () => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => {
      expect(qc.getQueryData(whatsappConversationsKey({}))).toEqual(PAGE);
    });
  });

  it('expone isError/error tras el fallo', async () => {
    vi.mocked(setConversationStatus).mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationStatus('conv-1'), { wrapper });

    await act(async () => {
      result.current.setStatus('resolved');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetConversationStatus(id).setStatus — onSettled invalida (el optimista se asienta en el refetch, no queda colgado)', () => {
  it('tras un éxito, invalida el detalle y dispara un refetch real que trae el valor confirmado del BE', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    // hallazgo MEDIUM #4: shape de LISTA, no de detalle (ver nota arriba).
    vi.mocked(setConversationStatus).mockResolvedValue({ ...LIST_ITEM, status: 'resolved' });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ detail: useWhatsappConversation('conv-1'), mutation: useSetConversationStatus('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.data).toEqual(DETAIL));
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.setStatus('resolved');
    });

    await waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(2));
  });

  it('tras un error, TAMBIÉN invalida (no deja el detalle desactualizado por un optimista fantasma)', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    vi.mocked(setConversationStatus).mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ detail: useWhatsappConversation('conv-1'), mutation: useSetConversationStatus('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.data).toEqual(DETAIL));
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.mutation.setStatus('resolved');
    });

    await waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(2));
  });
});

describe('useSetConversationStatus(id) — rollback FIELD-SCOPED (hallazgo CRÍTICO #1, review adversarial F1.5-C2: mismo patrón que useSetConversationAssignee/useSetConversationArea)', () => {
  it('dos convs: cambiar status de A (falla) DESPUÉS de cambiar status de B (ya asentado) → la fila de B en la lista NO se revierte', async () => {
    let rejectA!: (e: unknown) => void;
    vi.mocked(setConversationStatus).mockImplementation((convId: string) => {
      if (convId === 'conv-1') return new Promise((_resolve, reject) => { rejectA = reject; });
      return Promise.resolve({ ...OTHER_LIST_ITEM, status: 'resolved' });
    });
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE); // conv-1:open, conv-2:open

    const { result } = renderHook(
      () => ({
        a: useSetConversationStatus('conv-1'),
        b: useSetConversationStatus('conv-2'),
      }),
      { wrapper },
    );

    // 1. A arranca (en vuelo) — snapshotea la página ANTES de que B cambie.
    act(() => {
      result.current.a.setStatus('resolved');
    });
    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.status).toBe('resolved');
    });

    // 2. B cambia y se asienta (mutation completa) MIENTRAS A sigue en vuelo.
    await act(async () => {
      result.current.b.setStatus('resolved');
    });
    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-2')?.status).toBe('resolved');
    });

    // 3. AHORA falla A.
    await act(async () => {
      rejectA(new Error('403'));
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.status).toBe('open');
    });
    // La fila de B (asentada por SU PROPIA mutation, ajena a la de A) NO debe revertirse.
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.status).toBe('resolved');
  });
});

describe('useSetConversationStatus(id) — bug CRÍTICO #1 defensa (keys derivadas de convId capturado en el dispatch, no del closure `id`)', () => {
  it('si el conversationId cambia MIENTRAS la mutation está en vuelo, el resultado se asienta en el slice de la conversación ORIGINAL', async () => {
    // hallazgo MEDIUM #4: shape de LISTA, no de detalle (ver nota arriba).
    let resolveMutation!: (v: WhatsappConversationListItem) => void;
    vi.mocked(setConversationStatus).mockImplementation(() => new Promise((r) => { resolveMutation = r; }));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-a'), { ...DETAIL, id: 'conv-a' });
    qc.setQueryData(whatsappConversationKey('conv-b'), { ...DETAIL, id: 'conv-b' });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSetConversationStatus(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.setStatus('resolved');
    });
    await waitFor(() =>
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-a'))?.status).toBe('resolved'),
    );

    // El agente cambia de conversación ANTES de que la red resuelva.
    rerender({ id: 'conv-b' });

    // Bug ALTO #2 (review adversarial F1.5-C): `isPending` venía de
    // `mutation.isPending` crudo — la MISMA instancia de `useMutation`
    // persiste entre renders (no se remonta por props), así que el botón de
    // conv-b (que NUNCA disparó su propio setStatus) quedaba deshabilitado
    // con el spinner de un request AJENO (el de conv-a, todavía en vuelo).
    // conv-b jamás pidió un cambio de status — su isPending debe ser false.
    expect(result.current.isPending).toBe(false);

    resolveMutation({ ...LIST_ITEM, id: 'conv-a', status: 'resolved' });

    await waitFor(() => {
      // conv-b JAMÁS pidió un cambio de status — su detalle sigue intacto ('open').
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-b'))?.status).toBe('open');
    });
    expect(setConversationStatus).toHaveBeenCalledWith('conv-a', 'resolved');
  });
});
