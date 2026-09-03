import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/messagingRatesConfig.api', () => ({
  getMessagingRatesConfig: vi.fn(),
  updateMessagingRatesConfig: vi.fn(),
  getMessagingCreditBalance: vi.fn(),
}));

import {
  getMessagingRatesConfig,
  updateMessagingRatesConfig,
  getMessagingCreditBalance,
} from '@/api/messagingRatesConfig.api';
import {
  useMessagingRatesConfig,
  useSetMessagingRatesConfig,
  useMessagingCreditBalance,
  messagingRatesConfigKey,
  messagingCreditBalanceKey,
} from '@/hooks/useMessagingRatesConfig';

function createWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const mockRates = {
  currency: 'USD',
  utilityRate: '0.0120',
  marketingRate: '0.0618',
  authenticationRate: '0.0220',
  providerFee: '0.0050',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

const mockBalance = {
  available: '17.8940',
  currency: 'USD',
  fetchedAt: '2026-09-01T12:00:00.000Z',
  cached: false,
};

describe('useMessagingRatesConfig', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('devuelve la config unwrapped (sin {data}) al resolver', async () => {
    vi.mocked(getMessagingRatesConfig).mockResolvedValue(mockRates);

    const { result } = renderHook(() => useMessagingRatesConfig(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRates);
  });

  it('propaga errores de fetch como isError', async () => {
    vi.mocked(getMessagingRatesConfig).mockRejectedValue(
      Object.assign(new Error('boom'), { response: { status: 500 } }),
    );

    const { result } = renderHook(() => useMessagingRatesConfig(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetMessagingRatesConfig', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('llama al api con el payload exacto', async () => {
    vi.mocked(updateMessagingRatesConfig).mockResolvedValue(mockRates);

    const { result } = renderHook(() => useSetMessagingRatesConfig(), { wrapper: createWrapper(qc) });

    const payload = {
      currency: 'USD',
      utilityRate: '0.0120',
      marketingRate: '0.0618',
      authenticationRate: '0.0220',
      providerFee: '0.0050',
    };
    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(updateMessagingRatesConfig).toHaveBeenCalledWith(payload);
  });

  it('escribe la respuesta en la cache sincrónicamente en onSuccess (setQueryData)', async () => {
    vi.mocked(updateMessagingRatesConfig).mockResolvedValue(mockRates);

    const { result } = renderHook(() => useSetMessagingRatesConfig(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({
        currency: 'USD',
        utilityRate: '0.0120',
        marketingRate: '0.0618',
        authenticationRate: '0.0220',
        providerFee: '0.0050',
      });
    });

    expect(qc.getQueryData(messagingRatesConfigKey)).toEqual(mockRates);
  });

  it('invalida la query en onSettled, tanto en éxito como en error', async () => {
    vi.mocked(updateMessagingRatesConfig).mockRejectedValue(
      Object.assign(new Error('bad'), { response: { status: 400 } }),
    );
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSetMessagingRatesConfig(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current
        .mutateAsync({
          currency: 'usd',
          utilityRate: '-0.01',
          marketingRate: '0.0618',
          authenticationRate: '0.0220',
          providerFee: '0.0050',
        })
        .catch(() => undefined);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagingRatesConfigKey });
  });
});

describe('useMessagingCreditBalance', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = makeQc();
    vi.clearAllMocks();
  });

  it('devuelve el balance unwrapped al resolver', async () => {
    vi.mocked(getMessagingCreditBalance).mockResolvedValue(mockBalance);

    const { result } = renderHook(() => useMessagingCreditBalance(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockBalance);
  });

  it('propaga un 503 CREDIT_UNAVAILABLE como isError, sin romper la query de tarifas', async () => {
    vi.mocked(getMessagingCreditBalance).mockRejectedValue(
      Object.assign(new Error('unavailable'), { response: { status: 503, data: { code: 'CREDIT_UNAVAILABLE' } } }),
    );

    const { result } = renderHook(() => useMessagingCreditBalance(), { wrapper: createWrapper(qc) });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('usa una query key propia, independiente de la de tarifas', () => {
    expect(messagingCreditBalanceKey).not.toEqual(messagingRatesConfigKey);
  });
});
