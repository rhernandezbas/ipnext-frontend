import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceInflationResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceInflation: vi.fn(),
  useUpdateFinanceInflation: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));
vi.mock('@/utils/financeGrowthDates', async () => {
  const actual = await vi.importActual<typeof import('@/utils/financeGrowthDates')>('@/utils/financeGrowthDates');
  return {
    ...actual,
    getDefaultYearMonthRange: () => ({ from: '2026-06', to: '2026-07' }),
  };
});

import { useFinanceInflation, useUpdateFinanceInflation } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { InflationBody } from './InflationBody';

function mockPermissions(allow: (perm: string) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false,
    can: (permission: string | string[]) => (Array.isArray(permission) ? permission : [permission]).some(allow),
  });
}

let mutateFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mutateFn = vi.fn();
  vi.mocked(useUpdateFinanceInflation).mockReturnValue({
    mutate: mutateFn, isPending: false, isError: false, isSuccess: false,
  } as unknown as ReturnType<typeof useUpdateFinanceInflation>);
});

describe('InflationBody', () => {
  it('un mes sin fila en el rango se ve como "sin cargar", nunca 0%', () => {
    const response: FinanceInflationResponse = { index: [{ yearMonth: '2026-07', monthlyRatePct: 4.2, source: 'INDEC' }] };
    vi.mocked(useFinanceInflation).mockReturnValue({
      data: response, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceInflationResponse>);

    render(<InflationBody />);
    expect(screen.getByText(/sin cargar/i)).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
  });

  it('error: role=alert + retry', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceInflation).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as UseQueryResult<FinanceInflationResponse>);
    render(<InflationBody />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('cargar un mes vacío llama la mutación con el yearMonth correcto', async () => {
    const response: FinanceInflationResponse = { index: [] };
    vi.mocked(useFinanceInflation).mockReturnValue({
      data: response, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceInflationResponse>);

    render(<InflationBody />);
    const [firstRowButton] = screen.getAllByRole('button', { name: /cargar/i });
    fireEvent.click(firstRowButton);
    fireEvent.change(await screen.findByLabelText(/variaci[oó]n mensual/i), { target: { value: '4.2' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateFn).toHaveBeenCalledWith({
      yearMonth: '2026-06',
      payload: { monthlyRatePct: 4.2, source: '' },
    }));
  });
});
