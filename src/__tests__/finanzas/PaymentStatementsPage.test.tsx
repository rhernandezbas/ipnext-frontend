import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PaymentStatementsPage from '@/pages/finanzas/PaymentStatementsPage';
import * as usePaymentStatementsModule from '@/hooks/usePaymentStatements';
import type { PaymentStatement } from '@/types/paymentStatement';

vi.mock('@/hooks/usePaymentStatements');

const mockStatements: PaymentStatement[] = [
  { id: '1', cliente: 'Juan Test', periodo: 'Marzo 2024', monto: 6500, estado: 'Pagado', fecha: '2024-03-05' },
  { id: '2', cliente: 'María Test', periodo: 'Marzo 2024', monto: 7865, estado: 'Pendiente', fecha: '2024-03-31' },
];

describe('PaymentStatementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePaymentStatementsModule.usePaymentStatements).mockReturnValue({
      data: mockStatements,
      isLoading: false,
    } as ReturnType<typeof usePaymentStatementsModule.usePaymentStatements>);
  });

  it('renders the page title', () => {
    render(<MemoryRouter><PaymentStatementsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /payment statements/i })).toBeInTheDocument();
  });

  it('renders payment statements from hook data', () => {
    render(<MemoryRouter><PaymentStatementsPage /></MemoryRouter>);
    expect(screen.getByText('Juan Test')).toBeInTheDocument();
    expect(screen.getByText('María Test')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(usePaymentStatementsModule.usePaymentStatements).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof usePaymentStatementsModule.usePaymentStatements>);
    render(<MemoryRouter><PaymentStatementsPage /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
