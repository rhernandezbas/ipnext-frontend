import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { CustomerCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerCard';
import { ContractCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ContractCard';
import { ReporterCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ReporterCard';
import type { Admin } from '@/types/admin';

const admins: Admin[] = [
  { id: 'admin-1', name: 'María González', email: 'm@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

describe('CustomerCard', () => {
  it('shows customer name and link when customerId present', () => {
    render(
      <MemoryRouter>
        <CustomerCard customerId="cust-1" customerName="Pérez, Juan" />
      </MemoryRouter>
    );
    expect(screen.getByText('Pérez, Juan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver perfil/i })).toHaveAttribute(
      'href',
      '/admin/customers/view/cust-1'
    );
  });

  it('shows empty state when customerId is null', () => {
    render(
      <MemoryRouter>
        <CustomerCard customerId={null} customerName={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin cliente asignado/i)).toBeInTheDocument();
  });

  it('renders email as a mailto link', () => {
    render(
      <MemoryRouter>
        <CustomerCard
          customerId="cust-1"
          customerName="Pérez, Juan"
          email="juan@example.com"
        />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /juan@example\.com/i });
    expect(link).toHaveAttribute('href', 'mailto:juan@example.com');
  });

  it('renders phone as a tel link', () => {
    render(
      <MemoryRouter>
        <CustomerCard
          customerId="cust-1"
          customerName="Pérez, Juan"
          phone="+5491155551234"
        />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /\+5491155551234/i });
    expect(link).toHaveAttribute('href', 'tel:+5491155551234');
  });

  it('renders city as plain text', () => {
    render(
      <MemoryRouter>
        <CustomerCard
          customerId="cust-1"
          customerName="Pérez, Juan"
          customerCity="Buenos Aires"
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
  });

  it('shows placeholder "—" for contact rows when isLoadingContact is true', () => {
    render(
      <MemoryRouter>
        <CustomerCard
          customerId="cust-1"
          customerName="Pérez, Juan"
          isLoadingContact
        />
      </MemoryRouter>
    );
    // Three rows (email, phone, city) each show "—" while loading
    const placeholders = screen.getAllByText('—');
    expect(placeholders.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "Sin dato" for null contact fields after load', () => {
    render(
      <MemoryRouter>
        <CustomerCard
          customerId="cust-1"
          customerName="Pérez, Juan"
          email={null}
          phone={null}
          customerCity={null}
          isLoadingContact={false}
        />
      </MemoryRouter>
    );
    const sinDato = screen.getAllByText('Sin dato');
    expect(sinDato.length).toBeGreaterThanOrEqual(3);
  });

  it('does not crash when customerId is null and contact props are omitted', () => {
    render(
      <MemoryRouter>
        <CustomerCard customerId={null} customerName={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin cliente asignado/i)).toBeInTheDocument();
  });
});

describe('ContractCard', () => {
  it('shows contract link when contractId and customerId present (no contract detail)', () => {
    render(
      <MemoryRouter>
        <ContractCard contractId="srv-1" customerId="cust-1" contract={null} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /ver contrato/i })).toBeInTheDocument();
  });

  it('shows empty state when contractId is null', () => {
    render(
      <MemoryRouter>
        <ContractCard contractId={null} customerId={null} contract={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin contrato/i)).toBeInTheDocument();
  });

  it('renders plan as primary text and type as muted secondary when contract is resolved', () => {
    render(
      <MemoryRouter>
        <ContractCard
          contractId="srv-1"
          customerId="cust-1"
          contract={{ plan: '300MB', type: 'internet' }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('300MB')).toBeInTheDocument();
    expect(screen.getByText('internet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver contrato/i })).toBeInTheDocument();
  });

  it('shows "—" placeholder when isLoading is true', () => {
    render(
      <MemoryRouter>
        <ContractCard
          contractId="srv-1"
          customerId="cust-1"
          contract={null}
          isLoading
        />
      </MemoryRouter>
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows graceful fallback "Contrato #<id>" when contract is null but contractId is set', () => {
    render(
      <MemoryRouter>
        <ContractCard contractId="42" customerId="cust-1" contract={null} isLoading={false} />
      </MemoryRouter>
    );
    expect(screen.getByText(/contrato #42/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver contrato/i })).toBeInTheDocument();
  });

  it('shows graceful empty state when both contract and contractId are null', () => {
    render(
      <MemoryRouter>
        <ContractCard contractId={null} customerId={null} contract={null} isLoading={false} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin contrato/i)).toBeInTheDocument();
  });
});

describe('ReporterCard', () => {
  it('shows reporter name resolved from admin list', () => {
    render(
      <MemoryRouter>
        <ReporterCard reporterId="admin-1" allAdmins={admins} />
      </MemoryRouter>
    );
    expect(screen.getByText('María González')).toBeInTheDocument();
  });

  it('shows empty state when reporterId is null', () => {
    render(
      <MemoryRouter>
        <ReporterCard reporterId={null} allAdmins={admins} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin reporter/i)).toBeInTheDocument();
  });
});
