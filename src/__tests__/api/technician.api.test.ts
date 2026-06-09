import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TechnicianStockDTO } from '@/types/technician';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { getTechnicianStock, issueStockToTechnician } from '@/api/technician.api';

const populated: TechnicianStockDTO = {
  assets: [
    {
      id: 'a1',
      serialNumber: 'SN-001',
      mac: 'AA:BB:CC:DD:EE:FF',
      deviceTypeId: 'dt1',
      deviceTypeName: 'ont',
      deviceTypeLabel: 'ONT',
      status: 'available',
      sourceTaskId: 't1',
    },
  ],
  materials: [
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable-utp', label: 'Cable UTP', unit: 'm', qty: 40 },
  ],
  locationId: 'loc-tecnico',
};

const empty: TechnicianStockDTO = { assets: [], materials: [], locationId: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTechnicianStock', () => {
  it('GETs /inventory/technicians/:id/stock and returns the enriched stock payload', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: populated });

    const result = await getTechnicianStock('tech-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/inventory/technicians/tech-1/stock');
    expect(result).toEqual(populated);
    expect(result.assets[0].serialNumber).toBe('SN-001');
    expect(result.materials[0].qty).toBe(40);
  });

  it('returns the empty technician shape (no assets/materials, null location) when empty', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: empty });

    const result = await getTechnicianStock('tech-1');

    expect(result.assets).toEqual([]);
    expect(result.materials).toEqual([]);
    expect(result.locationId).toBeNull();
  });
});

describe('issueStockToTechnician', () => {
  it('POSTs /inventory/technicians/:id/issue with the items payload', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: undefined });

    const items = [{ assetId: 'a1' }, { materialCatalogId: 'mc1', qty: 5 }];
    await issueStockToTechnician('tech-1', { items });

    expect(axiosClient.post).toHaveBeenCalledWith('/inventory/technicians/tech-1/issue', { items });
  });
});
