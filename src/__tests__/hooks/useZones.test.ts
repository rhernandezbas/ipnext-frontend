import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the zones API module
vi.mock('@/api/zones.api', () => ({
  zonesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { zonesApi } from '@/api/zones.api';
import type { Zone } from '@/api/zones.api';
import { useZones, useCreateZone, useUpdateZone, useDeleteZone } from '@/hooks/useZones';

// Note: setup.ts mocks useMyPermissions globally with can: () => true (grants '*')
// so useZones will be enabled by default in these tests.

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

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useZones', () => {
  it('calls zonesApi.list() and returns data', async () => {
    vi.mocked(zonesApi.list).mockResolvedValue([ZONE]);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useZones(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(zonesApi.list).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([ZONE]);
  });

  it('uses queryKey ["zones"]', async () => {
    vi.mocked(zonesApi.list).mockResolvedValue([]);
    const { qc, wrapper } = makeWrapper();

    renderHook(() => useZones(), { wrapper });

    await waitFor(() =>
      expect(qc.getQueryState(['zones'])?.status).toBe('success'),
    );
  });
});

describe('useCreateZone', () => {
  it('calls zonesApi.create() with the given input', async () => {
    vi.mocked(zonesApi.create).mockResolvedValue(ZONE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Zona Norte',
        color: '#3b82f6',
        points: ZONE.points,
      });
    });

    expect(zonesApi.create).toHaveBeenCalledWith({
      name: 'Zona Norte',
      color: '#3b82f6',
      points: ZONE.points,
    });
  });

  it('invalidates ["zones"] query on success', async () => {
    vi.mocked(zonesApi.create).mockResolvedValue(ZONE);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Zona Norte',
        color: '#3b82f6',
        points: ZONE.points,
      });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['zones'] });
  });
});

describe('useUpdateZone', () => {
  it('calls zonesApi.update() with id and patch', async () => {
    vi.mocked(zonesApi.update).mockResolvedValue({ ...ZONE, name: 'Zona Sur' });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useUpdateZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'zone-1', patch: { name: 'Zona Sur' } });
    });

    expect(zonesApi.update).toHaveBeenCalledWith('zone-1', { name: 'Zona Sur' });
  });

  it('invalidates ["zones"] query on success', async () => {
    vi.mocked(zonesApi.update).mockResolvedValue(ZONE);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'zone-1', patch: { color: '#ff0000' } });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['zones'] });
  });
});

describe('useDeleteZone', () => {
  it('calls zonesApi.remove() with the zone id', async () => {
    vi.mocked(zonesApi.remove).mockResolvedValue(undefined);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeleteZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('zone-1');
    });

    expect(zonesApi.remove).toHaveBeenCalledWith('zone-1');
  });

  it('invalidates ["zones"] query on success', async () => {
    vi.mocked(zonesApi.remove).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const spy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteZone(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('zone-1');
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ['zones'] });
  });
});
