import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/externalBulkMessagingConfig.api', () => ({
  getExternalBulkMessagingConfig: vi.fn(),
  updateExternalBulkMessagingConfig: vi.fn(),
}));

import {
  getExternalBulkMessagingConfig,
  updateExternalBulkMessagingConfig,
} from '@/api/externalBulkMessagingConfig.api';
import {
  useExternalBulkMessagingConfig,
  useSetExternalBulkMessagingConfig,
  externalBulkMessagingConfigKey,
} from '@/hooks/useExternalBulkMessagingConfig';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('useExternalBulkMessagingConfig', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('returns the config unwrapped (no {data} envelope) on success', async () => {
    vi.mocked(getExternalBulkMessagingConfig).mockResolvedValue({
      maxPerRequest: 500,
      maxPerDay: 2000,
      updatedAt: '2026-09-01T12:00:00.000Z',
    });

    const { result } = renderHook(() => useExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      maxPerRequest: 500,
      maxPerDay: 2000,
      updatedAt: '2026-09-01T12:00:00.000Z',
    });
  });

  it('propagates fetch errors as isError', async () => {
    vi.mocked(getExternalBulkMessagingConfig).mockRejectedValue(
      Object.assign(new Error('boom'), { response: { status: 500 } }),
    );

    const { result } = renderHook(() => useExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('sets staleTime to 60_000, matching the useFeatureFlag convention', async () => {
    vi.mocked(getExternalBulkMessagingConfig).mockResolvedValue({
      maxPerRequest: 500,
      maxPerDay: 2000,
      updatedAt: '2026-09-01T12:00:00.000Z',
    });

    const { result } = renderHook(() => useExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = qc.getQueryCache().find({ queryKey: externalBulkMessagingConfigKey });
    const options = query?.options as { staleTime?: number } | undefined;
    expect(options?.staleTime).toBe(60_000);
  });
});

describe('useSetExternalBulkMessagingConfig', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls the api with the exact payload', async () => {
    vi.mocked(updateExternalBulkMessagingConfig).mockResolvedValue({
      maxPerRequest: 300,
      maxPerDay: 1000,
      updatedAt: '2026-09-01T12:05:00.000Z',
    });

    const { result } = renderHook(() => useSetExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ maxPerRequest: 300, maxPerDay: 1000 });
    });

    expect(updateExternalBulkMessagingConfig).toHaveBeenCalledWith({
      maxPerRequest: 300,
      maxPerDay: 1000,
    });
  });

  it('invalidates the config query on success', async () => {
    vi.mocked(updateExternalBulkMessagingConfig).mockResolvedValue({
      maxPerRequest: 300,
      maxPerDay: 1000,
      updatedAt: '2026-09-01T12:05:00.000Z',
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ maxPerRequest: 300, maxPerDay: 1000 });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: externalBulkMessagingConfigKey });
  });

  it('invalidates the config query even when the PUT fails (onSettled, not onSuccess)', async () => {
    vi.mocked(updateExternalBulkMessagingConfig).mockRejectedValue(
      Object.assign(new Error('bad request'), { response: { status: 400 } }),
    );
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ maxPerRequest: 3000, maxPerDay: 2000 }).catch(() => undefined);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: externalBulkMessagingConfigKey });
  });

  // ── Fix wave 2, item 1a: blind window after a successful save ─────────────
  // El PUT resuelve, pero `onSettled` solo INVALIDA — no escribe nada. Hasta
  // que el refetch dispara y vuelve, `getQueryData` sigue con el valor VIEJO.
  // El síntoma real (ExternalBulkMessagingCard) era: justo después de guardar,
  // `config` (la query) todavía no refleja lo guardado, así que `dirty` da
  // `true` un instante de más → banner "Topes guardados" no aparece y Guardar
  // sigue habilitado hasta que el refetch (asíncrono, no determinístico en
  // timing) actualiza la cache. `setQueryData` en `onSuccess` cierra esa
  // ventana: sincrónico con la resolución del PUT, sin esperar ningún refetch.
  it('writes the response into the cache synchronously on success (setQueryData in onSuccess, not just invalidate in onSettled)', async () => {
    vi.mocked(updateExternalBulkMessagingConfig).mockResolvedValue({
      maxPerRequest: 300,
      maxPerDay: 1000,
      updatedAt: '2026-09-01T12:05:00.000Z',
    });

    const { result } = renderHook(() => useSetExternalBulkMessagingConfig(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ maxPerRequest: 300, maxPerDay: 1000 });
    });

    // Se lee la cache DIRECTO, sin esperar ningún refetch/invalidate — si
    // esto solo funcionara por la invalidación de onSettled, dependería de
    // un refetch asíncrono adicional que este assert no espera.
    expect(qc.getQueryData(externalBulkMessagingConfigKey)).toEqual({
      maxPerRequest: 300,
      maxPerDay: 1000,
      updatedAt: '2026-09-01T12:05:00.000Z',
    });
  });
});
