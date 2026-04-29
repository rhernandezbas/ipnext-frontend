import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FacturasPage } from '@/pages/FacturasPage/FacturasPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { Invoice } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockInvoice: Invoice = {
  id: 1,
  number: 'F-001',
  customerId: 42,
  customerName: 'Alice García',
  amount: 5000,
  tax: 1050,
  total: 6050,
  status: 'paid',
  issuedAt: '2024-01-01',
  dueAt: '2024-01-31',
  paidAt: '2024-01-15',
  items: [
    { id: 1, description: 'Plan 50MB', quantity: 1, unitPrice: 5000, total: 5000 },
  ],
};

function renderFacturas() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<FacturasPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FacturasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBillingModule.useInvoices).mockReturnValue({
      data: { data: [mockInvoice], total: 1 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useInvoices>);
    vi.mocked(useBillingModule.useCreateInvoice).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useBillingModule.useCreateInvoice>);
    vi.mocked(useBillingModule.useSendInvoiceEmail).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingModule.useSendInvoiceEmail>);
  });

  it('renders page title', () => {
    renderFacturas();
    expect(screen.getByRole('heading', { name: 'Facturas' })).toBeInTheDocument();
  });

  it('renders invoice rows', () => {
    renderFacturas();
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('$6050.00')).toBeInTheDocument();
  });

  it('renders Estado filter dropdown', () => {
    renderFacturas();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('renders date filters', () => {
    renderFacturas();
    expect(screen.getByText('Desde')).toBeInTheDocument();
    expect(screen.getByText('Hasta')).toBeInTheDocument();
  });

  it('shows invoice detail drawer on "Ver detalle" click', async () => {
    const user = userEvent.setup();
    renderFacturas();

    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));

    expect(screen.getByText('Factura #F-001')).toBeInTheDocument();
    expect(screen.getByText('Plan 50MB')).toBeInTheDocument();
  });

  it('closes drawer when ✕ is clicked', async () => {
    const user = userEvent.setup();
    renderFacturas();

    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));
    expect(screen.getByText('Factura #F-001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText('Factura #F-001')).not.toBeInTheDocument();
  });

  it('passes status filter to useInvoices', () => {
    renderFacturas();
    fireEvent.change(screen.getByRole('combobox', { name: 'Estado' }), {
      target: { value: 'overdue' },
    });
    const calls = vi.mocked(useBillingModule.useInvoices).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('overdue');
  });

  it('shows empty message when no invoices', () => {
    vi.mocked(useBillingModule.useInvoices).mockReturnValue({
      data: { data: [], total: 0 },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useInvoices>);
    renderFacturas();
    expect(screen.getByText('No hay facturas.')).toBeInTheDocument();
  });

  it('renders issuedAt date in Argentine locale format (dd/mm/yyyy)', () => {
    renderFacturas();
    // mockInvoice has issuedAt: '2024-01-01' → should render as 1/1/2024 or 01/01/2024
    // dueAt: '2024-01-31' → 31/1/2024, so we match the issuedAt cell precisely
    const cells = screen.getAllByRole('cell');
    const dateCell = cells.find((c) => /^1\/1\/2024$|^01\/01\/2024$/.test(c.textContent ?? ''));
    expect(dateCell).toBeInTheDocument();
  });

  // T1: totals row
  it('renders a totals row in tfoot', () => {
    renderFacturas();
    const tfoot = document.querySelector('tfoot');
    expect(tfoot).toBeInTheDocument();
  });

  it('totals row shows count of invoices', () => {
    renderFacturas();
    expect(screen.getByText('1 facturas')).toBeInTheDocument();
  });

  // E1: Export button
  it('has an "Exportar" button', () => {
    renderFacturas();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  // Nueva factura
  it('has a "Nueva factura" button', () => {
    renderFacturas();
    expect(screen.getByRole('button', { name: 'Nueva factura' })).toBeInTheDocument();
  });

  it('clicking "Nueva factura" shows the modal form', async () => {
    const user = userEvent.setup();
    renderFacturas();
    await user.click(screen.getByRole('button', { name: 'Nueva factura' }));
    expect(screen.getByRole('heading', { name: 'Nueva factura' })).toBeInTheDocument();
  });

  it('modal form has customerName, issuedAt, dueAt, total fields', async () => {
    const user = userEvent.setup();
    renderFacturas();
    await user.click(screen.getByRole('button', { name: 'Nueva factura' }));
    expect(document.getElementById('customerName')).toBeInTheDocument();
    expect(document.getElementById('issuedAt')).toBeInTheDocument();
    expect(document.getElementById('dueAt')).toBeInTheDocument();
    expect(document.getElementById('total')).toBeInTheDocument();
  });

  it('drawer shows "Descargar PDF" and "Enviar por email" buttons when invoice is selected', async () => {
    const user = userEvent.setup();
    renderFacturas();

    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ver detalle' }));

    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar por email' })).toBeInTheDocument();
  });

  it('"Cancelar" closes the modal', async () => {
    const user = userEvent.setup();
    renderFacturas();
    await user.click(screen.getByRole('button', { name: 'Nueva factura' }));
    expect(screen.getByRole('heading', { name: 'Nueva factura' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { name: 'Nueva factura' })).not.toBeInTheDocument();
  });
});
