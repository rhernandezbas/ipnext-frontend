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
  balance: -1500,
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  services: [],
  logs: [],
};

describe('InfoTab', () => {
  it('renders customer fields', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    expect(screen.getByText('Alice García')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Av. Corrientes 1234, CABA')).toBeInTheDocument();
  });

  // M1: OpenStreetMap iframe
  it('renders map iframe with title "Mapa de ubicación"', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    const iframe = screen.getByTitle('Mapa de ubicación');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName.toLowerCase()).toBe('iframe');
  });
});
