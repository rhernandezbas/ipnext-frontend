import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { CustomerCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerCard';
import { ServiceCard } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ServiceCard';
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
});

describe('ServiceCard', () => {
  it('shows service link when serviceId and customerId present', () => {
    render(
      <MemoryRouter>
        <ServiceCard serviceId="srv-1" customerId="cust-1" />
      </MemoryRouter>
    );
    expect(screen.getByText('srv-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver servicio/i })).toBeInTheDocument();
  });

  it('shows empty state when serviceId is null', () => {
    render(
      <MemoryRouter>
        <ServiceCard serviceId={null} customerId={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/sin servicio/i)).toBeInTheDocument();
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
