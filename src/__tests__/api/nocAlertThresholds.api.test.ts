import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NocAlertThresholdsDto } from '@/types/nocAlertThresholds';

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
import { getNocAlertThresholds, updateNocAlertThresholds } from '@/api/nocAlertThresholds.api';

const mockConfig: NocAlertThresholdsDto = {
  critDbm: -30,
  warnDbm: -27,
  deltaAlert: 2,
  ponMinAbon: 2,
  ponDelta: 1.5,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNocAlertThresholds', () => {
  it('GETs /alerts/thresholds and returns the FLAT dto (no envelope)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockConfig });

    const result = await getNocAlertThresholds();

    expect(axiosClient.get).toHaveBeenCalledWith('/alerts/thresholds');
    expect(result).toEqual(mockConfig);
  });
});

describe('updateNocAlertThresholds', () => {
  it('PUTs /alerts/thresholds with the exact full body and returns the updated dto', async () => {
    const updated = { ...mockConfig, warnDbm: -26 };
    vi.mocked(axiosClient.put).mockResolvedValue({ data: updated });

    const result = await updateNocAlertThresholds({ ...mockConfig, warnDbm: -26 });

    expect(axiosClient.put).toHaveBeenCalledWith('/alerts/thresholds', { ...mockConfig, warnDbm: -26 });
    expect(result).toEqual(updated);
  });
});
