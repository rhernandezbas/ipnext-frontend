import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PagosPage } from '@/pages/PagosPage/PagosPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { Payment } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockPayment: Payment = {
  id: 1,
  customerId: 42,
  customerName: 'Alice García',
  invoiceId: 10,
  amount: 6050,
  method: 'Transferencia',
  reference: 'REF-001',
  date: '2024-01-15',
  notes: null,
};

function renderPagos() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PagosPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PagosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBillingModule.usePayments).mockReturnValue({
      data: { data: [mockPayment], total: 1 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.usePayments>);
    vi.mocked(useBillingModule.useCreatePayment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useCreatePayment>);
  });

  it('renders page title', () => {
    renderPagos();
    expect(screen.getByRole('heading', { name: 'Pagos' })).toBeInTheDocument();
  });

  it('renders payment rows', () => {
    renderPagos();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('$6050.00')).toBeInTheDocument();
    expect(screen.getByText('Transferencia')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderPagos();
    expect(screen.getByPlaceholderText('Buscar por cliente o número de pago...')).toBeInTheDocument();
  });

  it('shows empty message when no payments', () => {
    vi.mocked(useBillingModule.usePayments).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.usePayments>);
    renderPagos();
    expect(screen.getByText('No hay pagos.')).toBeInTheDocument();
  });

  it('shows skeleton while loading', () => {
    vi.mocked(useBillingModule.usePayments).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useBillingModule.usePayments>);
    const { container } = renderPagos();
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows).toHaveLength(5);
  });

  // T1: totals row
  it('renders a totals row in tfoot', () => {
    renderPagos();
    const tfoot = document.querySelector('tfoot');
    expect(tfoot).toBeInTheDocument();
  });

  it('totals row shows count of payments', () => {
    renderPagos();
    expect(screen.getByText('1 pagos')).toBeInTheDocument();
  });

  // Registrar pago
  it('has a "Registrar pago" button', () => {
    renderPagos();
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('clicking "Registrar pago" shows modal with payment fields', async () => {
    const user = userEvent.setup();
    renderPagos();
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByRole('heading', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(document.getElementById('customerName')).toBeInTheDocument();
    expect(document.getElementById('amount')).toBeInTheDocument();
    expect(document.getElementById('date')).toBeInTheDocument();
    expect(document.getElementById('method')).toBeInTheDocument();
    expect(document.getElementById('reference')).toBeInTheDocument();
  });

  it('"Cancelar" closes the modal', async () => {
    const user = userEvent.setup();
    renderPagos();
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByRole('heading', { name: 'Registrar pago' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });
});
