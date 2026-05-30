import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncConfigDTO } from '@/types/gestionRealSync';

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
import { getSyncConfig, updateSyncConfig, resyncAll } from '@/api/gestionRealSync.api';

const mockConfig: SyncConfigDTO = {
  intervalMs: 300000,
  estados: ['1', '3'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSyncConfig', () => {
  it('GETs /gestion-real/sync/config and returns the config', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });

    const result = await getSyncConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/gestion-real/sync/config');
    expect(result).toEqual(mockConfig);
  });
});

describe('updateSyncConfig', () => {
  it('PUTs /gestion-real/sync/config with the exact partial body and returns the data', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockConfig });

    const body = { intervalMs: 300000, estados: ['1', '2'] };
    const result = await updateSyncConfig(body);

    expect(axiosClient.put).toHaveBeenCalledWith('/gestion-real/sync/config', body);
    expect(result).toEqual(mockConfig);
  });
});

describe('resyncAll', () => {
  it('POSTs /gestion-real/sync/resync-all and returns the response data', async () => {
    const payload = { started: true };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: payload });

    const result = await resyncAll();

    expect(axiosClient.post).toHaveBeenCalledWith('/gestion-real/sync/resync-all');
    expect(result).toEqual(payload);
  });
});
