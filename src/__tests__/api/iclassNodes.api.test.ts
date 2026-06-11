import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { getIClassNodes, syncIClassNodes } from '@/api/iclassNodes.api';
import type { IClassNode } from '@/types/iclassNode';

const node: IClassNode = {
  id: 'n1',
  nodeId: 35270699,
  code: 'Mercedes',
  description: 'Mercedes',
  active: true,
  selectable: true,
  lastSyncedAt: '2026-06-01T12:00:00.000Z',
};

describe('iclassNodes.api (#45)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getIClassNodes() unwraps { items } and GETs /admin/iclass/nodes without params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { items: [node] } });
    const result = await getIClassNodes();
    expect(axiosClient.get).toHaveBeenCalledWith('/admin/iclass/nodes', { params: undefined });
    expect(result).toEqual([node]);
  });

  it('getIClassNodes({active,selectable}) serializes filters as string query params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { items: [] } });
    await getIClassNodes({ active: true, selectable: true });
    expect(axiosClient.get).toHaveBeenCalledWith('/admin/iclass/nodes', {
      params: { active: 'true', selectable: 'true' },
    });
  });

  it('syncIClassNodes() POSTs to /admin/iclass/nodes/sync and returns the counts', async () => {
    const counts = { synced: 36, created: 36, updated: 0, reactivated: 0, deactivated: 0 };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: counts });
    const result = await syncIClassNodes();
    expect(axiosClient.post).toHaveBeenCalledWith('/admin/iclass/nodes/sync');
    expect(result).toEqual(counts);
  });
});
