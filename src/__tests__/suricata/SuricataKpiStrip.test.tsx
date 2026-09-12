/**
 * SuricataKpiStrip (Fase G, task G.4, spec `suricata-tickets-ui` UI-6).
 *
 *  KPI-1 loading  → skeleton (role="status")
 *  KPI-2 error    → role="alert" + botón reintentar que vuelve a pedir la data
 *  KPI-3 empty    → total === 0 → estado explícito, no 4 tarjetas en 0%
 *  KPI-4 success  → 4 valores (resueltoBotPct/requiereHumanoPct/sinVeredictoPct/sincronizadosHoy)
 *  KPI-5 aria-live sobre los valores (se refrescan tras un nuevo veredicto)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SuricataKpisDto } from '@/pages/suricata/api/suricataClient';

vi.mock('@/pages/suricata/hooks/useSuricataTickets', () => ({
  useSuricataKpis: vi.fn(),
}));

import { SuricataKpiStrip } from '@/pages/suricata/SuricataKpiStrip';
import { useSuricataKpis } from '@/pages/suricata/hooks/useSuricataTickets';

function makeKpis(overrides: Partial<SuricataKpisDto> = {}): SuricataKpisDto {
  return {
    total: 200,
    resueltoBotPct: 62,
    requiereHumanoPct: 38,
    sinVeredictoPct: 22,
    staleCount: 3,
    sincronizadosHoy: 312,
    ...overrides,
  };
}

function mockKpis(partial: Partial<ReturnType<typeof useSuricataKpis>>) {
  vi.mocked(useSuricataKpis).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useSuricataKpis>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KPI-1 loading', () => {
  it('shows a skeleton while KPIs load', () => {
    mockKpis({ isLoading: true, data: undefined });
    render(<SuricataKpiStrip />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('KPI-2 error', () => {
  it('shows role=alert with a retry that refetches', async () => {
    const refetch = vi.fn();
    mockKpis({ isError: true, isLoading: false, data: undefined, refetch });
    render(<SuricataKpiStrip />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('KPI-3 empty', () => {
  it('shows an explicit empty state when total is 0 instead of 4 cards at 0%', () => {
    mockKpis({ data: makeKpis({ total: 0, resueltoBotPct: 0, requiereHumanoPct: 0, sinVeredictoPct: 0, sincronizadosHoy: 0 }) });
    render(<SuricataKpiStrip />);
    expect(screen.getByText(/sin tickets sincronizados/i)).toBeInTheDocument();
    expect(screen.queryByText('62%')).not.toBeInTheDocument();
  });
});

describe('KPI-4 success', () => {
  it('renders the 4 KPI values from the DTO', () => {
    mockKpis({ data: makeKpis() });
    render(<SuricataKpiStrip />);

    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('38%')).toBeInTheDocument();
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText('312')).toBeInTheDocument();

    expect(screen.getByText(/resueltos por el bot/i)).toBeInTheDocument();
    expect(screen.getByText(/necesitaron humano/i)).toBeInTheDocument();
    expect(screen.getByText(/sin veredicto/i)).toBeInTheDocument();
    expect(screen.getByText(/sincronizados hoy/i)).toBeInTheDocument();
  });

  it('never mixes staleCount into the three percentages (D9)', () => {
    mockKpis({ data: makeKpis({ staleCount: 999 }) });
    render(<SuricataKpiStrip />);
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
});

describe('KPI-5 accessibility', () => {
  it('exposes an aria-live region so refreshed KPI values are announced', () => {
    mockKpis({ data: makeKpis() });
    render(<SuricataKpiStrip />);
    expect(document.querySelector('[aria-live]')).not.toBeNull();
  });
});
