import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceTargetsConfig } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceTargets: vi.fn(),
  useUpdateFinanceTargets: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFinanceTargets, useUpdateFinanceTargets } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { TargetsBody } from './TargetsBody';

function mockPermissions(allow: (perm: string) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false,
    can: (permission: string | string[]) => (Array.isArray(permission) ? permission : [permission]).some(allow),
  });
}

const TARGETS: FinanceTargetsConfig = {
  churnTargetPct: 5,
  maxPaybackMonths: 12,
  monthlyNewContractsGoal: 100,
  inflationBaseYearMonth: '2026-01',
};

let mutateFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mutateFn = vi.fn();
  vi.mocked(useUpdateFinanceTargets).mockReturnValue({
    mutate: mutateFn, isPending: false, isError: false, isSuccess: false,
  } as unknown as ReturnType<typeof useUpdateFinanceTargets>);
});

describe('TargetsBody', () => {
  it('loading: skeleton, not a blank screen', () => {
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: undefined, isLoading: true, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument();
  });

  it('error: role=alert + retry', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('prefills the form with the current singleton values and submits the full payload', async () => {
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: TARGETS, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);

    expect(screen.getByLabelText(/meta de churn/i)).toHaveValue(5);
    fireEvent.change(screen.getByLabelText(/meta de churn/i), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateFn).toHaveBeenCalledWith({
      churnTargetPct: 8,
      maxPaybackMonths: 12,
      monthlyNewContractsGoal: 100,
      inflationBaseYearMonth: '2026-01',
    }));
  });

  it('rejects churnTargetPct out of 0-100 client-side, mirroring the BE rule', async () => {
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: TARGETS, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);

    fireEvent.change(screen.getByLabelText(/meta de churn/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('mutation.isError: NUNCA guarda en silencio — role=alert visible, el usuario no puede creer que guardó (bloqueante 🔴5)', async () => {
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: TARGETS, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    vi.mocked(useUpdateFinanceTargets).mockReturnValue({
      mutate: mutateFn, isPending: false, isError: true, isSuccess: false,
    } as unknown as ReturnType<typeof useUpdateFinanceTargets>);

    render(<TargetsBody />);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Y NUNCA el mensaje de éxito al lado de un guardado que falló.
    expect(screen.queryByText(/metas actualizadas/i)).not.toBeInTheDocument();
  });

  it('rechaza monthlyNewContractsGoal fuera de Int32 en el cliente, espejando la cota del BE (bloqueante 🔴5)', async () => {
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: TARGETS, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);

    // 1e10 excede Int32 (max 2147483647) — antes del fix, `validate()` sólo
    // chequeaba `Number.isInteger` y `>= 0`, así que esto llamaba a
    // `mutate()` y el 400 legítimo del BE desaparecía sin rastro visible
    // (el flujo de error de este mismo bloqueante).
    fireEvent.change(screen.getByLabelText(/meta de altas mensuales/i), { target: { value: '10000000000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('sin permiso finance.manage_targets, el formulario está deshabilitado', () => {
    mockPermissions((p) => p !== 'finance.manage_targets');
    vi.mocked(useFinanceTargets).mockReturnValue({
      data: TARGETS, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTargetsConfig>);
    render(<TargetsBody />);
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument();
  });
});
