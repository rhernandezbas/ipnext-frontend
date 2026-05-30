import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the api module the hooks depend on.
vi.mock('@/api/gestionRealSync.api', () => ({
  getSyncConfig: vi.fn(),
  updateSyncConfig: vi.fn(),
}));

import { getSyncConfig, updateSyncConfig } from '@/api/gestionRealSync.api';
import { useSyncConfig, useUpdateSyncConfig } from '@/hooks/useGestionRealSyncConfig';

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
});

describe('useSyncConfig', () => {
  it('uses query key ["gestionRealSync","config"] and resolves the config', async () => {
    const config = { intervalMs: 300000, estados: ['1', '3'] };
    vi.mocked(getSyncConfig).mockResolvedValue(config);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useSyncConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(config);
    expect(qc.getQueryData(['gestionRealSync', 'config'])).toEqual(config);
  });
});

describe('useUpdateSyncConfig', () => {
  it('invalidates the config key and the sync-status key on success', async () => {
    const config = { intervalMs: 900000, estados: ['2'] };
    vi.mocked(updateSyncConfig).mockResolvedValue(config);
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateSyncConfig(), { wrapper });

    result.current.mutate({ intervalMs: 900000, estados: ['2'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateSyncConfig).toHaveBeenCalledWith({ intervalMs: 900000, estados: ['2'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gestionRealSync', 'config'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gestion-real-sync-status'] });
  });
});
