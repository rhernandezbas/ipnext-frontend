import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HistorialFinancieroPage from '@/pages/finanzas/HistorialFinancieroPage';
import * as useBillingModule from '@/hooks/useBilling';
import type { FinanceHistoryEvent } from '@/types/billing';

vi.mock('@/hooks/useBilling');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockEvents: FinanceHistoryEvent[] = [
  {
    id: '1',
    type: 'invoice_created',
    description: 'Factura F-001 creada',
    clientId: 'cli-001',
    clientName: 'Juan Pérez',
    amount: 6500,
    referenceId: 'inv-001',
    adminId: 'adm-001',
    adminName: 'Admin',
    occurredAt: '2024-03-01T10:00:00Z',
  },
  {
    id: '2',
    type: 'payment_received',
    description: 'Pago recibido de María González',
    clientId: 'cli-002',
    clientName: 'María González',
    amount: 7865,
    referenceId: 'pay-001',
    adminId: 'adm-001',
    adminName: 'Admin',
    occurredAt: '2024-03-05T14:00:00Z',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <HistorialFinancieroPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HistorialFinancieroPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useBillingModule.useFinanceHistory).mockReturnValue({
      data: mockEvents,
      isLoading: false,
    } as ReturnType<typeof useBillingModule.useFinanceHistory>);
  });

  it('renders "Historial" heading', () => {
    renderPage();
    const heading = screen.queryByText(/historial/i);
    expect(heading).toBeInTheDocument();
  });

  it('date filter inputs exist', () => {
    renderPage();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('type filter select exists', () => {
    renderPage();
    const select = screen.getByRole('combobox', { name: /tipo de evento/i });
    expect(select).toBeInTheDocument();
  });

  it('table shows event descriptions from mock', () => {
    renderPage();
    expect(screen.getByText('Factura F-001 creada')).toBeInTheDocument();
    expect(screen.getByText('Pago recibido de María González')).toBeInTheDocument();
  });

  it('amount column renders', () => {
    renderPage();
    expect(screen.getByText('Monto')).toBeInTheDocument();
    expect(screen.getByText('$6500.00')).toBeInTheDocument();
  });
});
