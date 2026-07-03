import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ClientInvoice } from '@/types/billing';

// BillingTab consumes the GR-synced per-client invoices via useClientInvoices.
// Mock the hook directly (ContractsTab pattern) so no QueryClientProvider is needed.
vi.mock('@/hooks/useCustomers', () => ({
  useClientInvoices: vi.fn(),
}));

import { useClientInvoices } from '@/hooks/useCustomers';
import { BillingTab } from '@/pages/customers/tabs/BillingTab';

const inv = (over: Partial<ClientInvoice> = {}): ClientInvoice => ({
  id: 'inv-1',
  number: '0001-00012345',
  grType: 'Factura B',
  amount: 3500,
  balance: 0,
  currency: 'ARS',
  status: 'pagada',
  issueDate: '2026-06-01T00:00:00.000Z',
  dueDate: '2026-06-10T00:00:00.000Z',
  pdfUrl: 'https://gr.example/pdf/1',
  couponPdfUrl: 'https://gr.example/coupon/1',
  paymentUrl: 'https://mp.example/pay/1',
  ...over,
});

function setup(invoices: ClientInvoice[] | undefined, isLoading = false) {
  vi.mocked(useClientInvoices).mockReturnValue({
    data: invoices,
    isLoading,
  } as ReturnType<typeof useClientInvoices>);
  return render(<BillingTab clientId="c-1" active />);
}

/** The card value cell for a KPI, located by its label text. */
function kpiCard(label: string): HTMLElement {
  const el = screen.getByText(label).closest('div');
  if (!el) throw new Error(`KPI card not found: ${label}`);
  return el as HTMLElement;
}

describe('BillingTab (gr-invoices-sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders number, formatted dates, importe, saldo and status label per invoice', () => {
    setup([
      inv({
        number: '0001-0009',
        status: 'pendiente',
        amount: 5000,
        balance: 5000,
        issueDate: '2026-06-01T00:00:00.000Z',
        dueDate: '2026-06-10T00:00:00.000Z',
      }),
    ]);

    expect(screen.getByText('0001-0009')).toBeInTheDocument();
    // AR canonical date format (formatDateShort): "01 jun 2026" / "10 jun 2026".
    // Emisión is unique to the row; Vencimiento also echoes into the KPI card
    // (this unpaid invoice IS the next due date), so it appears more than once.
    expect(screen.getByText('01 jun 2026')).toBeInTheDocument();
    expect(screen.getAllByText('10 jun 2026').length).toBeGreaterThanOrEqual(1);
    // Importe + Saldo formatted as ARS money (digits check, robust to the $ spacer)
    const moneyCells = screen.getAllByText(/5\.000,00/);
    expect(moneyCells.length).toBeGreaterThanOrEqual(2); // importe + saldo columns
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('maps each status to the correct badge variant', () => {
    setup([
      inv({ id: 'a', number: 'A', status: 'pagada' }),
      inv({ id: 'b', number: 'B', status: 'pendiente' }),
      inv({ id: 'c', number: 'C', status: 'vencida' }),
    ]);

    expect(screen.getByText('Pagada')).toHaveClass('active'); // positive
    expect(screen.getByText('Pendiente')).toHaveClass('inactive'); // neutral
    expect(screen.getByText('Vencida')).toHaveClass('late'); // danger/red
  });

  it('computes Saldo pendiente as the sum of balances of non-paid invoices', () => {
    setup([
      inv({ id: 'a', number: 'A', status: 'pagada', balance: 999 }), // excluded even with a balance
      inv({ id: 'b', number: 'B', status: 'pendiente', balance: 5000 }),
      inv({ id: 'c', number: 'C', status: 'vencida', balance: 3000 }),
    ]);

    const card = kpiCard('Saldo pendiente');
    expect(within(card).getByText(/8\.000,00/)).toBeInTheDocument();
    // The paid invoice's balance must NOT be added in.
    expect(within(card).queryByText(/8\.999/)).not.toBeInTheDocument();
  });

  it('computes Próximo vencimiento as the earliest due date among non-paid invoices', () => {
    setup([
      // Paid one is earliest but must be ignored.
      inv({ id: 'a', number: 'A', status: 'pagada', dueDate: '2026-06-05T00:00:00.000Z' }),
      inv({ id: 'b', number: 'B', status: 'pendiente', dueDate: '2026-06-20T00:00:00.000Z' }),
      inv({ id: 'c', number: 'C', status: 'vencida', dueDate: '2026-06-12T00:00:00.000Z' }),
    ]);

    const card = kpiCard('Próximo vencimiento');
    expect(within(card).getByText('12 jun 2026')).toBeInTheDocument();
    expect(within(card).queryByText('05 jun 2026')).not.toBeInTheDocument();
  });

  it('renders PDF, Cupón and MercadoPago links when the urls are present', () => {
    setup([
      inv({
        pdfUrl: 'https://gr.example/pdf/9',
        couponPdfUrl: 'https://gr.example/coupon/9',
        paymentUrl: 'https://mp.example/pay/9',
      }),
    ]);

    const pdf = screen.getByRole('link', { name: /PDF/i });
    expect(pdf).toHaveAttribute('href', 'https://gr.example/pdf/9');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(pdf.getAttribute('rel') ?? '').toMatch(/noopener/);

    const mp = screen.getByRole('link', { name: /MercadoPago/i });
    expect(mp).toHaveAttribute('href', 'https://mp.example/pay/9');
    expect(mp.getAttribute('rel') ?? '').toMatch(/noopener/);

    expect(screen.getByRole('link', { name: /Cupón/i })).toHaveAttribute(
      'href',
      'https://gr.example/coupon/9',
    );
  });

  it('hides an action link when its url is null (and does not crash)', () => {
    setup([inv({ pdfUrl: null, couponPdfUrl: null, paymentUrl: null })]);

    expect(screen.queryByRole('link', { name: /PDF/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cupón/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /MercadoPago/i })).not.toBeInTheDocument();
    // Still renders the invoice row.
    expect(screen.getByText('0001-00012345')).toBeInTheDocument();
  });

  it('shows a clean empty state when there are no invoices', () => {
    setup([]);
    expect(screen.getByText(/No hay facturas/i)).toBeInTheDocument();
  });

  it('does not crash when the query has not resolved yet (data undefined)', () => {
    setup(undefined);
    expect(screen.getByText('Saldo pendiente')).toBeInTheDocument();
  });

  it('preserves the loading state (skeleton, not the empty message)', () => {
    setup(undefined, true);
    expect(screen.queryByText('No hay facturas.')).not.toBeInTheDocument();
  });
});
