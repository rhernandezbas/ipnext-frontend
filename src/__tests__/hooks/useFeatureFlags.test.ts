import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/featureFlags.api', () => ({
  featureFlagsApi: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { featureFlagsApi } from '@/api/featureFlags.api';
import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';

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

describe('useFeatureFlag', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls api.get with the provided key and returns data on 200', async () => {
    vi.mocked(featureFlagsApi.get).mockResolvedValue({
      key: 'iclass-integration',
      enabled: true,
    });

    const { result } = renderHook(() => useFeatureFlag('iclass-integration'), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(featureFlagsApi.get).toHaveBeenCalledWith('iclass-integration');
    expect(result.current.data).toEqual({ key: 'iclass-integration', enabled: true });
  });

  it('returns { enabled: false } when the flag does not exist (404), without error', async () => {
    const err = Object.assign(new Error('Not found'), {
      response: { status: 404 },
    });
    vi.mocked(featureFlagsApi.get).mockRejectedValue(err);

    const { result } = renderHook(() => useFeatureFlag('missing-flag'), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual({ key: 'missing-flag', enabled: false });
  });

  it('propagates non-404 errors as isError', async () => {
    const err = Object.assign(new Error('Server error'), {
      response: { status: 500 },
    });
    vi.mocked(featureFlagsApi.get).mockRejectedValue(err);

    const { result } = renderHook(() => useFeatureFlag('any-flag'), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetFeatureFlag', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls api.set with key and enabled boolean', async () => {
    vi.mocked(featureFlagsApi.set).mockResolvedValue({
      key: 'iclass-integration',
      enabled: true,
    });

    const { result } = renderHook(() => useSetFeatureFlag(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ key: 'iclass-integration', enabled: true });
    });

    expect(featureFlagsApi.set).toHaveBeenCalledWith('iclass-integration', true);
  });

  it('invalidates the featureFlags query for the key on success', async () => {
    vi.mocked(featureFlagsApi.set).mockResolvedValue({
      key: 'iclass-integration',
      enabled: false,
    });

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetFeatureFlag(), {
      wrapper: createWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({ key: 'iclass-integration', enabled: false });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['featureFlags', 'iclass-integration'],
    });
  });
});
