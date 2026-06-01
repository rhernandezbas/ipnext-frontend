import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// Mock the api module before importing hooks
vi.mock('@/api/gestionRealIngest.api', () => ({
  gestionRealIngestApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStatus: vi.fn(),
    getNeedsReview: vi.fn(),
  },
}));

import { gestionRealIngestApi } from '@/api/gestionRealIngest.api';
import {
  useGestionRealConfig,
  useUpdateGestionRealConfig,
  useGestionRealStatus,
  useGestionRealNeedsReview,
} from '@/hooks/useGestionRealIngest';
import type {
  IngestConfigDTO,
  IngestStatusDTO,
  NeedsReviewTaskDTO,
} from '@/types/gestionRealIngest';

const mockConfig: IngestConfigDTO = {
  intervalMs: 300000,
  windowMonths: 6,
  fiberProjectId: 'p-fiber',
  wirelessProjectId: null,
  sourceEstado: 'CONF',
};

const mockStatus: IngestStatusDTO = {
  lastRunAt: '2026-05-29T00:00:00Z',
  created: 10,
  skippedDuplicate: 2,
  skippedUnmirrored: 1,
  unclassified: 3,
};

const mockNeedsReview: NeedsReviewTaskDTO[] = [
  {
    id: 't1',
    title: 'Revisar orden',
    description: null,
    grOrdenId: 'gr-1',
    projectId: null,
    customerId: 'c1',
    serviceId: 's1',
    address: 'Calle 123',
    category: 'instalacion',
    priority: 'alta',
    stageId: 'stage-1',
    createdAt: '2026-05-29T00:00:00Z',
  },
];

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGestionRealConfig', () => {
  it('uses the config query key and returns the config', async () => {
    vi.mocked(gestionRealIngestApi.getConfig).mockResolvedValue(mockConfig);
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useGestionRealConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(gestionRealIngestApi.getConfig).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockConfig);
    expect(qc.getQueryData(['gestionRealIngest', 'config'])).toEqual(mockConfig);
  });
});

describe('useGestionRealStatus', () => {
  it('uses the status query key, returns status, and sets refetchInterval to 30000', async () => {
    vi.mocked(gestionRealIngestApi.getStatus).mockResolvedValue(mockStatus);
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useGestionRealStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStatus);
    expect(qc.getQueryData(['gestionRealIngest', 'status'])).toEqual(mockStatus);

    const query = qc
      .getQueryCache()
      .find({ queryKey: ['gestionRealIngest', 'status'] });
    expect(query?.options.refetchInterval).toBe(30000);
  });
});

describe('useGestionRealNeedsReview', () => {
  it('uses the needs-review query key and returns the task array', async () => {
    vi.mocked(gestionRealIngestApi.getNeedsReview).mockResolvedValue(mockNeedsReview);
    const { wrapper, qc } = createWrapper();

    const { result } = renderHook(() => useGestionRealNeedsReview(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockNeedsReview);
    expect(qc.getQueryData(['gestionRealIngest', 'needsReview'])).toEqual(mockNeedsReview);
  });
});

describe('useUpdateGestionRealConfig', () => {
  it('calls updateConfig with the body and invalidates config + status on success', async () => {
    vi.mocked(gestionRealIngestApi.updateConfig).mockResolvedValue(mockConfig);
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateGestionRealConfig(), { wrapper });

    const body = { intervalMs: 300000, windowMonths: 6 };
    await result.current.mutateAsync(body);

    expect(gestionRealIngestApi.updateConfig).toHaveBeenCalledWith(body);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['gestionRealIngest', 'config'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['gestionRealIngest', 'status'] }),
    );
  });
});
