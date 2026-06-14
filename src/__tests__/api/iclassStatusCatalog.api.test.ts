import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { iclassStatusCatalogApi } from '@/api/iclassStatusCatalog.api';
import type { IClassStatusCatalogEntry, IClassStatusCatalogSyncResult } from '@/types/iclassStatusCatalog';

const entry: IClassStatusCatalogEntry = {
  statusCode: 'INSTALADO',
  iclassLabel: 'Instalado',
  displayLabel: 'Instalación OK',
  effectiveLabel: 'Instalación OK',
  color: '#22c55e',
  tracked: true,
  lastSyncedAt: '2026-06-01T00:00:00Z',
};

describe('iclassStatusCatalogApi — URL fixture (FIX 1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() GETs /admin/iclass/statuses and unwraps items', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { items: [entry] } });
    const result = await iclassStatusCatalogApi.list();
    expect(axiosClient.get).toHaveBeenCalledWith('/admin/iclass/statuses');
    expect(result).toEqual([entry]);
  });

  it('sync() POSTs to /admin/iclass/statuses/sync and returns sync result', async () => {
    const syncResult: IClassStatusCatalogSyncResult = { synced: 3, created: 1, updated: 2 };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: syncResult });
    const result = await iclassStatusCatalogApi.sync();
    expect(axiosClient.post).toHaveBeenCalledWith('/admin/iclass/statuses/sync');
    expect(result).toEqual(syncResult);
  });

  it('update() PATCHes /admin/iclass/statuses/:statusCode with the payload', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: entry });
    const payload = { color: '#ff0000' };
    const result = await iclassStatusCatalogApi.update('INSTALADO', payload);
    expect(axiosClient.patch).toHaveBeenCalledWith('/admin/iclass/statuses/INSTALADO', payload);
    expect(result).toEqual(entry);
  });

  it('list() would 404 with the old /iclass/status-catalog URL — this test pins the correct path', async () => {
    // Verify the URL does NOT use the broken old path
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { items: [] } });
    await iclassStatusCatalogApi.list();
    expect(axiosClient.get).not.toHaveBeenCalledWith('/iclass/status-catalog');
  });
});
