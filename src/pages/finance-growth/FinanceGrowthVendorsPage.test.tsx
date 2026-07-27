import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceVendorsEarlyChurnResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceVendorsEarlyChurn: vi.fn(),
}));

import { useFinanceVendorsEarlyChurn } from '@/hooks/useFinanceGrowth';
import FinanceGrowthVendorsPage from './FinanceGrowthVendorsPage';

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FinanceGrowthVendorsPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthVendorsPage — 4 estados + earlyChurnPct como columna primaria', () => {
  it('loading: role=status', () => {
    vi.mocked(useFinanceVendorsEarlyChurn).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceVendorsEarlyChurnResponse>);

    renderPage();
    expect(screen.getByRole('status', { name: /cargando ranking/i })).toBeInTheDocument();
  });

  it('error: role=alert + reintento', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceVendorsEarlyChurn).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceVendorsEarlyChurnResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: sin altas en el rango', () => {
    vi.mocked(useFinanceVendorsEarlyChurn).mockReturnValue({
      data: { windowMonths: 12, vendors: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceVendorsEarlyChurnResponse>);

    renderPage();
    expect(screen.getByText(/no hay altas nuevas/i)).toBeInTheDocument();
  });

  it('earlyChurnPct null (altas inmaduras) se muestra como "sin datos aún", NUNCA como 0% (eso premiaría al vendedor)', () => {
    const response: FinanceVendorsEarlyChurnResponse = {
      windowMonths: 12,
      vendors: [
        { vendedor: 'Vendedor Nuevo', altasTotal: 8, altasChurneadasTemprano: 0, altasMaduras: 0, earlyChurnPct: null },
        { vendedor: 'Vendedor Volumen', altasTotal: 50, altasChurneadasTemprano: 5, altasMaduras: 50, earlyChurnPct: 10 },
      ],
    };
    vi.mocked(useFinanceVendorsEarlyChurn).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceVendorsEarlyChurnResponse>);

    renderPage();
    expect(screen.getByText(/sin datos aún/i)).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('un vendedor con menos altas pero más churn temprano SIGUE apareciendo con su tasa real (no colapsa por volumen)', () => {
    const response: FinanceVendorsEarlyChurnResponse = {
      windowMonths: 12,
      vendors: [
        { vendedor: 'A (churn alto)', altasTotal: 10, altasChurneadasTemprano: 8, altasMaduras: 10, earlyChurnPct: 80 },
        { vendedor: 'B (volumen)', altasTotal: 50, altasChurneadasTemprano: 5, altasMaduras: 50, earlyChurnPct: 10 },
      ],
    };
    vi.mocked(useFinanceVendorsEarlyChurn).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceVendorsEarlyChurnResponse>);

    renderPage();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getByText(/ventana de "temprano": 12 meses/i)).toBeInTheDocument();
  });
});
