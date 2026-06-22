/**
 * serviceInventory.api — retireInstalledItem (POST .../retire)
 *
 * Covers:
 * 1. POSTs the retire endpoint with the right URL + body for each disposition
 * 2. technicianId flows through only when present
 * 3. note flows through only when present
 * 4. returns the removed item from the 200 body
 * 5. on a 409 ASSET_NOT_INSTALLED → throws AssetNotInstalledError
 * 6. other errors propagate unchanged
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';

vi.mock('@/api/axios-client', () => ({
  default: { post: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import {
  retireInstalledItem,
  AssetNotInstalledError,
} from '@/api/serviceInventory.api';

const removedItem: ServiceInstalledItem = {
  id: 'item-1',
  serviceId: 'ctr-1',
  type: 'ANTENA',
  serialNumber: 'SN-001',
  mac: null,
  model: null,
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'removed',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retireInstalledItem', () => {
  it('POSTs /contracts/:c/inventory/:i/retire with the disposition', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: removedItem });

    const result = await retireInstalledItem('ctr-1', 'item-1', { disposition: 'DEPOSITO' });

    expect(axiosClient.post).toHaveBeenCalledWith(
      '/contracts/ctr-1/inventory/item-1/retire',
      { disposition: 'DEPOSITO' },
    );
    expect(result).toEqual(removedItem);
  });

  it('sends technicianId when disposition is TECNICO', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: removedItem });

    await retireInstalledItem('ctr-1', 'item-1', { disposition: 'TECNICO', technicianId: 'tech-9' });

    expect(axiosClient.post).toHaveBeenCalledWith(
      '/contracts/ctr-1/inventory/item-1/retire',
      { disposition: 'TECNICO', technicianId: 'tech-9' },
    );
  });

  it('sends the optional note when provided', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: removedItem });

    await retireInstalledItem('ctr-1', 'item-1', { disposition: 'CLIENTE', note: 'se lo deja el cliente' });

    expect(axiosClient.post).toHaveBeenCalledWith(
      '/contracts/ctr-1/inventory/item-1/retire',
      { disposition: 'CLIENTE', note: 'se lo deja el cliente' },
    );
  });

  it('returns the removed item from the response body', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: removedItem });

    const result = await retireInstalledItem('ctr-1', 'item-1', { disposition: 'RETIRED' });

    expect(result.id).toBe('item-1');
    expect(result.status).toBe('removed');
  });

  it('throws AssetNotInstalledError on a 409 ASSET_NOT_INSTALLED', async () => {
    vi.mocked(axiosClient.post).mockRejectedValue({
      response: { status: 409, data: { code: 'ASSET_NOT_INSTALLED' } },
    });

    await expect(
      retireInstalledItem('ctr-1', 'item-1', { disposition: 'DEPOSITO' }),
    ).rejects.toBeInstanceOf(AssetNotInstalledError);
  });

  it('also recognizes ASSET_NOT_INSTALLED when the BE puts the code in `error`', async () => {
    vi.mocked(axiosClient.post).mockRejectedValue({
      response: { status: 409, data: { error: 'ASSET_NOT_INSTALLED' } },
    });

    await expect(
      retireInstalledItem('ctr-1', 'item-1', { disposition: 'DEPOSITO' }),
    ).rejects.toBeInstanceOf(AssetNotInstalledError);
  });

  it('propagates non-409 errors unchanged', async () => {
    const boom = new Error('500 boom');
    vi.mocked(axiosClient.post).mockRejectedValue(boom);

    await expect(
      retireInstalledItem('ctr-1', 'item-1', { disposition: 'DEPOSITO' }),
    ).rejects.toBe(boom);
  });

  it('does NOT treat a non-matching 409 as AssetNotInstalledError', async () => {
    const other = { response: { status: 409, data: { code: 'SOMETHING_ELSE' } } };
    vi.mocked(axiosClient.post).mockRejectedValue(other);

    await expect(
      retireInstalledItem('ctr-1', 'item-1', { disposition: 'DEPOSITO' }),
    ).rejects.toBe(other);
  });
});
