import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PppoeServiceListResult, InternetServiceEvent } from '@/types/internetService';

// Mock axiosClient before importing the api module.
vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { pppoeApi } from '@/api/pppoe.api';

const listResult: PppoeServiceListResult = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
};

const events: InternetServiceEvent[] = [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pppoeApi.list', () => {
  it('GETs /pppoe and returns the paginated result', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: listResult });
    const r = await pppoeApi.list({});
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe', { params: {} });
    expect(r).toEqual(listResult);
  });

  it('forwards search/status/nasId/page/limit as query params', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: listResult });
    await pppoeApi.list({ search: 'juan', status: 'baja', nasId: 'nas-1', page: 2, limit: 50 });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe', {
      params: { search: 'juan', status: 'baja', nasId: 'nas-1', page: 2, limit: 50 },
    });
  });

  it('omits empty filters (no ?status= / ?search= for blanks) and trims search', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: listResult });
    await pppoeApi.list({ search: '  juan  ', status: '', nasId: '', page: 1 });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe', {
      params: { search: 'juan', page: 1 },
    });
  });

  // pppoe-preprovision: el chip "Pendientes" es server-side — pending=true viaja
  // como query param (el BE filtra nasId IS NULL).
  it('forwards pending=true as query param (chip "Pendientes" server-side)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: listResult });
    await pppoeApi.list({ pending: true, page: 1, limit: 25 });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe', {
      params: { pending: 'true', page: 1, limit: 25 },
    });
  });

  it('omits pending when false/absent (nunca manda ?pending=false)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: listResult });
    await pppoeApi.list({ pending: false, page: 1 });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe', { params: { page: 1 } });
  });
});

describe('pppoeApi.listIds', () => {
  const idsResult = { ids: ['pppoe-1', 'pppoe-2'], total: 2 };

  it('GETs /pppoe/ids and returns { ids, total }', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: idsResult });
    const r = await pppoeApi.listIds({ nasId: 'nas-1' });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/ids', { params: { nasId: 'nas-1' } });
    expect(r).toEqual(idsResult);
  });

  it('forwards search/status/nasId/includeUnassigned as query params (NO page/limit)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: idsResult });
    await pppoeApi.listIds({
      search: 'juan',
      status: 'baja',
      nasId: 'nas-1',
      includeUnassigned: true,
      page: 3,
      limit: 25,
    });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/ids', {
      params: { search: 'juan', status: 'baja', nasId: 'nas-1', includeUnassigned: 'true' },
    });
  });

  it('omits empty filters and trims search (mismo patrón que pppoeApi.list)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: idsResult });
    await pppoeApi.listIds({ search: '  juan  ', status: '', nasId: '' });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/ids', {
      params: { search: 'juan' },
    });
  });

  // pppoe-preprovision D6.7: pending=true viaja al endpoint de ids y CUENTA como
  // filtro de narrowing en el BE (no dispara 400 FILTER_REQUIRED yendo solo).
  it('forwards pending=true (cuenta como filtro de narrowing en el BE)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: idsResult });
    await pppoeApi.listIds({ pending: true, includeUnassigned: true });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/ids', {
      params: { pending: 'true', includeUnassigned: 'true' },
    });
  });

  it('omits pending when false/absent (mismo patrón que pppoeApi.list)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: idsResult });
    await pppoeApi.listIds({ pending: false, nasId: 'nas-1' });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/ids', {
      params: { nasId: 'nas-1' },
    });
  });
});

describe('pppoeApi.activationHistory', () => {
  it('GETs /pppoe/activation-history and returns the events', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: events });
    const r = await pppoeApi.activationHistory({});
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/activation-history', { params: {} });
    expect(r).toEqual(events);
  });

  it('forwards actorId/customerId/clientId/from/to', async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: events });
    await pppoeApi.activationHistory({
      actorId: 'a1',
      customerId: 'c1',
      clientId: 'cl1',
      from: '2026-01-01',
      to: '2026-06-01',
    });
    expect(axiosClient.get).toHaveBeenCalledWith('/pppoe/activation-history', {
      params: { actorId: 'a1', customerId: 'c1', clientId: 'cl1', from: '2026-01-01', to: '2026-06-01' },
    });
  });
});
