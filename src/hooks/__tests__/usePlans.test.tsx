import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/plans.api', () => ({
  getPlans: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  deletePlan: vi.fn(),
}));

import * as plansApi from '@/api/plans.api';
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  PLANS_QUERY_KEY,
} from '@/hooks/usePlans';
import type { PlanDto } from '@/types/plans';

const PLAN_AIR: PlanDto = {
  id: 'plan-1',
  code: 'IP-Air-30-10',
  name: 'IP-Air-30-10',
  category: 'Air',
  downloadKbps: 30000,
  uploadKbps: 10000,
  rateLimit: '10M/30M',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PLAN_CORTE: PlanDto = {
  id: 'plan-2',
  code: 'IP-REDUCCION',
  name: 'IP-REDUCCION',
  category: 'Corte',
  downloadKbps: 256,
  uploadKbps: 256,
  rateLimit: '256k/256k',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlans', () => {
  it('returns list of plans on success', async () => {
    vi.mocked(plansApi.getPlans).mockResolvedValue([PLAN_AIR, PLAN_CORTE]);

    const { result } = renderHook(() => usePlans(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].code).toBe('IP-Air-30-10');
    expect(plansApi.getPlans).toHaveBeenCalledTimes(1);
  });

  it('surfaces error state when request fails', async () => {
    vi.mocked(plansApi.getPlans).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePlans(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useCreatePlan', () => {
  it('calls createPlan with provided data and invalidates plans query', async () => {
    vi.mocked(plansApi.createPlan).mockResolvedValue(PLAN_AIR);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreatePlan(), { wrapper: localWrapper });

    result.current.mutate({
      code: 'IP-Air-30-10',
      name: 'IP-Air-30-10',
      category: 'Air',
      downloadKbps: 30000,
      uploadKbps: 10000,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(plansApi.createPlan).toHaveBeenCalledWith({
      code: 'IP-Air-30-10',
      name: 'IP-Air-30-10',
      category: 'Air',
      downloadKbps: 30000,
      uploadKbps: 10000,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PLANS_QUERY_KEY });
  });
});

describe('useUpdatePlan', () => {
  it('calls updatePlan with id and data, invalidates plans query', async () => {
    const updated = { ...PLAN_AIR, downloadKbps: 50000 };
    vi.mocked(plansApi.updatePlan).mockResolvedValue(updated);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdatePlan(), { wrapper: localWrapper });

    result.current.mutate({ id: 'plan-1', data: { downloadKbps: 50000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(plansApi.updatePlan).toHaveBeenCalledWith('plan-1', { downloadKbps: 50000 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PLANS_QUERY_KEY });
  });
});

describe('useDeletePlan', () => {
  it('calls deletePlan with the id and invalidates plans query', async () => {
    vi.mocked(plansApi.deletePlan).mockResolvedValue({ data: undefined, status: 204, statusText: 'No Content', headers: {}, config: {} as never });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const localWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeletePlan(), { wrapper: localWrapper });

    result.current.mutate('plan-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(plansApi.deletePlan).toHaveBeenCalledWith('plan-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: PLANS_QUERY_KEY });
  });
});
