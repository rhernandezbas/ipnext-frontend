import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MessagingCreditBalance, MessagingRatesConfig } from '@/types/messagingRates';

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
import {
  getMessagingRatesConfig,
  updateMessagingRatesConfig,
  getMessagingCreditBalance,
} from '@/api/messagingRatesConfig.api';

const mockRates: MessagingRatesConfig = {
  currency: 'USD',
  utilityRate: '0.0120',
  marketingRate: '0.0618',
  authenticationRate: '0.0220',
  providerFee: '0.0050',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

const mockBalance: MessagingCreditBalance = {
  available: '17.8940',
  currency: 'USD',
  fetchedAt: '2026-09-01T12:00:00.000Z',
  cached: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMessagingRatesConfig', () => {
  it('GETs /messaging/config/rates y devuelve el envelope FLAT (sin {data})', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockRates });

    const result = await getMessagingRatesConfig();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/config/rates');
    expect(result).toEqual(mockRates);
  });
});

describe('updateMessagingRatesConfig', () => {
  it('PUTs /messaging/config/rates con el body exacto (strings) y devuelve el envelope FLAT', async () => {
    vi.mocked(axiosClient.put).mockResolvedValue({ data: mockRates });

    const body = {
      currency: 'USD',
      utilityRate: '0.0120',
      marketingRate: '0.0618',
      authenticationRate: '0.0220',
      providerFee: '0.0050',
    };
    const result = await updateMessagingRatesConfig(body);

    expect(axiosClient.put).toHaveBeenCalledWith('/messaging/config/rates', body);
    expect(result).toEqual(mockRates);
  });
});

describe('getMessagingCreditBalance', () => {
  it('GETs /messaging/config/rates/balance y devuelve el envelope FLAT', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: mockBalance });

    const result = await getMessagingCreditBalance();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/config/rates/balance');
    expect(result).toEqual(mockBalance);
  });
});
