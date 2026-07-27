/**
 * technicianLocation.api — desenvoltura del ENVELOPE.
 *
 * El backend de `iclass-gps-audit` envuelve TODO en `{ data }`, y
 * `/audit/suspicious-closures` agrega `{ meta: { thresholdMinutes } }`.
 * Un mismatch de shape acá no lo caza ningún test de page (los tests mockean
 * el hook, no el HTTP), así que se verifica en su propio nivel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { technicianLocationApi } from '@/api/technicianLocation.api';
import type { TeamLiveStatus, ServiceOrderPresenceReport } from '@/types/technicianLocation';

const mockGet = vi.mocked(axiosClient.get);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('technicianLocationApi.live', () => {
  it('desenvuelve `.data.data` y pega a /technicians/live', async () => {
    const row: TeamLiveStatus = {
      login: 'IPNXDENIC',
      name: 'Denis C.',
      iclassStatus: 'Ativo',
      state: 'ACTIVA',
      latitude: -34.6,
      longitude: -58.38,
      lastPointAt: '2026-07-26T12:00:00.000Z',
      accuracyMeters: 12,
      minutesSinceLastPoint: 4,
      mapsUrl: 'https://maps.example/1',
    };
    mockGet.mockResolvedValueOnce({ data: { data: [row] } });

    const result = await technicianLocationApi.live();

    expect(mockGet).toHaveBeenCalledWith('/technicians/live');
    expect(result).toEqual([row]);
  });
});

describe('technicianLocationApi.journey', () => {
  it('manda el día como query param y desenvuelve `.data.data`', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { teamLogin: 'IPNXDENIC', pointCount: 29 } } });

    const result = await technicianLocationApi.journey('IPNXDENIC', '2026-07-26');

    expect(mockGet).toHaveBeenCalledWith('/technicians/IPNXDENIC/journey', {
      params: { day: '2026-07-26' },
    });
    expect(result).toMatchObject({ pointCount: 29 });
  });
});

describe('technicianLocationApi.auditServiceOrder', () => {
  it('desenvuelve `.data.data`', async () => {
    const report = { verdict: 'EN_SITIO', serviceOrderCode: '4905' } as ServiceOrderPresenceReport;
    mockGet.mockResolvedValueOnce({ data: { data: report } });

    const result = await technicianLocationApi.auditServiceOrder('4905');

    expect(mockGet).toHaveBeenCalledWith('/technicians/audit/service-order/4905');
    expect(result).toBe(report);
  });
});

describe('technicianLocationApi.suspiciousClosures', () => {
  it('devuelve candidatos Y el thresholdMinutes del `meta` (no el pedido)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{ serviceOrderCode: '4995', executionMinutes: 2.27, isCandidateForReview: true }],
        meta: { thresholdMinutes: 5 },
      },
    });

    const result = await technicianLocationApi.suspiciousClosures({
      from: '2026-07-01',
      to: '2026-07-26',
      thresholdMinutes: 30,
    });

    expect(mockGet).toHaveBeenCalledWith('/technicians/audit/suspicious-closures', {
      params: { from: '2026-07-01', to: '2026-07-26', thresholdMinutes: 30 },
    });
    expect(result.candidates).toHaveLength(1);
    // El umbral que se MUESTRA es el que aplicó el servidor, nunca el que se pidió.
    expect(result.thresholdMinutes).toBe(5);
  });

  it('omite thresholdMinutes del querystring cuando no se especifica', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [], meta: { thresholdMinutes: 5 } } });

    await technicianLocationApi.suspiciousClosures({ from: '2026-07-01', to: '2026-07-02' });

    expect(mockGet).toHaveBeenCalledWith('/technicians/audit/suspicious-closures', {
      params: { from: '2026-07-01', to: '2026-07-02' },
    });
  });
});
