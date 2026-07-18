/**
 * messagingReports.api — wire contract del router `/api/messaging/reports`
 * (Ola 3 dashboard). Respuestas FLAT (sin envelope `{data}`) — mismo criterio
 * que `getWhatsappConversation`/`setConversationStatus`. `from`/`to` viajan como
 * params UTC ISO.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  ReportsOverview,
  ReportsTraffic,
  ReportsResolutions,
} from '@/types/messagingReports';

vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import {
  getReportsOverview,
  getReportsTraffic,
  getReportsResolutions,
} from '@/api/messagingReports.api';

const RANGE = { from: '2026-07-12T03:00:00.000Z', to: '2026-07-19T03:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getReportsOverview', () => {
  it('GET /messaging/reports/overview con from/to y devuelve el DTO flat', async () => {
    const dto: ReportsOverview = {
      resolvedInRange: 10,
      createdInRange: 12,
      currentOpen: 3,
      currentUnattended: 1,
      currentUnassigned: 2,
      currentPending: 0,
    };
    vi.mocked(axiosClient.get).mockResolvedValue({ data: dto });

    const result = await getReportsOverview(RANGE);

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/reports/overview', {
      params: { from: RANGE.from, to: RANGE.to },
    });
    expect(result).toEqual(dto);
  });
});

describe('getReportsTraffic', () => {
  it('GET /messaging/reports/traffic y devuelve timezone + cells', async () => {
    const dto: ReportsTraffic = {
      timezone: 'America/Argentina/Buenos_Aires',
      cells: [{ dow: 1, hour: 14, count: 7 }],
    };
    vi.mocked(axiosClient.get).mockResolvedValue({ data: dto });

    const result = await getReportsTraffic(RANGE);

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/reports/traffic', {
      params: { from: RANGE.from, to: RANGE.to },
    });
    expect(result).toEqual(dto);
  });
});

describe('getReportsResolutions', () => {
  it('GET /messaging/reports/resolutions y devuelve timezone + days', async () => {
    const dto: ReportsResolutions = {
      timezone: 'America/Argentina/Buenos_Aires',
      days: [{ date: '2026-07-14', count: 3 }],
    };
    vi.mocked(axiosClient.get).mockResolvedValue({ data: dto });

    const result = await getReportsResolutions(RANGE);

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/reports/resolutions', {
      params: { from: RANGE.from, to: RANGE.to },
    });
    expect(result).toEqual(dto);
  });
});
