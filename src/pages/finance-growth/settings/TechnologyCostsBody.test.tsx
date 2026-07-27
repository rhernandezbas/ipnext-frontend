import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceTechnologyCostsResponse, FinanceTechnologyCost } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceTechnologyCosts: vi.fn(),
  useUpdateFinanceTechnologyCost: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFinanceTechnologyCosts, useUpdateFinanceTechnologyCost } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { TechnologyCostsBody } from './TechnologyCostsBody';

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

const FIBRA: FinanceTechnologyCost = {
  technologyName: 'Fibra',
  costoVentaArs: 0,
  costoInstalacionArs: 0,
  costoMensualServicioArs: 0,
  comisionVentaPct: 0,
  updatedAt: null,
};

let mutateFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mutateFn = vi.fn();
  vi.mocked(useUpdateFinanceTechnologyCost).mockReturnValue({
    mutate: mutateFn,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  } as unknown as ReturnType<typeof useUpdateFinanceTechnologyCost>);
});

describe('TechnologyCostsBody', () => {
  it('loading: pasa loading=true a la tabla, no explota', () => {
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: undefined, isLoading: true, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);
    // DataTable en loading no debe tirar "no hay datos" — sólo skeleton rows.
    expect(screen.queryByText(/no hay datos/i)).not.toBeInTheDocument();
  });

  it('error: role=alert + reintentar', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('sin fila configurada, un costo muestra "sin configurar" en vez de $0 sin contexto', () => {
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: { technologies: [FIBRA] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);
    expect(screen.getAllByText(/sin configurar/i).length).toBeGreaterThan(0);
  });

  it('sin permiso finance.manage_costs, no se puede editar', () => {
    mockPermissions((p) => p !== 'finance.manage_costs');
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: { technologies: [FIBRA] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('valida negativos ANTES de enviar (espeja la regla 400 del BE) y no llama la mutación', async () => {
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: { technologies: [FIBRA] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const ventaInput = await screen.findByLabelText(/costo de venta/i);
    fireEvent.change(ventaInput, { target: { value: '-100' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('payload válido llama la mutación con technologyName + los 4 campos', async () => {
    vi.mocked(useFinanceTechnologyCosts).mockReturnValue({
      data: { technologies: [FIBRA] }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceTechnologyCostsResponse>);
    render(<TechnologyCostsBody />);

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(await screen.findByLabelText(/costo de venta/i), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText(/costo de instalaci[oó]n/i), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText(/comisi[oó]n/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateFn).toHaveBeenCalledWith({
      technologyName: 'Fibra',
      payload: {
        costoVentaArs: 10000,
        costoInstalacionArs: 5000,
        costoMensualServicioArs: 0,
        comisionVentaPct: 5,
      },
    }));
  });
});
