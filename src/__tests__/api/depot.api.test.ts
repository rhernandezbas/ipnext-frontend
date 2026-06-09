import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DepotStockDTO } from '@/types/depot';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { getDepotStock } from '@/api/depot.api';

const populated: DepotStockDTO = {
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
    {
      id: 'm1',
      materialCatalogId: 'mc1',
      name: 'cable-utp',
      label: 'Cable UTP',
      unit: 'm',
      qty: 120,
    },
  ],
  depotLocationId: 'loc-depot',
};

const empty: DepotStockDTO = { assets: [], materials: [], depotLocationId: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDepotStock', () => {
  it('GETs /inventory/depot and returns the enriched stock payload', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: populated });

    const result = await getDepotStock();

    expect(axiosClient.get).toHaveBeenCalledWith('/inventory/depot');
    expect(result).toEqual(populated);
    expect(result.assets[0].deviceTypeLabel).toBe('ONT');
    expect(result.materials[0].qty).toBe(120);
  });

  it('returns the empty depot shape (no assets/materials, null location) when the depot is empty', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: empty });

    const result = await getDepotStock();

    expect(result.assets).toEqual([]);
    expect(result.materials).toEqual([]);
    expect(result.depotLocationId).toBeNull();
  });
});
