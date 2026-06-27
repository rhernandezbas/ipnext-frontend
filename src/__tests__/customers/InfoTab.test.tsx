import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InfoTab } from '@/pages/customers/tabs/InfoTab';
import type { Customer } from '@/types/customer';

const mockCustomer: Customer = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active',
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  logs: [],
  contracts: [],
};

describe('InfoTab', () => {
  it('renders customer fields', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    // Fields are rendered as read-only inputs — assert via displayValue
    expect(screen.getByDisplayValue('Alice García')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('Av. Corrientes 1234, CABA')).toBeInTheDocument();
  });

  // M1: OpenStreetMap iframe was removed from this component — test removed

  it('renders "Bajas" for a baja customer status', () => {
    const customer: Customer = { ...mockCustomer, status: 'baja' };
    render(<InfoTab customer={customer} active={true} />);
    expect(screen.getByText('Bajas')).toBeInTheDocument();
  });

  it('renders "Incobrable" (GR label) for a blocked customer status', () => {
    const customer: Customer = { ...mockCustomer, status: 'blocked' };
    render(<InfoTab customer={customer} active={true} />);
    expect(screen.getByText('Incobrable')).toBeInTheDocument();
  });
});

describe('InfoTab — BalanceCard (gr-client-balance-sync)', () => {
  it('shows formatted ARS amount and "Deudor" badge when balanceDue > 0', () => {
    const customer: Customer = {
      ...mockCustomer,
      balanceDue: 65722.07,
      balanceOverdue: 30000,
      invoicesQty: 3,
    };
    render(<InfoTab customer={customer} active={true} />);

    // Badge
    expect(screen.getByText('Deudor')).toBeInTheDocument();

    // Amount formatted in es-AR: $ 65.722,07
    const amountEl = screen.getByTestId('balance-amount');
    expect(amountEl).toBeInTheDocument();
    // Intl.NumberFormat output may vary slightly by locale/env — check key parts
    expect(amountEl.textContent).toMatch(/65[.,]722/);
    expect(amountEl.textContent).toMatch(/07/);

    // Overdue
    const overdueEl = screen.getByTestId('balance-overdue');
    expect(overdueEl.textContent).toMatch(/30[.,]000/);

    // Invoices qty
    expect(screen.getByTestId('balance-invoices-qty')).toHaveTextContent('3');
  });

  it('shows "Sin deuda" when balanceDue is null', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: null };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-no-debt')).toBeInTheDocument();
    expect(screen.getByTestId('balance-no-debt').textContent).toContain('Sin deuda');
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('shows "Sin deuda" when balanceDue is 0', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 0 };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-no-debt')).toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('shows "Sin deuda" when balanceDue is not present', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    expect(screen.getByTestId('balance-no-debt')).toBeInTheDocument();
  });

  it('shows lastBalanceAt as relative time when provided', () => {
    const recentDate = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, lastBalanceAt: recentDate };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByText(/Actualizado hace/)).toBeInTheDocument();
  });

  it('does not show overdue row when balanceOverdue is 0', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 5000, balanceOverdue: 0 };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByTestId('balance-overdue')).not.toBeInTheDocument();
  });
});
