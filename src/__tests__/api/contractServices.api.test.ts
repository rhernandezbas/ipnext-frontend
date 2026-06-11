import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { contractServicesApi } from '@/api/contract-services.api';
import type { ContractService } from '@/types/customer';

const svc: ContractService = {
  id: 'cs-1',
  serviceCatalogId: 'sc-1',
  name: 'INTERNET',
  label: 'Internet',
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

describe('contractServicesApi (#43)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('add() POSTs to /contracts/:contractId/services with serviceCatalogId', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: svc });
    const result = await contractServicesApi.add('ctr-9', { serviceCatalogId: 'sc-1', notes: 'hola' });
    expect(axiosClient.post).toHaveBeenCalledWith('/contracts/ctr-9/services', { serviceCatalogId: 'sc-1', notes: 'hola' });
    expect(result).toEqual(svc);
  });

  it('update() PATCHes /contracts/:contractId/services/:id', async () => {
    vi.mocked(axiosClient.patch).mockResolvedValue({ data: { ...svc, status: 'inactive' } });
    const result = await contractServicesApi.update('ctr-9', 'cs-1', { status: 'inactive' });
    expect(axiosClient.patch).toHaveBeenCalledWith('/contracts/ctr-9/services/cs-1', { status: 'inactive' });
    expect(result.status).toBe('inactive');
  });

  it('remove() DELETEs /contracts/:contractId/services/:id', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });
    await contractServicesApi.remove('ctr-9', 'cs-1');
    expect(axiosClient.delete).toHaveBeenCalledWith('/contracts/ctr-9/services/cs-1');
  });
});
