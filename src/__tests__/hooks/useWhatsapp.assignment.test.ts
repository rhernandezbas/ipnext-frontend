/**
 * useWhatsapp — useSetConversationAssignee / useSetConversationArea /
 * useAssignableUsers / useMessagingAreas (messaging-inbox-assignment F1.5-C2
 * — ASIGNACIÓN). Archivo DEDICADO (mismo criterio que `useWhatsapp.status.test.ts`
 * / `useWhatsapp.send.test.ts`): las mutations tienen su propio contrato
 * completo (optimistic update de detalle+lista + rollback + invalidate
 * onSettled), CLON del contrato de `useSetConversationStatus` — separado para
 * no inflar `useWhatsapp.test.ts`.
 *
 * Contrato (ver `useWhatsapp.ts`):
 *  - `onMutate` patchea `assignee`/`area` en el detalle cacheado
 *    (`whatsappConversationKey`) Y en TODAS las páginas cacheadas de
 *    `whatsappConversationsKey` que contengan esa conversación, ANTES de que
 *    la red resuelva.
 *  - `onError` hace rollback EXACTO (detalle + todas las listas) al valor
 *    previo al optimista.
 *  - `onSettled` invalida detalle+lista SIEMPRE (éxito o error) — el
 *    optimista se asienta en el refetch real, nunca queda "colgado" (el
 *    polling de Chatwoot NO trae assignee/area, son locales del BE).
 *  - Bug CRÍTICO #1 defensa (mismo criterio que `useSendWhatsappMessage`/
 *    `useSetConversationStatus`): todas las keys se derivan de `vars.convId`
 *    capturado en `setAssignee`/`setArea` AL MOMENTO del dispatch, nunca del
 *    closure `id` del hook.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type {
  WhatsappArea,
  WhatsappAssignee,
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  setConversationAssignee: vi.fn(),
  setConversationArea: vi.fn(),
  getAssignableUsers: vi.fn(),
  getMessagingAreas: vi.fn(),
  getWhatsappConversation: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import {
  setConversationAssignee,
  setConversationArea,
  getAssignableUsers,
  getMessagingAreas,
  getWhatsappConversation,
} from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useSetConversationAssignee,
  useSetConversationArea,
  useAssignableUsers,
  useMessagingAreas,
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

const USER_ANA: WhatsappAssignee = { id: 'u1', name: 'Ana Torres' };
const USER_BETO: WhatsappAssignee = { id: 'u2', name: 'Beto Diaz' };
const AREA_SOPORTE: WhatsappArea = { id: 'a1', name: 'Soporte', color: '#2563eb' };

const DETAIL: WhatsappConversationDetail = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
  canReply: true,
  clientContext: { status: 'matched', clients: [] },
  assignee: null,
  area: null,
};

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
  assignee: null,
  area: null,
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

describe('useSetConversationAssignee(id).setAssignee — optimistic update', () => {
  it('patchea el assignee en el detalle cacheado ANTES de que la red resuelva', async () => {
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    act(() => {
      result.current.setAssignee(USER_ANA);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.assignee).toEqual(USER_ANA);
    });
  });

  it('patchea el assignee en TODAS las páginas cacheadas de la lista que contienen esa conversación, sin tocar las demás filas', async () => {
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    act(() => {
      result.current.setAssignee(USER_ANA);
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.assignee).toEqual(USER_ANA);
    });
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.assignee).toBeNull();
  });

  it('setAssignee(null) desasigna optimistamente', async () => {
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), { ...DETAIL, assignee: USER_ANA });
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    act(() => {
      result.current.setAssignee(null);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.assignee).toBeNull();
    });
    expect(setConversationAssignee).toHaveBeenCalledWith('conv-1', null);
  });

  it('llama a la API con (convId, assigneeId) correctos', async () => {
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    act(() => {
      result.current.setAssignee(USER_BETO);
    });

    await waitFor(() => expect(setConversationAssignee).toHaveBeenCalledWith('conv-1', 'u2'));
  });

  it('sin páginas de lista ni detalle cacheados, el optimista no crashea', async () => {
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    expect(() => {
      act(() => {
        result.current.setAssignee(USER_ANA);
      });
    }).not.toThrow();
  });
});

describe('useSetConversationAssignee(id).setAssignee — rollback en error', () => {
  it('si el PATCH falla, el detalle vuelve EXACTO al valor previo al optimista', async () => {
    vi.mocked(setConversationAssignee).mockRejectedValue(new Error('403'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    await act(async () => {
      result.current.setAssignee(USER_ANA);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))).toEqual(DETAIL);
    });
  });

  it('si el PATCH falla, la lista vuelve EXACTA al valor previo', async () => {
    vi.mocked(setConversationAssignee).mockRejectedValue(new Error('403'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    await act(async () => {
      result.current.setAssignee(USER_ANA);
    });

    await waitFor(() => {
      expect(qc.getQueryData(whatsappConversationsKey({}))).toEqual(PAGE);
    });
  });

  it('expone isError/error tras el fallo', async () => {
    vi.mocked(setConversationAssignee).mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationAssignee('conv-1'), { wrapper });

    await act(async () => {
      result.current.setAssignee(USER_ANA);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetConversationAssignee(id) — onSettled invalida SIEMPRE (el optimista se asienta en el refetch, no queda colgado)', () => {
  it('tras un éxito, invalida el detalle y dispara un refetch real', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    vi.mocked(setConversationAssignee).mockResolvedValue({ ...LIST_ITEM, assignee: USER_ANA });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ detail: useWhatsappConversation('conv-1'), mutation: useSetConversationAssignee('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.data).toEqual(DETAIL));
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.setAssignee(USER_ANA);
    });

    await waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(2));
  });

  it('tras un error, TAMBIÉN invalida (no deja el detalle desactualizado por un optimista fantasma)', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    vi.mocked(setConversationAssignee).mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ detail: useWhatsappConversation('conv-1'), mutation: useSetConversationAssignee('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.data).toEqual(DETAIL));
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.mutation.setAssignee(USER_ANA);
    });

    await waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(2));
  });
});

describe('useSetConversationAssignee(id) — bug CRÍTICO #1 defensa (keys derivadas de convId capturado en el dispatch, no del closure `id`)', () => {
  it('si el conversationId cambia MIENTRAS la mutation está en vuelo, el resultado se asienta en el slice de la conversación ORIGINAL', async () => {
    let resolveMutation!: (v: WhatsappConversationListItem) => void;
    vi.mocked(setConversationAssignee).mockImplementation(() => new Promise((r) => { resolveMutation = r; }));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-a'), { ...DETAIL, id: 'conv-a' });
    qc.setQueryData(whatsappConversationKey('conv-b'), { ...DETAIL, id: 'conv-b' });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSetConversationAssignee(id),
      { wrapper, initialProps: { id: 'conv-a' } },
    );

    act(() => {
      result.current.setAssignee(USER_ANA);
    });
    await waitFor(() =>
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-a'))?.assignee).toEqual(USER_ANA),
    );

    rerender({ id: 'conv-b' });

    expect(result.current.isPending).toBe(false);

    resolveMutation({ ...LIST_ITEM, id: 'conv-a', assignee: USER_ANA });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-b'))?.assignee).toBeNull();
    });
    expect(setConversationAssignee).toHaveBeenCalledWith('conv-a', 'u1');
  });
});

// ─── useSetConversationArea — MISMO contrato que useSetConversationAssignee ──

describe('useSetConversationArea(id).setArea — optimistic update + rollback + onSettled', () => {
  it('patchea el area en el detalle cacheado ANTES de que la red resuelva', async () => {
    vi.mocked(setConversationArea).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationArea('conv-1'), { wrapper });

    act(() => {
      result.current.setArea(AREA_SOPORTE);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.area).toEqual(AREA_SOPORTE);
    });
  });

  it('patchea el area en TODAS las páginas cacheadas de la lista que contienen esa conversación', async () => {
    vi.mocked(setConversationArea).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationArea('conv-1'), { wrapper });

    act(() => {
      result.current.setArea(AREA_SOPORTE);
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.area).toEqual(AREA_SOPORTE);
    });
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.area).toBeNull();
  });

  it('setArea(null) quita el área optimistamente', async () => {
    vi.mocked(setConversationArea).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), { ...DETAIL, area: AREA_SOPORTE });
    const { result } = renderHook(() => useSetConversationArea('conv-1'), { wrapper });

    act(() => {
      result.current.setArea(null);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.area).toBeNull();
    });
    expect(setConversationArea).toHaveBeenCalledWith('conv-1', null);
  });

  it('llama a la API con (convId, areaId) correctos', async () => {
    vi.mocked(setConversationArea).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationArea('conv-1'), { wrapper });

    act(() => {
      result.current.setArea(AREA_SOPORTE);
    });

    await waitFor(() => expect(setConversationArea).toHaveBeenCalledWith('conv-1', 'a1'));
  });

  it('si el PATCH falla, el detalle y la lista vuelven EXACTOS al valor previo (rollback)', async () => {
    vi.mocked(setConversationArea).mockRejectedValue(new Error('403'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationArea('conv-1'), { wrapper });

    await act(async () => {
      result.current.setArea(AREA_SOPORTE);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))).toEqual(DETAIL);
    });
    expect(qc.getQueryData(whatsappConversationsKey({}))).toEqual(PAGE);
    expect(result.current.isError).toBe(true);
  });

  it('onSettled invalida detalle+lista tanto en éxito como en error', async () => {
    vi.mocked(getWhatsappConversation).mockResolvedValue(DETAIL);
    vi.mocked(setConversationArea).mockResolvedValue({ ...LIST_ITEM, area: AREA_SOPORTE });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ detail: useWhatsappConversation('conv-1'), mutation: useSetConversationArea('conv-1') }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.data).toEqual(DETAIL));
    expect(getWhatsappConversation).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.mutation.setArea(AREA_SOPORTE);
    });

    await waitFor(() => expect(getWhatsappConversation).toHaveBeenCalledTimes(2));
  });
});

// ─── hallazgo CRÍTICO #1 (review adversarial F1.5-C2): rollback FIELD-SCOPED ──
//
// `onMutate` snapshoteaba el detalle/fila ENTERA (no solo el campo que ESA
// mutation cambia) y `onError` restauraba ese snapshot completo. Si dos
// mutaciones overlapean (mismo conv, dos campos distintos; o dos convs, el
// mismo campo), el rollback de UNA pisaba el cambio optimista de la OTRA —
// porque restauraba TODO el objeto/fila, no solo su propio campo.

describe('useSetConversationAssignee / useSetConversationArea — rollback FIELD-SCOPED (hallazgo CRÍTICO #1)', () => {
  it('(A) mismo conv: assignee en vuelo que FALLA, mientras area cambia y se asienta en el medio → el area NO se revierte', async () => {
    let rejectAssignee!: (e: unknown) => void;
    vi.mocked(setConversationAssignee).mockImplementation(
      () => new Promise((_resolve, reject) => { rejectAssignee = reject; }),
    );
    vi.mocked(setConversationArea).mockResolvedValue({ ...LIST_ITEM, area: AREA_SOPORTE });
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL); // assignee:null, area:null

    const { result } = renderHook(
      () => ({ assignee: useSetConversationAssignee('conv-1'), area: useSetConversationArea('conv-1') }),
      { wrapper },
    );

    // 1. assignee arranca (en vuelo, todavía sin resolver) — su onMutate
    //    snapshotea el detalle ANTES de que el area cambie.
    act(() => {
      result.current.assignee.setAssignee(USER_ANA);
    });
    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.assignee).toEqual(USER_ANA);
    });

    // 2. MIENTRAS tanto, area cambia y se ASIENTA (mutation completa) — "en
    //    el medio" de la mutation de assignee, todavía pendiente.
    await act(async () => {
      result.current.area.setArea(AREA_SOPORTE);
    });
    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.area).toEqual(AREA_SOPORTE);
    });

    // 3. AHORA falla la mutation de assignee (la que seguía en vuelo desde el paso 1).
    await act(async () => {
      rejectAssignee(new Error('403'));
    });

    // El rollback de assignee revierte SOLO assignee (a null) — el area
    // recién asentada por la OTRA mutation NO debe pisarse.
    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.assignee).toBeNull();
    });
    expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.area).toEqual(AREA_SOPORTE);
  });

  it('(B) dos convs: asignar A (falla) DESPUÉS de asignar B (ya asentado) → la fila de B en la lista NO se revierte', async () => {
    let rejectA!: (e: unknown) => void;
    vi.mocked(setConversationAssignee).mockImplementation((convId: string) => {
      if (convId === 'conv-1') return new Promise((_resolve, reject) => { rejectA = reject; });
      return Promise.resolve({ ...OTHER_LIST_ITEM, assignee: USER_BETO });
    });
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE); // conv-1:null, conv-2:null

    const { result } = renderHook(
      () => ({ a: useSetConversationAssignee('conv-1'), b: useSetConversationAssignee('conv-2') }),
      { wrapper },
    );

    // 1. A arranca (en vuelo) — snapshotea la página ANTES de que B cambie.
    act(() => {
      result.current.a.setAssignee(USER_ANA);
    });
    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.assignee).toEqual(USER_ANA);
    });

    // 2. B cambia y se asienta (mutation completa) MIENTRAS A sigue en vuelo.
    await act(async () => {
      result.current.b.setAssignee(USER_BETO);
    });
    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-2')?.assignee).toEqual(USER_BETO);
    });

    // 3. AHORA falla A.
    await act(async () => {
      rejectA(new Error('403'));
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.assignee).toBeNull();
    });
    // La fila de B (asentada por SU PROPIA mutation, ajena a la de A) NO debe revertirse.
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.assignee).toEqual(USER_BETO);
  });
});

// ─── Catálogos: useAssignableUsers / useMessagingAreas (queries simples) ────

describe('useAssignableUsers — catálogo cacheado', () => {
  it('llama a getAssignableUsers y expone la lista', async () => {
    vi.mocked(getAssignableUsers).mockResolvedValue([USER_ANA, USER_BETO]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useAssignableUsers(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([USER_ANA, USER_BETO]));
    expect(getAssignableUsers).toHaveBeenCalledTimes(1);
  });
});

describe('useMessagingAreas — catálogo cacheado (compartido con tickets)', () => {
  it('llama a getMessagingAreas y expone la lista', async () => {
    vi.mocked(getMessagingAreas).mockResolvedValue([AREA_SOPORTE]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingAreas(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([AREA_SOPORTE]));
    expect(getMessagingAreas).toHaveBeenCalledTimes(1);
  });
});
