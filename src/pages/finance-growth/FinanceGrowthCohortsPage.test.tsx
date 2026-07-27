import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceCohortsResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceCohorts: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import { useFinanceCohorts } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import FinanceGrowthCohortsPage from './FinanceGrowthCohortsPage';

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
      <FinanceGrowthCohortsPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthCohortsPage — 4 estados', () => {
  it('loading: role=status', () => {
    vi.mocked(useFinanceCohorts).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCohortsResponse>);

    renderPage();
    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument();
  });

  it('error: role=alert + reintento llama refetch', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceCohorts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceCohortsResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty (dark de prod): cohorts=[] con TODO el rango en monthsWithoutCohortSnapshot explica "nunca computado", nunca una tabla muda', () => {
    const response: FinanceCohortsResponse = {
      cohorts: [],
      monthsWithoutCohortSnapshot: ['2025-08', '2025-09', '2026-07'],
    };
    vi.mocked(useFinanceCohorts).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCohortsResponse>);

    renderPage();
    expect(screen.getByText(/todav[ií]a no se calcul[oó]/i)).toBeInTheDocument();
    const emptyState = screen.getByText(/ninguna cohorte de este rango fue computada/i);
    expect(emptyState).toBeInTheDocument();
    // El estado vacío en sí (no la aclaración del banner de arriba, que
    // deliberadamente NIEGA la lectura errónea) nunca debe afirmar "no hubo
    // altas" como si fuera la causa — la causa real es "no se computó".
    expect(emptyState.textContent).not.toMatch(/no hubo altas/i);
  });

  it('success: pct siempre visible con el conteo, y una edad no alcanzada se explica sin inventar 0%', () => {
    const response: FinanceCohortsResponse = {
      cohorts: [
        {
          cohortYearMonth: '2026-01',
          originalCount: 20,
          survival: {
            m3: { survivingCount: 18, pct: 90 },
            m6: { survivingCount: 15, pct: 75 },
            m12: null,
          },
        },
      ],
      monthsWithoutCohortSnapshot: [],
    };
    vi.mocked(useFinanceCohorts).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCohortsResponse>);

    renderPage();
    expect(screen.getByText(/90%/)).toBeInTheDocument();
    expect(screen.getByText(/\(18\)/)).toBeInTheDocument();
    expect(screen.getByText(/aún no cumple 12m/i)).toBeInTheDocument();
    // La cohorte inmadura NUNCA se lee como "0%" de supervivencia a 12 meses.
    // (Esta aserción sola era TAUTOLÓGICA — el brazo `m12: null` nunca
    // renderiza NINGÚN porcentaje, así que "0%" ausente era cierto pasara lo
    // que pasara con el código. El test de abajo agrega el control positivo:
    // una cohorte con supervivencia REALMENTE en 0 SÍ tiene que decir "0%".)
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('una cohorte con supervivencia REAL en 0% dice "0%" (nunca "—", el cero no se disfraza) — control positivo del test anterior', () => {
    const response: FinanceCohortsResponse = {
      cohorts: [
        {
          cohortYearMonth: '2025-06',
          originalCount: 10,
          survival: {
            m3: { survivingCount: 0, pct: 0 },
            m6: { survivingCount: 0, pct: 0 },
            m12: { survivingCount: 0, pct: 0 },
          },
        },
      ],
      monthsWithoutCohortSnapshot: [],
    };
    vi.mocked(useFinanceCohorts).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCohortsResponse>);

    renderPage();
    // Las 3 columnas (m3/m6/m12) muestran "0%" real — ni un "—" disfrazando
    // el cero, ni "aún no cumple" (esta cohorte SÍ tiene dato, es 0).
    expect(screen.getAllByText('0%')).toHaveLength(3);
    expect(screen.queryByText(/aún no cumple/i)).not.toBeInTheDocument();
  });
});
