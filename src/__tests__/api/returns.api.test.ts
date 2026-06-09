import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReturnSuggestion } from '@/types/returns';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { getPendingReturns, confirmReturn, discardReturn } from '@/api/returns.api';

const pending: ReturnSuggestion[] = [
  {
    id: 'r1',
    serviceOrderId: 'so-1',
    taskId: 't1',
    serialNumber: 'SN-AAA-001',
    mac: 'AA:BB:CC:DD:EE:FF',
    deviceType: 'ont',
    matchedAssetId: 'asset-1',
    status: 'pending',
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'r2',
    serviceOrderId: 'so-2',
    serialNumber: 'SN-ZZZ-999',
    matchedAssetId: null,
    status: 'needs_review',
    createdAt: '2026-06-02T10:00:00.000Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPendingReturns', () => {
  it('GETs /inventory/returns/pending and returns the suggestion list', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: pending });

    const result = await getPendingReturns();

    expect(axiosClient.get).toHaveBeenCalledWith('/inventory/returns/pending');
    expect(result).toEqual(pending);
    expect(result[0].matchedAssetId).toBe('asset-1');
    expect(result[1].status).toBe('needs_review');
  });

  it('tolerates an empty list (the production default)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [] });
    const result = await getPendingReturns();
    expect(result).toEqual([]);
  });
});

describe('confirmReturn', () => {
  it('POSTs /inventory/returns/:id/confirm with the resolution body', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    await confirmReturn('r1', { resolution: 'return' });

    expect(axiosClient.post).toHaveBeenCalledWith('/inventory/returns/r1/confirm', {
      resolution: 'return',
    });
  });

  it('includes linkedAssetId for a link resolution', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    await confirmReturn('r2', { resolution: 'link', linkedAssetId: 'asset-9' });

    expect(axiosClient.post).toHaveBeenCalledWith('/inventory/returns/r2/confirm', {
      resolution: 'link',
      linkedAssetId: 'asset-9',
    });
  });
});

describe('discardReturn', () => {
  it('POSTs /inventory/returns/:id/discard', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    await discardReturn('r2');

    expect(axiosClient.post).toHaveBeenCalledWith('/inventory/returns/r2/discard');
  });
});
