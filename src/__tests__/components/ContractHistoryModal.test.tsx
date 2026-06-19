import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContractHistoryModal } from '@/components/molecules/ContractHistoryModal';
import type { Contract } from '@/types/customer';

vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
}));

import { useClientContracts } from '@/hooks/useCustomers';

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c1',
    code: '12345',
    name: 'Contrato hogar',
    type: 'internet',
    plan: 'Fibra 100MB',
    status: 'active',
    price: 5000,
    startDate: '2025-01-15T00:00:00Z',
    endDate: null,
    ip: '10.0.0.5',
    description: '',
    address: 'Av. Siempreviva 742',
    lat: null,
    lng: null,
    technology: 'FTTH',
    services: [],
    ...overrides,
  };
}

function mockContracts(data: Contract[], isLoading = false) {
  vi.mocked(useClientContracts).mockReturnValue({
    data,
    isLoading,
  } as unknown as ReturnType<typeof useClientContracts>);
}

describe('ContractHistoryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when closed', () => {
    mockContracts([]);
    render(<ContractHistoryModal open={false} clientId="cli1" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the client contracts with title, plan, code and address', () => {
    mockContracts([makeContract()]);
    render(<ContractHistoryModal open clientId="cli1" clientName="Juan Mosca" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Juan Mosca')).toBeInTheDocument();
    expect(screen.getByText('Contrato hogar')).toBeInTheDocument();
    expect(screen.getByText('Fibra 100MB')).toBeInTheDocument();
    expect(screen.getByText('#12345')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempreviva 742')).toBeInTheDocument();
  });

  it('shows an honest fallback when a contract has no address', () => {
    mockContracts([makeContract({ address: null })]);
    render(<ContractHistoryModal open clientId="cli1" onClose={vi.fn()} />);
    expect(screen.getByText('Sin domicilio registrado')).toBeInTheDocument();
  });

  it('shows a loading message while fetching', () => {
    mockContracts([], true);
    render(<ContractHistoryModal open clientId="cli1" onClose={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows an empty message when the client has no contracts', () => {
    mockContracts([]);
    render(<ContractHistoryModal open clientId="cli1" onClose={vi.fn()} />);
    expect(screen.getByText(/no tiene contratos/i)).toBeInTheDocument();
  });
});
