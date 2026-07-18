/**
 * useCannedResponses — hooks de respuestas rápidas / macros (Ola 4). Un
 * archivo, molde `useTemplatesAdmin.ts` (convención del repo).
 *
 *  CRH-1 useCannedResponses(): queryKey ['cannedResponses'], gateado por
 *        `enabled` (NO fetchea con enabled:false — "no fetchear hasta abrir el
 *        popover"); staleTime de catálogo.
 *  CRH-2 useCreateCannedResponse(): mutation, invalida la lista al crear;
 *        mapea 409/400 a `serverError` legible.
 *  CRH-3 useUpdateCannedResponse(): mutation (id,input), invalida la lista.
 *  CRH-4 useDeleteCannedResponse(): mutation (id), invalida la lista al resolver.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { CannedResponse } from '@/types/cannedResponses';

vi.mock('@/api/cannedResponses.api', () => ({
  listCannedResponses: vi.fn(),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
}));

import {
  listCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from '@/api/cannedResponses.api';
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  cannedResponsesKey,
} from '@/hooks/useCannedResponses';

const CR: CannedResponse = {
  id: 'cr-1',
  shortcut: 'saludo',
  content: 'Hola, ¿en qué te puedo ayudar?',
  createdById: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: '',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data,
  };
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRH-1: useCannedResponses', () => {
  it('con enabled:false NO fetchea (no se pide hasta abrir el popover)', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useCannedResponses(false), { wrapper });
    expect(listCannedResponses).not.toHaveBeenCalled();
  });

  it('con enabled:true pide la lista y la expone', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([CR]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCannedResponses(true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([CR]);
    expect(listCannedResponses).toHaveBeenCalledTimes(1);
  });
});

describe('CRH-2: useCreateCannedResponse', () => {
  it('crea e invalida la lista', async () => {
    vi.mocked(createCannedResponse).mockResolvedValue(CR);
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.createAsync({ shortcut: 'saludo', content: 'Hola' });
    });

    expect(createCannedResponse).toHaveBeenCalledWith({ shortcut: 'saludo', content: 'Hola' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cannedResponsesKey });
  });

  it('mapea 409 SHORTCUT_TAKEN a un mensaje legible en serverError', async () => {
    vi.mocked(createCannedResponse).mockRejectedValue(
      makeAxiosError(409, { error: 'ya existe', code: 'SHORTCUT_TAKEN' }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.createAsync({ shortcut: 'saludo', content: 'Hola' }).catch(() => {});
    });

    await waitFor(() => expect(result.current.serverError).toMatch(/atajo ya está en uso/i));
  });

  it('mapea 400 VALIDATION_ERROR a un mensaje legible en serverError', async () => {
    vi.mocked(createCannedResponse).mockRejectedValue(
      makeAxiosError(400, { error: 'inválido', code: 'VALIDATION_ERROR' }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.createAsync({ shortcut: '', content: '' }).catch(() => {});
    });

    await waitFor(() => expect(result.current.serverError).toBeTruthy());
  });
});

describe('CRH-3: useUpdateCannedResponse', () => {
  it('actualiza (id,input) e invalida la lista', async () => {
    vi.mocked(updateCannedResponse).mockResolvedValue({ ...CR, content: 'Editado' });
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.updateAsync({ id: 'cr-1', input: { content: 'Editado' } });
    });

    expect(updateCannedResponse).toHaveBeenCalledWith('cr-1', { content: 'Editado' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cannedResponsesKey });
  });

  it('mapea 409 SHORTCUT_TAKEN a serverError al editar', async () => {
    vi.mocked(updateCannedResponse).mockRejectedValue(
      makeAxiosError(409, { error: 'ya existe', code: 'SHORTCUT_TAKEN' }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.updateAsync({ id: 'cr-1', input: { shortcut: 'dup' } }).catch(() => {});
    });

    await waitFor(() => expect(result.current.serverError).toMatch(/atajo ya está en uso/i));
  });
});

describe('CRH-4: useDeleteCannedResponse', () => {
  it('borra (id) e invalida la lista al resolver', async () => {
    vi.mocked(deleteCannedResponse).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteCannedResponse(), { wrapper });

    await act(async () => {
      await result.current.removeAsync('cr-1');
    });

    expect(deleteCannedResponse).toHaveBeenCalledWith('cr-1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: cannedResponsesKey });
  });
});
