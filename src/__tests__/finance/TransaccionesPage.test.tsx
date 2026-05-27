import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TransaccionesPage } from '@/pages/TransaccionesPage/TransaccionesPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { Transaction } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockTransaction: Transaction = {
  id: 1,
  customerId: 42,
  customerName: 'Alice García',
  type: 'credit',
  amount: 6050,
  balance: -500,
  description: 'Pago factura F-001',
  date: '2024-01-15',
  invoiceId: 1,
  paymentId: 1,
};

function renderTransacciones() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TransaccionesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TransaccionesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBillingModule.useTransactions).mockReturnValue({
      data: { data: [mockTransaction], total: 1 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useTransactions>);
  });

  it('renders page title', () => {
    renderTransacciones();
    expect(screen.getByRole('heading', { name: 'Transacciones' })).toBeInTheDocument();
  });

  it('renders transaction rows', () => {
    renderTransacciones();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('Crédito')).toBeInTheDocument();
    expect(screen.getByText('$6050.00')).toBeInTheDocument();
    expect(screen.getByText('Pago factura F-001')).toBeInTheDocument();
  });

  it('renders Desde/Hasta date filters', () => {
    renderTransacciones();
    expect(screen.getByText('Desde')).toBeInTheDocument();
    expect(screen.getByText('Hasta')).toBeInTheDocument();
  });

  it('passes dateFrom to useTransactions when Desde changes', () => {
    renderTransacciones();
    const dateInputs = screen.getAllByDisplayValue('');
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });
    const calls = vi.mocked(useBillingModule.useTransactions).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.dateFrom).toBe('2024-01-01');
  });

  it('shows empty message when no transactions', () => {
    vi.mocked(useBillingModule.useTransactions).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useTransactions>);
    renderTransacciones();
    expect(screen.getByText('No hay transacciones.')).toBeInTheDocument();
  });
});
