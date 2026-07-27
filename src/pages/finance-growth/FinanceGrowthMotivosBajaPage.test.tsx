import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceMotivosBajaResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceMotivosBaja: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import { useFinanceMotivosBaja } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { formatMoney } from '@/utils/formatMoney';
import FinanceGrowthMotivosBajaPage from './FinanceGrowthMotivosBajaPage';

// `Intl.NumberFormat('es-AR')` separa el símbolo de moneda del monto con un
// espacio DURO (U+00A0), no un espacio normal — `formatMoney(0, 'ARS')`
// produce literalmente "$ 0,00". La aserción `queryByText('$0,00')`
// (sin ese carácter) NUNCA matchea nada, así que "not.toBeInTheDocument()"
// pasaba SIEMPRE, tuviera el bug puesto o no — se construye el string
// esperado con la misma función que usa el componente para que la
// aserción pueda fallar de verdad.
const ZERO_MONEY = formatMoney(0, 'ARS').replace(/ /g, ' ');

function mockPermissions() {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: [],
    isLoading: false,
    isError: false,
    can: () => true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FinanceGrowthMotivosBajaPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthMotivosBajaPage — 4 estados + honestidad de bajasSinPrecio', () => {
  it('loading: role=status', () => {
    vi.mocked(useFinanceMotivosBaja).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceMotivosBajaResponse>);

    renderPage();
    expect(screen.getByRole('status', { name: /cargando motivos/i })).toBeInTheDocument();
  });

  it('error: role=alert + reintento', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceMotivosBaja).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceMotivosBajaResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: sin bajas en el rango', () => {
    vi.mocked(useFinanceMotivosBaja).mockReturnValue({
      data: { motivos: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceMotivosBajaResponse>);

    renderPage();
    expect(screen.getByText(/no hubo bajas/i)).toBeInTheDocument();
  });

  it('estado real de prod HOY — TODAS las bajas sin precio: banner explícito de "ranking no confiable", NUNCA una tabla muda de $0 en todas las filas', () => {
    const response: FinanceMotivosBajaResponse = {
      motivos: [
        { motivo: 'mudanza', bajas: 12, mrrPerdidoArs: 0, bajasSinPrecio: 12 },
        { motivo: 'precio', bajas: 8, mrrPerdidoArs: 0, bajasSinPrecio: 8 },
      ],
    };
    vi.mocked(useFinanceMotivosBaja).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceMotivosBajaResponse>);

    renderPage();
    expect(screen.getByText(/este ranking no es confiable todav[ií]a/i)).toBeInTheDocument();
    // Ninguna fila debe mostrar el $0 mentiroso — todas muestran el motivo explícito.
    expect(screen.queryByText(ZERO_MONEY)).not.toBeInTheDocument();
    // 1 mención en el banner global + 1 por cada fila (2 motivos) = 3.
    expect(screen.getAllByText(/sin precio cargado/i).length).toBe(3);
  });

  it('caso parcial: sólo algunas bajas sin precio muestran advertencia por fila, no bloquean el resto de la tabla', () => {
    const response: FinanceMotivosBajaResponse = {
      motivos: [
        { motivo: 'mudanza', bajas: 10, mrrPerdidoArs: 50000, bajasSinPrecio: 3 },
        { motivo: 'precio', bajas: 5, mrrPerdidoArs: 20000, bajasSinPrecio: 0 },
      ],
    };
    vi.mocked(useFinanceMotivosBaja).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceMotivosBajaResponse>);

    renderPage();
    expect(screen.getByText(/3 de 10 bajas sin precio/i)).toBeInTheDocument();
    expect(screen.queryByText(/este ranking no es confiable todav[ií]a/i)).not.toBeInTheDocument();
  });
});
