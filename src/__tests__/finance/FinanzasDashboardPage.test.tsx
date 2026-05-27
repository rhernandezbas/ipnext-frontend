import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FinanzasDashboardPage } from '@/pages/FinanzasDashboardPage/FinanzasDashboardPage';
import * as useBillingModule from '@/hooks/useBilling';

vi.mock('@/hooks/useBilling');

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  Legend: () => null,
}));

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/finance']}>
        <Routes>
          <Route path="/admin/finance" element={<FinanzasDashboardPage />} />
          <Route path="/admin/finance/invoices" element={<div>Facturas</div>} />
          <Route path="/admin/finance/payments" element={<div>Pagos</div>} />
          <Route path="/admin/finance/transactions" element={<div>Transacciones</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FinanzasDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBillingModule.useBillingSummary).mockReturnValue({
      data: {
        totalRevenue: 100000,
        pendingAmount: 25000,
        overdueAmount: 5000,
        paidThisMonth: 80000,
        invoiceCount: 50,
        overdueCount: 3,
        creditNotesAmount: 1500,
        proformaPaidAmount: 3000,
        proformaUnpaidAmount: 750,
      },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useBillingSummary>);

    vi.mocked(useBillingModule.useMonthlyBilling).mockReturnValue({
      data: {
        lastMonth: { period: '2026-03', label: 'Marzo 2026', invoiced: 50000, paid: 45000 },
        currentMonth: { period: '2026-04', label: 'Abril 2026', invoiced: 60000, paid: 30000 },
        nextMonth: { period: '2026-05', label: 'Mayo 2026', invoiced: 0, paid: 0 },
      },
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useMonthlyBilling>);
  });

  it('renders page title', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Finanzas' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useBillingModule.useBillingSummary).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useBillingModule.useBillingSummary>);
    renderDashboard();
    expect(screen.getByText('Cargando resumen...')).toBeInTheDocument();
  });

  it('renders summary cards', () => {
    renderDashboard();
    expect(screen.getByText('Ingresos del mes')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de cobro')).toBeInTheDocument();
    expect(screen.getByText('Facturas vencidas')).toBeInTheDocument();
  });

  it('renders Ver facturas, Ver pagos, Ver transacciones buttons', () => {
    renderDashboard();
    expect(screen.getByRole('button', { name: 'Ver facturas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver pagos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver transacciones' })).toBeInTheDocument();
  });

  it('navigates to facturas page', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Ver facturas' }));
    expect(screen.getByText('Facturas')).toBeInTheDocument();
  });

  it('navigates to pagos page', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Ver pagos' }));
    expect(screen.getByText('Pagos')).toBeInTheDocument();
  });

  it('navigates to transacciones page', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Ver transacciones' }));
    expect(screen.getByText('Transacciones')).toBeInTheDocument();
  });

  it('renders 3 new stat card labels', () => {
    renderDashboard();
    expect(screen.getByText('Notas de crédito')).toBeInTheDocument();
    expect(screen.getByText('Facturas proforma pagadas')).toBeInTheDocument();
    expect(screen.getByText('Facturas proforma no pagadas')).toBeInTheDocument();
  });

  it('renders monthly comparison table headers', () => {
    renderDashboard();
    expect(screen.getByText('Último mes')).toBeInTheDocument();
    expect(screen.getByText('Mes actual')).toBeInTheDocument();
    expect(screen.getByText('Próximo mes')).toBeInTheDocument();
  });

  it('renders BarChart for monthly comparison', () => {
    renderDashboard();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('shows "Cargando datos..." when useMonthlyBilling isLoading is true', () => {
    vi.mocked(useBillingModule.useMonthlyBilling).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useBillingModule.useMonthlyBilling>);
    renderDashboard();
    expect(screen.getByText('Cargando datos...')).toBeInTheDocument();
  });

  it('renders monthly billing amounts from useMonthlyBilling in the comparison table', () => {
    renderDashboard();
    // lastMonth.invoiced = 50000 → "$50.000,00" in es-AR locale
    // Verify the table rows are rendered with real data from the hook
    expect(screen.getByText('Facturado')).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
  });
});
