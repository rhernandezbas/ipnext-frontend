import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NocBroadcastConfigDTO } from '@/types/nocBroadcast';

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
  getNocBroadcastConfig,
  updateNocBroadcastConfig,
  testNocBroadcast,
} from '@/api/nocBroadcast.api';

const mockConfig: NocBroadcastConfigDTO = {
  enabled: true,
  evolutionBaseUrl: 'http://192.168.1.50:8080',
  evolutionInstance: 'ronald noc',
  targetChat: '12036@g.us',
  appPublicUrl: 'http://190.7.234.37:7778',
  hasApiKey: true,
  apiKeyLast4: 'cd12',
  configured: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNocBroadcastConfig', () => {
  it('GETs /messaging/noc-broadcast/config and returns the masked DTO', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });

    const result = await getNocBroadcastConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/noc-broadcast/config');
    expect(result).toEqual(mockConfig);
  });
});

describe('updateNocBroadcastConfig', () => {
  it('PUTs /messaging/noc-broadcast/config with the exact partial body and returns the DTO', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockConfig });

    const body = { targetChat: '99999@g.us', evolutionApiKey: 'new-secret' };
    const result = await updateNocBroadcastConfig(body);

    expect(axiosClient.put).toHaveBeenCalledWith('/messaging/noc-broadcast/config', body);
    expect(result).toEqual(mockConfig);
  });
});

describe('testNocBroadcast', () => {
  it('POSTs /messaging/noc-broadcast/test and returns the { ok } result', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { ok: true } });

    const result = await testNocBroadcast();

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/noc-broadcast/test');
    expect(result).toEqual({ ok: true });
  });
});
