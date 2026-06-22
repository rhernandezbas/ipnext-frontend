/**
 * addInstalledItem — dedup-aware contract (TDD)
 *
 * The BE POST /contracts/:id/inventory now distinguishes:
 *  - 201 → a NEW item was created            → outcome 'created'
 *  - 200 → an EXISTING item was enriched      → outcome 'enriched'
 *  - 409 { code: 'SAME_TYPE_NEEDS_DECISION', candidates } → InventoryConflictError
 *  - 409 { code: 'ASSET_NOT_REVIVABLE' }                  → InventoryConflictError
 *
 * The api client must thread the status code through (201 vs 200) and normalize
 * the 409 body into a typed InventoryConflictError so the UI can branch on it.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';

vi.mock('@/api/axios-client', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { addInstalledItem, InventoryConflictError } from '@/api/serviceInventory.api';

const baseItem: ServiceInstalledItem = {
  id: 'item-1',
  serviceId: 'ctr-1',
  type: 'ANTENA',
  serialNumber: null,
  mac: 'AA:BB:CC:DD:EE:01',
  model: 'Mimosa C5x',
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: null,
  confirmedAt: null,
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => vi.clearAllMocks());

describe('addInstalledItem', () => {
  it('POSTs to /contracts/:id/inventory with the input body', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 201, data: baseItem });
    await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa C5x' });
    expect(axiosClient.post).toHaveBeenCalledWith('/contracts/ctr-1/inventory', {
      type: 'ANTENA',
      mac: 'AA:BB:CC:DD:EE:01',
      model: 'Mimosa C5x',
    });
  });

  it('201 → outcome "created" with the item', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 201, data: baseItem });
    const res = await addInstalledItem('ctr-1', { type: 'ANTENA' });
    expect(res.outcome).toBe('created');
    expect(res.item).toEqual(baseItem);
  });

  it('200 → outcome "enriched" with the existing item', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 200, data: baseItem });
    const res = await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01' });
    expect(res.outcome).toBe('enriched');
    expect(res.item).toEqual(baseItem);
  });

  it('threads completeItemId and force in the body', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ status: 200, data: baseItem });
    await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'X', completeItemId: 'ant-9' });
    expect(axiosClient.post).toHaveBeenCalledWith('/contracts/ctr-1/inventory', {
      type: 'ANTENA',
      mac: 'X',
      completeItemId: 'ant-9',
    });

    vi.mocked(axiosClient.post).mockResolvedValue({ status: 201, data: baseItem });
    await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'X', force: true });
    expect(axiosClient.post).toHaveBeenLastCalledWith('/contracts/ctr-1/inventory', {
      type: 'ANTENA',
      mac: 'X',
      force: true,
    });
  });

  it('409 SAME_TYPE_NEEDS_DECISION → throws InventoryConflictError with candidates', async () => {
    const candidates = [
      { id: 'ant', type: 'ANTENA', serialNumber: 'SN-001', mac: null, model: null },
    ];
    vi.mocked(axiosClient.post).mockRejectedValue({
      response: {
        status: 409,
        data: { error: 'human msg', code: 'SAME_TYPE_NEEDS_DECISION', candidates },
      },
    });

    await expect(addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'X' })).rejects.toBeInstanceOf(
      InventoryConflictError,
    );

    try {
      await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'X' });
    } catch (e) {
      const conflict = (e as InventoryConflictError).conflict;
      expect(conflict.code).toBe('SAME_TYPE_NEEDS_DECISION');
      expect(conflict.candidates).toEqual(candidates);
      expect(conflict.message).toBe('human msg');
    }
  });

  it('409 ASSET_NOT_REVIVABLE → throws InventoryConflictError, no candidates', async () => {
    vi.mocked(axiosClient.post).mockRejectedValue({
      response: {
        status: 409,
        data: { error: 'el equipo figura dado de baja', code: 'ASSET_NOT_REVIVABLE' },
      },
    });

    try {
      await addInstalledItem('ctr-1', { type: 'ANTENA', mac: 'X' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InventoryConflictError);
      const conflict = (e as InventoryConflictError).conflict;
      expect(conflict.code).toBe('ASSET_NOT_REVIVABLE');
      expect(conflict.candidates).toEqual([]);
      expect(conflict.message).toBe('el equipo figura dado de baja');
    }
  });

  it('a non-409 error is re-thrown as-is (not wrapped)', async () => {
    const networkErr = { response: { status: 500, data: { error: 'boom' } } };
    vi.mocked(axiosClient.post).mockRejectedValue(networkErr);
    await expect(addInstalledItem('ctr-1', { type: 'ANTENA' })).rejects.toBe(networkErr);
  });

  it('a 409 WITHOUT a known code is re-thrown as-is (defensive)', async () => {
    const weird = { response: { status: 409, data: { error: 'some other conflict' } } };
    vi.mocked(axiosClient.post).mockRejectedValue(weird);
    await expect(addInstalledItem('ctr-1', { type: 'ANTENA' })).rejects.toBe(weird);
  });
});
