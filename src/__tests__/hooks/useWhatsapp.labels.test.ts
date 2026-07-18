/**
 * useWhatsapp — Ola 5 (labels): useMessagingLabels (catálogo) +
 * useSetConversationLabels (optimistic replace del set) + ABM
 * (useCreate/Update/DeleteMessagingLabel). Archivo DEDICADO (mismo criterio que
 * `useWhatsapp.assignment.test.ts`): la mutation de labels es un CLON
 * estructural de `useSetConversationArea` pero sobre `labels: WhatsappLabel[]`
 * (array), con el mismo contrato (optimistic detalle+lista + rollback
 * field-scoped + invalidate onSettled + keys por `vars.convId`).
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type {
  WhatsappConversationDetail,
  WhatsappConversationListItem,
  WhatsappLabel,
  WhatsappPaginatedResult,
} from '@/types/whatsapp';

vi.mock('@/api/whatsapp.api', () => ({
  listMessagingLabels: vi.fn(),
  createMessagingLabel: vi.fn(),
  updateMessagingLabel: vi.fn(),
  deleteMessagingLabel: vi.fn(),
  setConversationLabels: vi.fn(),
  getWhatsappConversation: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import {
  listMessagingLabels,
  createMessagingLabel,
  updateMessagingLabel,
  deleteMessagingLabel,
  setConversationLabels,
} from '@/api/whatsapp.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useMessagingLabels,
  useSetConversationLabels,
  useCreateMessagingLabel,
  useUpdateMessagingLabel,
  useDeleteMessagingLabel,
  whatsappConversationKey,
  whatsappConversationsKey,
  whatsappLabelsKey,
} from '@/hooks/useWhatsapp';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const LABEL_URGENTE: WhatsappLabel = { id: 'l1', name: 'Urgente', color: '#dc3545' };
const LABEL_VENTAS: WhatsappLabel = { id: 'l2', name: 'Ventas', color: '#28a745' };

const DETAIL: WhatsappConversationDetail = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
  canReply: true,
  clientContext: { status: 'matched', clients: [] },
  labels: [],
};

const LIST_ITEM: WhatsappConversationListItem = {
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491100000000',
  lastMessageAt: '2026-07-12T12:00:00.000Z',
  preview: 'hola',
  status: 'open',
  labels: [],
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

describe('useMessagingLabels — catálogo cacheado', () => {
  it('llama a listMessagingLabels y expone la lista', async () => {
    vi.mocked(listMessagingLabels).mockResolvedValue([LABEL_URGENTE, LABEL_VENTAS]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useMessagingLabels(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([LABEL_URGENTE, LABEL_VENTAS]));
    expect(listMessagingLabels).toHaveBeenCalledTimes(1);
  });
});

describe('useSetConversationLabels(id).setLabels — optimistic replace', () => {
  it('patchea labels en el detalle cacheado ANTES de que la red resuelva', async () => {
    vi.mocked(setConversationLabels).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationLabels('conv-1'), { wrapper });

    act(() => {
      result.current.setLabels([LABEL_URGENTE]);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.labels).toEqual([LABEL_URGENTE]);
    });
  });

  it('patchea labels en la lista, sin tocar las demás filas', async () => {
    vi.mocked(setConversationLabels).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationsKey({}), PAGE);
    const { result } = renderHook(() => useSetConversationLabels('conv-1'), { wrapper });

    act(() => {
      result.current.setLabels([LABEL_URGENTE, LABEL_VENTAS]);
    });

    await waitFor(() => {
      const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
      expect(page?.data.find((c) => c.id === 'conv-1')?.labels).toEqual([LABEL_URGENTE, LABEL_VENTAS]);
    });
    const page = qc.getQueryData<WhatsappPaginatedResult<WhatsappConversationListItem>>(whatsappConversationsKey({}));
    expect(page?.data.find((c) => c.id === 'conv-2')?.labels).toEqual([]);
  });

  it('llama a la API con (convId, labelIds derivados de los objetos)', async () => {
    vi.mocked(setConversationLabels).mockImplementation(() => new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetConversationLabels('conv-1'), { wrapper });

    act(() => {
      result.current.setLabels([LABEL_URGENTE, LABEL_VENTAS]);
    });

    await waitFor(() => expect(setConversationLabels).toHaveBeenCalledWith('conv-1', ['l1', 'l2']));
  });

  it('setLabels([]) limpia el set optimistamente y manda labelIds:[]', async () => {
    vi.mocked(setConversationLabels).mockImplementation(() => new Promise(() => {}));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), { ...DETAIL, labels: [LABEL_URGENTE] });
    const { result } = renderHook(() => useSetConversationLabels('conv-1'), { wrapper });

    act(() => {
      result.current.setLabels([]);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))?.labels).toEqual([]);
    });
    expect(setConversationLabels).toHaveBeenCalledWith('conv-1', []);
  });

  it('si el PATCH falla, el detalle vuelve EXACTO al valor previo (rollback field-scoped)', async () => {
    vi.mocked(setConversationLabels).mockRejectedValue(new Error('403'));
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(whatsappConversationKey('conv-1'), DETAIL);
    const { result } = renderHook(() => useSetConversationLabels('conv-1'), { wrapper });

    await act(async () => {
      result.current.setLabels([LABEL_URGENTE]);
    });

    await waitFor(() => {
      expect(qc.getQueryData<WhatsappConversationDetail>(whatsappConversationKey('conv-1'))).toEqual(DETAIL);
    });
    expect(result.current.isError).toBe(true);
  });
});

describe('ABM del catálogo — invalidación', () => {
  it('useCreateMessagingLabel invalida el catálogo tras crear', async () => {
    vi.mocked(createMessagingLabel).mockResolvedValue(LABEL_URGENTE);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMessagingLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Urgente', color: '#dc3545' });
    });

    expect(createMessagingLabel).toHaveBeenCalledWith({ name: 'Urgente', color: '#dc3545' });
    expect(spy).toHaveBeenCalledWith({ queryKey: whatsappLabelsKey });
  });

  it('useUpdateMessagingLabel invalida catálogo + lista (los chips ya cacheados quedan stale)', async () => {
    vi.mocked(updateMessagingLabel).mockResolvedValue({ ...LABEL_URGENTE, name: 'Muy urgente' });
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateMessagingLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'l1', data: { name: 'Muy urgente' } });
    });

    expect(updateMessagingLabel).toHaveBeenCalledWith('l1', { name: 'Muy urgente' });
    expect(spy).toHaveBeenCalledWith({ queryKey: whatsappLabelsKey });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });

  it('useDeleteMessagingLabel invalida catálogo + lista', async () => {
    vi.mocked(deleteMessagingLabel).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMessagingLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('l1');
    });

    expect(deleteMessagingLabel).toHaveBeenCalledWith('l1');
    expect(spy).toHaveBeenCalledWith({ queryKey: whatsappLabelsKey });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['whatsapp', 'conversations'] });
  });
});
