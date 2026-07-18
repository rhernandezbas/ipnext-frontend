/**
 * useMessagingReports — los 3 hooks del dashboard de Informes.
 *
 * Estrategia (molde `useRadiusAuthFailures.relativeRange.test.tsx`): mockeamos
 * `useQuery` para CAPTURAR las options que cada hook construye, y
 * `useDocumentVisible` para poder invocar el hook como función pura (sin render).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn() };
});
vi.mock('@/hooks/useDocumentVisible', () => ({ useDocumentVisible: () => true }));
vi.mock('@/api/messagingReports.api', () => ({
  getReportsOverview: vi.fn(),
  getReportsTraffic: vi.fn(),
  getReportsResolutions: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import * as api from '@/api/messagingReports.api';
import {
  useReportsOverview,
  useReportsTraffic,
  useReportsResolutions,
} from '@/hooks/useMessagingReports';
import type { ReportsDateRange } from '@/types/messagingReports';

const RANGE: ReportsDateRange = { from: '2026-07-12T03:00:00.000Z', to: '2026-07-19T03:00:00.000Z' };

type Captured = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
  refetchInterval?: number | false;
};

function capture(run: () => void): Captured {
  let captured = {} as Captured;
  vi.mocked(useQuery).mockImplementation((opts: unknown) => {
    captured = opts as Captured;
    return { data: undefined } as unknown as ReturnType<typeof useQuery>;
  });
  run();
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReportsOverview', () => {
  it('queryKey lleva el rango; queryFn pega al api con el rango', async () => {
    const opts = capture(() => useReportsOverview(RANGE));
    expect(opts.queryKey).toEqual(['messaging', 'reports', 'overview', RANGE]);
    await opts.queryFn();
    expect(api.getReportsOverview).toHaveBeenCalledWith(RANGE);
  });

  it('enabled=true con rango, false sin rango', () => {
    expect(capture(() => useReportsOverview(RANGE)).enabled).toBe(true);
    expect(capture(() => useReportsOverview({ from: '', to: '' })).enabled).toBe(false);
  });

  it('pollea los current* en vivo (refetchInterval con pestaña visible)', () => {
    expect(capture(() => useReportsOverview(RANGE)).refetchInterval).toBe(30_000);
  });
});

describe('useReportsTraffic', () => {
  it('queryKey + queryFn correctos; sin polling (histórico)', async () => {
    const opts = capture(() => useReportsTraffic(RANGE));
    expect(opts.queryKey).toEqual(['messaging', 'reports', 'traffic', RANGE]);
    await opts.queryFn();
    expect(api.getReportsTraffic).toHaveBeenCalledWith(RANGE);
    expect(opts.refetchInterval).toBe(false);
  });

  it('enabled false sin rango', () => {
    expect(capture(() => useReportsTraffic({ from: '', to: '' })).enabled).toBe(false);
  });
});

describe('useReportsResolutions', () => {
  it('queryKey + queryFn correctos; sin polling (histórico)', async () => {
    const opts = capture(() => useReportsResolutions(RANGE));
    expect(opts.queryKey).toEqual(['messaging', 'reports', 'resolutions', RANGE]);
    await opts.queryFn();
    expect(api.getReportsResolutions).toHaveBeenCalledWith(RANGE);
    expect(opts.refetchInterval).toBe(false);
  });
});
