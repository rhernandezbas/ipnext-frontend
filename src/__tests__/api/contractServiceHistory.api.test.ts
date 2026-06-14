import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosClient from '../../api/axios-client';
import { contractServicesApi } from '../../api/contract-services.api';
import type { ServiceHistoryEntry } from '../../types/customer';

vi.mock('../../api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockAxios = axiosClient as unknown as { get: ReturnType<typeof vi.fn> };

describe('contractServicesApi.getHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls GET /contracts/:id/service-history and returns data', async () => {
    const entries: ServiceHistoryEntry[] = [
      {
        id: '1',
        contractId: 'c1',
        serviceCatalogId: 's1',
        name: 'FIBER',
        label: 'Fibra Óptica',
        status: 'active',
        notes: null,
        tvLogin: null,
        createdAt: '2024-01-01T00:00:00Z',
        deactivatedAt: null,
        events: [],
      },
    ];
    mockAxios.get.mockResolvedValue({ data: entries });

    const result = await contractServicesApi.getHistory('c1');

    expect(mockAxios.get).toHaveBeenCalledWith('/contracts/c1/service-history');
    expect(result).toEqual(entries);
  });
});
