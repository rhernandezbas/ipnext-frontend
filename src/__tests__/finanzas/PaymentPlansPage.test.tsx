import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import PaymentPlansPage from '@/pages/finanzas/PaymentPlansPage';

vi.mock('@/hooks/useDunning', () => ({
  usePaymentPlans: vi.fn(),
}));

import { usePaymentPlans } from '@/hooks/useDunning';

const mockPlans = [
  { id: '1', clientName: 'Roberto Silva', total: 12000, installments: 6, paid: 3, status: 'activo' },
  { id: '2', clientName: 'Laura Fernández', total: 8400, installments: 4, paid: 4, status: 'completado' },
];

describe('PaymentPlansPage', () => {
  beforeEach(() => {
    vi.mocked(usePaymentPlans).mockReturnValue({
      data: mockPlans,
      isLoading: false,
    } as ReturnType<typeof usePaymentPlans>);
  });

  it('renders heading "Planes de Pago"', () => {
    render(<MemoryRouter><PaymentPlansPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /planes de pago/i })).toBeInTheDocument();
  });

  it('renders client names in the table', () => {
    render(<MemoryRouter><PaymentPlansPage /></MemoryRouter>);
    expect(screen.getByText('Roberto Silva')).toBeInTheDocument();
    expect(screen.getByText('Laura Fernández')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<MemoryRouter><PaymentPlansPage /></MemoryRouter>);
    expect(screen.getByText(/cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/cuotas/i)).toBeInTheDocument();
    expect(screen.getByText(/pagadas/i)).toBeInTheDocument();
    expect(screen.getByText(/estado/i)).toBeInTheDocument();
  });
});
