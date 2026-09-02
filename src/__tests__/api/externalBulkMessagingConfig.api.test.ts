import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ExternalBulkMessagingConfig } from '@/types/externalBulkMessaging';

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
import {
  getExternalBulkMessagingConfig,
  updateExternalBulkMessagingConfig,
} from '@/api/externalBulkMessagingConfig.api';

const mockConfig: ExternalBulkMessagingConfig = {
  maxPerRequest: 500,
  maxPerDay: 2000,
  updatedAt: '2026-09-01T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getExternalBulkMessagingConfig', () => {
  it('GETs /messaging/config/external-bulk and returns the FLAT envelope (no {data})', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });

    const result = await getExternalBulkMessagingConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/config/external-bulk');
    expect(result).toEqual(mockConfig);
  });
});

describe('updateExternalBulkMessagingConfig', () => {
  it('PUTs /messaging/config/external-bulk with the exact body and returns the FLAT envelope', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockConfig });

    const body = { maxPerRequest: 300, maxPerDay: 1000 };
    const result = await updateExternalBulkMessagingConfig(body);

    expect(axiosClient.put).toHaveBeenCalledWith('/messaging/config/external-bulk', body);
    expect(result).toEqual(mockConfig);
  });
});
