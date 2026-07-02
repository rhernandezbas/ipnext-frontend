import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  usePreviewEnforcement,
  useStartBulkEnforcement,
  useBulkEnforcementStatus,
  useEnforcePppoe,
} from '../usePppoe';
import type { EnforcementPreview, ServiceCutBatch, PppoeServiceDto } from '@/types/pppoe';

vi.mock('@/api/pppoe.api', () => ({
  pppoeApi: {
    preview: vi.fn(),
    startBulk: vi.fn(),
    getBatch: vi.fn(),
    enforce: vi.fn(),
  },
}));

import { pppoeApi } from '@/api/pppoe.api';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PREVIEW: EnforcementPreview = {
  total: 3,
  byRouter: { '1': 2, '2': 1 },
  sample: [{ id: 'a', username: 'd1', nasId: '1', contractId: 'c1', enforcedState: 'active' }],
};

const BATCH_DONE: ServiceCutBatch = {
  id: 'job-1',
  action: 'reduce',
  status: 'done',
  total: 3,
  doneCount: 3,
  failedCount: 0,
  items: [{ pppoeId: 'a', ok: true }],
  createdAt: '2026-06-17T00:00:00.000Z',
  finishedAt: '2026-06-17T00:01:00.000Z',
};

beforeEach(() => vi.clearAllMocks());

describe('usePreviewEnforcement', () => {
  it('devuelve el preview (total/byRouter/sample) sin tocar nada', async () => {
    vi.mocked(pppoeApi.preview).mockResolvedValue(PREVIEW);
    const { result } = renderHook(() => usePreviewEnforcement(), { wrapper });

    await act(async () => {
      const out = await result.current.mutateAsync({ action: 'reduce', target: 'debtors' });
      expect(out).toEqual(PREVIEW);
    });
    expect(pppoeApi.preview).toHaveBeenCalledWith({ action: 'reduce', target: 'debtors' });
  });
});

describe('useStartBulkEnforcement', () => {
  it('dispara el batch y devuelve 202 + { jobId, total }', async () => {
    vi.mocked(pppoeApi.startBulk).mockResolvedValue({ status: 202, data: { jobId: 'job-1', total: 3 } });
    const { result } = renderHook(() => useStartBulkEnforcement(), { wrapper });

    await act(async () => {
      const out = await result.current.mutateAsync({ action: 'reduce', target: 'debtors' });
      expect(out.status).toBe(202);
      expect(out.data.jobId).toBe('job-1');
    });
  });

  it('propaga el 409 (corte ya en curso) como error', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } });
    vi.mocked(pppoeApi.startBulk).mockRejectedValue(err);
    const { result } = renderHook(() => useStartBulkEnforcement(), { wrapper });

    await expect(
      result.current.mutateAsync({ action: 'reduce', target: 'debtors' }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('useBulkEnforcementStatus', () => {
  it('poolea y devuelve el estado del batch cuando hay jobId + enabled', async () => {
    vi.mocked(pppoeApi.getBatch).mockResolvedValue(BATCH_DONE);
    const { result } = renderHook(() => useBulkEnforcementStatus('job-1', true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(BATCH_DONE);
    expect(pppoeApi.getBatch).toHaveBeenCalledWith('job-1');
  });

  it('NO consulta sin jobId (disabled)', async () => {
    const { result } = renderHook(() => useBulkEnforcementStatus(null, true), { wrapper });
    // la query queda deshabilitada → nunca fetchea
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe('idle');
    expect(pppoeApi.getBatch).not.toHaveBeenCalled();
  });
});

describe('useEnforcePppoe', () => {
  it('corta un PPPoE individual y devuelve el DTO con enforcedState', async () => {
    const dto: PppoeServiceDto = {
      id: 'a', username: 'd1', profile: 'IP-Air', remoteAddress: null,
      status: 'enabled', enforcedState: 'reduced', nasId: '1', contractId: 'c1',
      createdAt: '2026-06-17T00:00:00.000Z', ipMode: 'pool', ipTypePreference: 'cgnat',
    };
    vi.mocked(pppoeApi.enforce).mockResolvedValue(dto);
    const { result } = renderHook(() => useEnforcePppoe(), { wrapper });

    await act(async () => {
      const out = await result.current.mutateAsync({ id: 'a', action: 'reduce' });
      expect(out.enforcedState).toBe('reduced');
    });
    expect(pppoeApi.enforce).toHaveBeenCalledWith('a', 'reduce');
  });
});
