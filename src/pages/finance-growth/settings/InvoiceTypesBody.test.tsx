import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FinanceInvoiceTypesResponse, FinanceInvoiceType } from '@/types/financeGrowth';

vi.mock('@/hooks/useFinanceGrowth', () => ({
  useFinanceInvoiceTypes: vi.fn(),
  usePatchFinanceInvoiceType: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFinanceInvoiceTypes, usePatchFinanceInvoiceType } from '@/hooks/useFinanceGrowth';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { InvoiceTypesBody } from './InvoiceTypesBody';

function mockPermissions(allow: (perm: string) => boolean = () => true) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false,
    can: (permission: string | string[]) => (Array.isArray(permission) ? permission : [permission]).some(allow),
  });
}

const TYPES: FinanceInvoiceType[] = [
  { grType: 'FB', bucket: 'revenue', label: 'Factura B', updatedAt: '2026-01-01T00:00:00.000Z' },
  { grType: 'XZ', bucket: 'unclassified', label: null, updatedAt: '2026-07-01T00:00:00.000Z' },
];

let mutateFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions();
  mutateFn = vi.fn();
  vi.mocked(usePatchFinanceInvoiceType).mockReturnValue({
    mutate: mutateFn, isPending: false, isError: false, isSuccess: false,
  } as unknown as ReturnType<typeof usePatchFinanceInvoiceType>);
});

describe('InvoiceTypesBody', () => {
  it('un tipo unclassified muestra un badge destacado, para que un admin lo note', () => {
    vi.mocked(useFinanceInvoiceTypes).mockReturnValue({
      data: { types: TYPES }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceInvoiceTypesResponse>);
    render(<InvoiceTypesBody />);
    expect(screen.getByText(/sin clasificar/i)).toBeInTheDocument();
  });

  it('error: role=alert + retry', () => {
    const refetch = vi.fn();
    vi.mocked(useFinanceInvoiceTypes).mockReturnValue({
      data: undefined, isLoading: false, isError: true, refetch,
    } as unknown as UseQueryResult<FinanceInvoiceTypesResponse>);
    render(<InvoiceTypesBody />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('reclasificar XZ a revenue via el Select propio llama la mutación con el bucket elegido', async () => {
    vi.mocked(useFinanceInvoiceTypes).mockReturnValue({
      data: { types: TYPES }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceInvoiceTypesResponse>);
    render(<InvoiceTypesBody />);

    const reclassifyButtons = screen.getAllByRole('button', { name: /reclasificar/i });
    // TYPES = [FB (revenue), XZ (unclassified)] — el segundo botón es el de XZ.
    fireEvent.click(reclassifyButtons[1]);

    // Select propio (combobox), no <select> nativo.
    const combobox = await screen.findByRole('combobox');
    fireEvent.click(combobox);
    fireEvent.click(screen.getByRole('option', { name: /revenue/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(mutateFn).toHaveBeenCalledWith({
      grType: 'XZ',
      payload: { bucket: 'revenue' },
    }));
  });

  it('sin permiso finance.manage_costs, no aparece la acción de reclasificar', () => {
    mockPermissions((p) => p !== 'finance.manage_costs');
    vi.mocked(useFinanceInvoiceTypes).mockReturnValue({
      data: { types: TYPES }, isLoading: false, isError: false, refetch: vi.fn(),
    } as unknown as UseQueryResult<FinanceInvoiceTypesResponse>);
    render(<InvoiceTypesBody />);
    expect(screen.queryByRole('button', { name: /reclasificar/i })).not.toBeInTheDocument();
  });
});
