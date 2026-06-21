import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { zonesApi } from '@/api/zones.api';
import type { Zone } from '@/api/zones.api';

const ZONE: Zone = {
  id: 'zone-1',
  name: 'Zona Norte',
  color: '#3b82f6',
  points: [
    { lat: -34.53, lng: -58.48 },
    { lat: -34.55, lng: -58.45 },
    { lat: -34.57, lng: -58.42 },
  ],
  description: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('zonesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('list()', () => {
    it('GETs /zones and returns the data array', async () => {
      vi.mocked(axiosClient.get).mockResolvedValue({ data: [ZONE] });
      const result = await zonesApi.list();
      expect(axiosClient.get).toHaveBeenCalledWith('/zones');
      expect(result).toEqual([ZONE]);
    });
  });

  describe('get()', () => {
    it('GETs /zones/:id and returns the zone', async () => {
      vi.mocked(axiosClient.get).mockResolvedValue({ data: ZONE });
      const result = await zonesApi.get('zone-1');
      expect(axiosClient.get).toHaveBeenCalledWith('/zones/zone-1');
      expect(result).toEqual(ZONE);
    });
  });

  describe('create()', () => {
    it('POSTs to /zones with name, color and points', async () => {
      vi.mocked(axiosClient.post).mockResolvedValue({ data: ZONE });
      const input = { name: 'Zona Norte', color: '#3b82f6', points: ZONE.points };
      const result = await zonesApi.create(input);
      expect(axiosClient.post).toHaveBeenCalledWith('/zones', input);
      expect(result).toEqual(ZONE);
    });

    it('includes optional description when provided', async () => {
      vi.mocked(axiosClient.post).mockResolvedValue({ data: { ...ZONE, description: 'Test' } });
      const input = { name: 'Zona Norte', color: '#3b82f6', points: ZONE.points, description: 'Test' };
      await zonesApi.create(input);
      expect(axiosClient.post).toHaveBeenCalledWith('/zones', input);
    });
  });

  describe('update()', () => {
    it('PUTs to /zones/:id with the patch payload', async () => {
      const updated = { ...ZONE, name: 'Zona Sur' };
      vi.mocked(axiosClient.put).mockResolvedValue({ data: updated });
      const result = await zonesApi.update('zone-1', { name: 'Zona Sur' });
      expect(axiosClient.put).toHaveBeenCalledWith('/zones/zone-1', { name: 'Zona Sur' });
      expect(result.name).toBe('Zona Sur');
    });
  });

  describe('remove()', () => {
    it('DELETEs /zones/:id and returns undefined', async () => {
      vi.mocked(axiosClient.delete).mockResolvedValue({ data: undefined });
      const result = await zonesApi.remove('zone-1');
      expect(axiosClient.delete).toHaveBeenCalledWith('/zones/zone-1');
      expect(result).toBeUndefined();
    });
  });
});
