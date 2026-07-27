import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceCacResponse, FinanceTechnologyCostsResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceCac: vi.fn(),
  useFinanceTechnologyCosts: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
}));

import { useFinanceCac, useFinanceTechnologyCosts } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { formatMoney } from '@/utils/formatMoney';
import FinanceGrowthCacPage from './FinanceGrowthCacPage';

// `Intl.NumberFormat('es-AR')` usa un espacio DURO (U+00A0) entre el símbolo
// y el monto — `formatMoney(0, 'ARS')` es literalmente "$ 0,00", nunca
// "$0,00" (la variante que este test comparaba). Ojo con el approach ingenuo
// de comparar contra el string CRUDO de `formatMoney`: `@testing-library`
// NORMALIZA el texto del DOM antes de matchear (colapsa CUALQUIER run de
// `\s` — que incluye U+00A0 — a un espacio normal), pero NO normaliza el
// string matcher que uno le pasa. Verificado empíricamente: con el nbsp
// crudo, `queryByText(...)` da `null` SIEMPRE (falso negativo, distinto bug
// que el original pero mismo síntoma); con el espacio normal, si matchea de
// verdad. Por eso se normaliza ACÁ, no se usa el nbsp crudo.
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

function mockTechCosts() {
  vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
    data: { technologies: [{ technologyName: 'FIBRA', costoVentaArs: 0, costoInstalacionArs: 0, costoMensualServicioArs: 0, comisionVentaPct: 0, updatedAt: null }] },
    isLoading: false,
    isError: false,
  } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mockTechCosts();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FinanceGrowthCacPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthCacPage — 4 estados + honestidad de costConfigured', () => {
  it('loading: role=status', () => {
    vi.mocked(useFinanceCac).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByRole('status', { name: /cargando cac/i })).toBeInTheDocument();
  });

  it('error: role=alert + reintento', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceCac).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('costConfigured=false: CAC se muestra "sin dato", NUNCA como $0 (una tecnología sin costo no es "gratis")', () => {
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: false,
      costIsZero: false,
      costoVentaArs: null,
      costoInstalacionArs: null,
      cacArs: null,
      altasDelMes: [],
      altasDelMesSinTecnologia: 0,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByText(/costos sin configurar/i)).toBeInTheDocument();
    // $0 jamás debe aparecer para un CAC no configurado.
    expect(screen.queryByText(ZERO_MONEY)).not.toBeInTheDocument();
  });

  it('costConfigured=true + costIsZero=true: banner distinto ("configuración explícita"), no confundido con "sin cargar"', () => {
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: true,
      costIsZero: true,
      costoVentaArs: 0,
      costoInstalacionArs: 0,
      cacArs: 0,
      altasDelMes: [],
      altasDelMesSinTecnologia: 0,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByText(/configuraci[oó]n EXPL[IÍ]CITA/i)).toBeInTheDocument();
    expect(screen.queryByText(/costos sin configurar/i)).not.toBeInTheDocument();
  });

  it('altasDelMesSinTecnologia > 0 se declara explícitamente, no desaparece en silencio', () => {
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: true,
      costIsZero: false,
      costoVentaArs: 10000,
      costoInstalacionArs: 5000,
      cacArs: 15000,
      altasDelMes: [],
      altasDelMesSinTecnologia: 5,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByText(/5 alta\(s\) del mes sin tecnolog[ií]a clasificada/i)).toBeInTheDocument();
  });

  it('lossMaking se resalta con un badge de texto, no solo con color', () => {
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: true,
      costIsZero: false,
      costoVentaArs: 10000,
      costoInstalacionArs: 5000,
      cacArs: 15000,
      altasDelMes: [
        {
          contractId: 'c1',
          clientId: 'cl1',
          customerName: 'Juan Pérez',
          mrrAtribuidoArs: 1000,
          attributionConfidence: 'exact',
          paybackMonths: 15,
          lossMaking: true,
        },
      ],
      altasDelMesSinTecnologia: 0,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByText(/pierde plata/i)).toBeInTheDocument();
  });

  it('cacArs === null: el veredicto NUNCA es "Dentro del umbral" (eso es tranquilizador y falso) — es un 3er estado "no evaluable" (bloqueante 🔴2)', () => {
    // costConfigured:false ⇒ cacArs:null ⇒ el BE emite lossMaking:false POR
    // CONSTRUCCIÓN para todas las filas (mismo bug que costIsZero cerró en
    // el BE, versión badge). Antes del fix, LossMakingBadge sólo miraba
    // `lossMaking` y pintaba "Dentro del umbral" en TODAS las filas.
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: false,
      costIsZero: false,
      costoVentaArs: null,
      costoInstalacionArs: null,
      cacArs: null,
      altasDelMes: [
        {
          contractId: 'c1',
          clientId: 'cl1',
          customerName: 'Juan Pérez',
          mrrAtribuidoArs: 1000,
          attributionConfidence: 'exact',
          paybackMonths: null,
          lossMaking: false,
        },
      ],
      altasDelMesSinTecnologia: 0,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.queryByText(/dentro del umbral/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no evaluable/i)).toBeInTheDocument();
  });

  it('cacArs es un número real (costConfigured true): el veredicto SÍ distingue "Dentro del umbral" de "Pierde plata"', () => {
    const response: FinanceCacResponse = {
      technology: 'FIBRA',
      costConfigured: true,
      costIsZero: false,
      costoVentaArs: 10000,
      costoInstalacionArs: 5000,
      cacArs: 15000,
      altasDelMes: [
        {
          contractId: 'c1',
          clientId: 'cl1',
          customerName: 'Sana',
          mrrAtribuidoArs: 2000,
          attributionConfidence: 'exact',
          paybackMonths: 7.5,
          lossMaking: false,
        },
      ],
      altasDelMesSinTecnologia: 0,
      maxPaybackMonths: 12,
    };
    vi.mocked(useFinanceCac).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByText(/dentro del umbral/i)).toBeInTheDocument();
    expect(screen.queryByText(/no evaluable/i)).not.toBeInTheDocument();
  });

  it('techCosts.isError: NUNCA una pantalla en blanco (role=alert + reintento) (bloqueante 🔴4)', () => {
    // Con technology==='' (el catálogo falló, nunca se pobló) el query de
    // CAC queda enabled:false ⇒ cac.isLoading es false ⇒ ni skeleton, ni
    // error, ni empty — antes del fix, sólo quedaban el header y el Select
    // vacío en el DOM.
    const refetch = vi.fn();
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    vi.mocked(useFinanceCac).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('un mes con formato inválido muestra error de validación (nunca dispara la query rota)', () => {
    vi.mocked(useFinanceCac).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceCacResponse>);

    renderPage();
    const input = screen.getByLabelText(/mes \(aaaa-mm\)/i);
    fireEvent.change(input, { target: { value: '2026-13' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/formato inválido/i);
  });
});
