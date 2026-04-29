import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CustomerVouchersPage from '@/pages/clientes/CustomerVouchersPage';
import * as useCustomerVouchersModule from '@/hooks/useCustomerVouchers';
import type { Voucher } from '@/types/voucher';

vi.mock('@/hooks/useCustomerVouchers');

const mockVouchers: Voucher[] = [
  { id: '1', code: 'VCH-TEST-001', plan: 'Plan 10MB', duration: '1 hora', price: 50, status: 'Disponible', createdAt: '2026-04-01' },
  { id: '2', code: 'VCH-TEST-002', plan: 'Plan 20MB', duration: '1 día', price: 200, status: 'Usado', createdAt: '2026-04-05' },
];

describe('CustomerVouchersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomerVouchersModule.useCustomerVouchers).mockReturnValue({
      data: mockVouchers,
      isLoading: false,
    } as ReturnType<typeof useCustomerVouchersModule.useCustomerVouchers>);
  });

  it('renders heading "Vouchers"', () => {
    render(<MemoryRouter><CustomerVouchersPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Vouchers/i })).toBeInTheDocument();
  });

  it('has "Generar vouchers" button', () => {
    render(<MemoryRouter><CustomerVouchersPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Generar vouchers/i })).toBeInTheDocument();
  });

  it('renders voucher rows from hook data', () => {
    render(<MemoryRouter><CustomerVouchersPage /></MemoryRouter>);
    expect(screen.getByText('VCH-TEST-001')).toBeInTheDocument();
    expect(screen.getByText('VCH-TEST-002')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useCustomerVouchersModule.useCustomerVouchers).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useCustomerVouchersModule.useCustomerVouchers>);
    render(<MemoryRouter><CustomerVouchersPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
