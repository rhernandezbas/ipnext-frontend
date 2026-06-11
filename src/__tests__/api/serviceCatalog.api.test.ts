import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { serviceCatalogApi } from '@/api/service-catalog.api';
import type { ServiceCatalogEntry } from '@/types/customer';

const entry: ServiceCatalogEntry = {
  id: 'sc-1',
  name: 'INTERNET',
  label: 'Internet',
  active: true,
  sortOrder: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('serviceCatalogApi (#43)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('list() GETs /service-catalog without params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [entry] });
    const result = await serviceCatalogApi.list();
    expect(axiosClient.get).toHaveBeenCalledWith('/service-catalog', { params: {} });
    expect(result).toEqual([entry]);
  });

  it('list(true) GETs /service-catalog?active=true', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [entry] });
    await serviceCatalogApi.list(true);
    expect(axiosClient.get).toHaveBeenCalledWith('/service-catalog', { params: { active: true } });
  });

  it('create() POSTs to /service-catalog with the payload', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: entry });
    const payload = { name: 'TV', label: 'Televisión', sortOrder: 2 };
    const result = await serviceCatalogApi.create(payload);
    expect(axiosClient.post).toHaveBeenCalledWith('/service-catalog', payload);
    expect(result).toEqual(entry);
  });

  it('patch() uses PATCH (NOT put) on /service-catalog/:id', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: entry });
    await serviceCatalogApi.patch('sc-1', { name: 'INTERNET 2' });
    expect(axiosClient.patch).toHaveBeenCalledWith('/service-catalog/sc-1', { name: 'INTERNET 2' });
    expect(axiosClient.put).not.toHaveBeenCalled();
  });

  it('remove() DELETEs /service-catalog/:id', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });
    await serviceCatalogApi.remove('sc-1');
    expect(axiosClient.delete).toHaveBeenCalledWith('/service-catalog/sc-1');
  });
});
