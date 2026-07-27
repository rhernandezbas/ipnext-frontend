import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinancePlanPricesResponse, FinancePlanPrice } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinancePlanPrices: vi.fn(),
  useUpdateFinancePlanPrice: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFinancePlanPrices, useUpdateFinancePlanPrice } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { PlanPricesBody } from './PlanPricesBody';

function mockPermissions(allow: (perm: string) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => {
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some(allow);
    },
  });
}

const PLAN: FinancePlanPrice = {
  planCode: 'IP-100',
  planName: 'IP-100',
  estimatedMonthlyPrice: 0,
  updatedAt: null,
};

let mutateFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mutateFn = vi.fn();
  vi.mocked(useUpdateFinancePlanPrice).mockReturnValue({
    mutate: mutateFn,
    isPending: false,
    isError: false,
    isSuccess: false,
  } as unknown as ReturnType<typeof useUpdateFinancePlanPrice>);
});

describe('PlanPricesBody', () => {
  it('unconfigured price (0, updatedAt null) renders as "sin configurar", never a bare $0', () => {
    vi.mocked(useFinancePlanPrices).mockReturnValue({
      data: { plans: [PLAN] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinancePlanPricesResponse>);
    render(<PlanPricesBody />);
    expect(screen.getAllByText(/sin configurar/i).length).toBeGreaterThan(0);
  });

  it('error state exposes role=alert + retry', () => {
    const refetch = vi.fn();
    vi.mocked(useFinancePlanPrices).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as UseQueryResult<FinancePlanPricesResponse>);
    render(<PlanPricesBody />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('rejects a negative price client-side, mirroring the BE 400 rule, without calling the mutation', async () => {
    vi.mocked(useFinancePlanPrices).mockReturnValue({
      data: { plans: [PLAN] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinancePlanPricesResponse>);
    render(<PlanPricesBody />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(await screen.findByLabelText(/precio mensual estimado/i), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('valid payload calls the mutation with planCode + estimatedMonthlyPrice', async () => {
    vi.mocked(useFinancePlanPrices).mockReturnValue({
      data: { plans: [PLAN] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinancePlanPricesResponse>);
    render(<PlanPricesBody />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(await screen.findByLabelText(/precio mensual estimado/i), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateFn).toHaveBeenCalledWith({
      planCode: 'IP-100',
      payload: { estimatedMonthlyPrice: 15000 },
    }));
  });
});
