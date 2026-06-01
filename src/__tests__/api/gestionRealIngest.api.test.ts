import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  IngestConfigDTO,
  IngestStatusDTO,
  NeedsReviewTaskDTO,
} from '@/types/gestionRealIngest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { gestionRealIngestApi } from '@/api/gestionRealIngest.api';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gestionRealIngestApi.getConfig', () => {
  it('GETs /gestion-real-ingest/config and returns the config', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });

    const result = await gestionRealIngestApi.getConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/gestion-real-ingest/config');
    expect(result).toEqual(mockConfig);
  });
});

describe('gestionRealIngestApi.updateConfig', () => {
  it('PUTs /gestion-real-ingest/config with the partial body and returns the config', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockConfig });

    const body = { intervalMs: 300000, windowMonths: 6 };
    const result = await gestionRealIngestApi.updateConfig(body);

    expect(axiosClient.put).toHaveBeenCalledWith('/gestion-real-ingest/config', body);
    expect(result).toEqual(mockConfig);
  });
});

describe('gestionRealIngestApi.getStatus', () => {
  it('GETs /gestion-real-ingest/status and returns the status', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockStatus });

    const result = await gestionRealIngestApi.getStatus();

    expect(axiosClient.get).toHaveBeenCalledWith('/gestion-real-ingest/status');
    expect(result).toEqual(mockStatus);
  });
});

describe('gestionRealIngestApi.getNeedsReview', () => {
  it('GETs /gestion-real-ingest/needs-review and returns the task array', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockNeedsReview });

    const result = await gestionRealIngestApi.getNeedsReview();

    expect(axiosClient.get).toHaveBeenCalledWith('/gestion-real-ingest/needs-review');
    expect(result).toEqual(mockNeedsReview);
  });
});
