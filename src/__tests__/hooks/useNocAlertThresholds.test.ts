import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/nocAlertThresholds.api', () => ({
  getNocAlertThresholds: vi.fn(),
  updateNocAlertThresholds: vi.fn(),
}));

import { getNocAlertThresholds, updateNocAlertThresholds } from '@/api/nocAlertThresholds.api';
import {
  useNocAlertThresholds,
  useUpdateNocAlertThresholds,
  NOC_ALERT_THRESHOLDS_QUERY_KEY,
} from '@/hooks/useNocAlertThresholds';

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

const mockConfig = { critDbm: -30, warnDbm: -27, deltaAlert: 2, ponMinAbon: 2, ponDelta: 1.5 };

describe('useNocAlertThresholds', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls the GET api and returns the thresholds', async () => {
    vi.mocked(getNocAlertThresholds).mockResolvedValue(mockConfig);

    const { result } = renderHook(() => useNocAlertThresholds(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getNocAlertThresholds).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockConfig);
  });
});

describe('useUpdateNocAlertThresholds', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('calls the PUT api with the full payload', async () => {
    const updated = { ...mockConfig, warnDbm: -26 };
    vi.mocked(updateNocAlertThresholds).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateNocAlertThresholds(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ ...mockConfig, warnDbm: -26 });
    });

    expect(updateNocAlertThresholds).toHaveBeenCalledWith({ ...mockConfig, warnDbm: -26 });
  });

  it('invalidates the thresholds query on success', async () => {
    vi.mocked(updateNocAlertThresholds).mockResolvedValue(mockConfig);
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateNocAlertThresholds(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync(mockConfig);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOC_ALERT_THRESHOLDS_QUERY_KEY });
  });
});
