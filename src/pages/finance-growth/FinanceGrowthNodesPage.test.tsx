import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceNodesGrowthResponse } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceNodesGrowth: vi.fn(),
}));

import { useFinanceNodesGrowth } from '@/hooks/useFinanceGrowth';
import FinanceGrowthNodesPage from './FinanceGrowthNodesPage';

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FinanceGrowthNodesPage />
    </MemoryRouter>,
  );
}

describe('FinanceGrowthNodesPage — 4 estados + nodos en contracción destacados', () => {
  it('loading: role=status', () => {
    vi.mocked(useFinanceNodesGrowth).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceNodesGrowthResponse>);

    renderPage();
    expect(screen.getByRole('status', { name: /cargando crecimiento/i })).toBeInTheDocument();
  });

  it('error: role=alert + reintento', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceNodesGrowth).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as UseQueryResult<FinanceNodesGrowthResponse>);

    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty: sin altas ni bajas', () => {
    vi.mocked(useFinanceNodesGrowth).mockReturnValue({
      data: { nodes: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceNodesGrowthResponse>);

    renderPage();
    expect(screen.getByText(/no hubo altas ni bajas/i)).toBeInTheDocument();
  });

  it('un nodo con netGrowth negativo se destaca con texto "contracción" (no sólo color) y uno sin nodo asignado se muestra explícito', () => {
    const response: FinanceNodesGrowthResponse = {
      nodes: [
        { networkSiteId: 'site-1', networkSiteName: 'Nodo Centro', altas: 2, bajas: 10, netGrowth: -8 },
        { networkSiteId: null, networkSiteName: null, altas: 1, bajas: 0, netGrowth: 1 },
      ],
    };
    vi.mocked(useFinanceNodesGrowth).mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceNodesGrowthResponse>);

    renderPage();
    expect(screen.getByText(/contracción/i)).toBeInTheDocument();
    expect(screen.getByText(/sin nodo asignado/i)).toBeInTheDocument();
  });
});
