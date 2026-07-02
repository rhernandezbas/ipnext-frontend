/**
 * Tests — pppoe-move-nas Wave 1 FE: wire contract del api client (campo por campo).
 *
 * POST /pppoe/:id/move        body { nasId, force? }  (force SOLO cuando es true)
 * GET  /pppoe/nas-move-events params page/limit/outcome/trigger/username
 *      (los filtros vacíos se omiten del query string)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PaginatedPppoeNasMoveEvents } from '@/types/pppoeNasMove';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { pppoeApi } from '@/api/pppoe.api';

const PAGE: PaginatedPppoeNasMoveEvents = {
  items: [
    {
      id: 'mv-1',
      username: 'cliente01',
      fromNas: { id: 'nas-1', name: 'NAS Central' },
      toNas: { id: 'nas-2', name: 'NAS Norte' },
      fromIp: '100.64.60.25',
      toIp: '100.64.43.7',
      trigger: 'manual',
      outcome: 'moved',
      reason: null,
      actorName: 'operador1',
      createdAt: '2026-07-01T15:30:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
};

describe('pppoeApi.move — wire contract del force', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTea { nasId } SIN la clave force en el primer intento', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: {} });
    await pppoeApi.move('pppoe-1', 'nas-2');
    expect(axiosClient.post).toHaveBeenCalledWith('/pppoe/pppoe-1/move', { nasId: 'nas-2' });
  });

  it('POSTea { nasId, force: true } en el reintento forzado', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: {} });
    await pppoeApi.move('pppoe-1', 'nas-2', true);
    expect(axiosClient.post).toHaveBeenCalledWith('/pppoe/pppoe-1/move', { nasId: 'nas-2', force: true });
  });
});

describe('pppoeApi.listNasMoveEvents — wire contract del listado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETea /pppoe/nas-move-events con todos los filtros', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGE });
    const result = await pppoeApi.listNasMoveEvents({
      page: 2,
      limit: 50,
      outcome: 'failed_no_free_ip',
      trigger: 'auto',
      username: 'juan',
    });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/nas-move-events', {
      params: { page: 2, limit: 50, outcome: 'failed_no_free_ip', trigger: 'auto', username: 'juan' },
    });
    expect(result).toEqual(PAGE);
  });

  it('omite los filtros vacíos del query string', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: PAGE });
    await pppoeApi.listNasMoveEvents({ page: 1, limit: 50, username: '   ' });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/nas-move-events', {
      params: { page: 1, limit: 50 },
    });
  });
});
