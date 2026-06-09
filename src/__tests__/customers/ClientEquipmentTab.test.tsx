/**
 * ClientEquipmentTab — B2 component tests (EPIC #38 W2).
 * Strict TDD: written BEFORE the implementation.
 *
 * Read-only, aggregated equipment view grouped by contract. Active items are
 * shown prominently; removed/replaced are dimmed. Empty state when there are
 * no items.
 */
import { render, screen, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useServiceInventory', () => ({
  useClientInstalledItems: vi.fn(),
}));

import { useClientInstalledItems } from '@/hooks/useServiceInventory';
import { ClientEquipmentTab } from '@/pages/customers/tabs/ClientEquipmentTab';
import type { ClientInstalledItem } from '@/types/serviceInventory';

const mockHook = useClientInstalledItems as unknown as ReturnType<typeof vi.fn>;

function item(over: Partial<ClientInstalledItem> = {}): ClientInstalledItem {
  return {
    id: 'cii-1',
    type: 'ONU',
    serialNumber: 'SN-001',
    mac: 'AA:BB:CC:00:11:22',
    model: 'HG8245',
    status: 'active',
    source: 'MANUAL',
    confirmedAt: '2026-05-01T00:00:00.000Z',
    assetId: null,
    contractId: 'contract-1',
    contractPlan: 'Plan 50MB',
    contractType: 'fiber',
    ...over,
  };
}

function mockData(data: ClientInstalledItem[], isLoading = false) {
  mockHook.mockReturnValue({ data, isLoading });
}

describe('ClientEquipmentTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when the client has no equipment', () => {
    mockData([]);
    render(<ClientEquipmentTab clientId="client-1" />);
    expect(screen.getByText(/sin equipos/i)).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    mockData([], true);
    render(<ClientEquipmentTab clientId="client-1" />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('groups items by contract, one group header per contract showing plan + type', () => {
    mockData([
      item({ id: 'a', contractId: 'c1', contractPlan: 'Plan 50MB', contractType: 'fiber' }),
      item({ id: 'b', contractId: 'c1', contractPlan: 'Plan 50MB', contractType: 'fiber', serialNumber: 'SN-002' }),
      item({ id: 'c', contractId: 'c2', contractPlan: 'Plan 300MB', contractType: 'wireless', serialNumber: 'SN-003' }),
    ]);
    render(<ClientEquipmentTab clientId="client-1" />);

    const groups = screen.getAllByRole('group');
    expect(groups).toHaveLength(2);

    // Group headers carry the plan + type
    expect(screen.getByText('Plan 50MB')).toBeInTheDocument();
    expect(screen.getByText('Plan 300MB')).toBeInTheDocument();
    expect(screen.getByText(/fiber/i)).toBeInTheDocument();
    expect(screen.getByText(/wireless/i)).toBeInTheDocument();
  });

  it('renders each item row with its serial number', () => {
    mockData([
      item({ id: 'a', serialNumber: 'SN-001' }),
      item({ id: 'b', contractId: 'contract-1', serialNumber: 'SN-002' }),
    ]);
    render(<ClientEquipmentTab clientId="client-1" />);
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('SN-002')).toBeInTheDocument();
  });

  it('renders a status badge per item; removed/replaced rows are dimmed', () => {
    mockData([
      item({ id: 'a', serialNumber: 'SN-A', status: 'active' }),
      item({ id: 'b', serialNumber: 'SN-B', status: 'removed' }),
      item({ id: 'c', serialNumber: 'SN-C', status: 'replaced' }),
    ]);
    render(<ClientEquipmentTab clientId="client-1" />);

    // A badge with each status label is rendered
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();
    expect(screen.getByText('replaced')).toBeInTheDocument();

    // Dimmed rows are flagged via data-status so styling can target them
    const removedRow = screen.getByText('SN-B').closest('[data-status]');
    expect(removedRow).toHaveAttribute('data-status', 'removed');
    const replacedRow = screen.getByText('SN-C').closest('[data-status]');
    expect(replacedRow).toHaveAttribute('data-status', 'replaced');
    const activeRow = screen.getByText('SN-A').closest('[data-status]');
    expect(activeRow).toHaveAttribute('data-status', 'active');
  });

  it('shows an em-dash for missing optional fields', () => {
    mockData([item({ serialNumber: null, mac: null, model: null })]);
    render(<ClientEquipmentTab clientId="client-1" />);
    // At least one placeholder dash rendered for the null columns
    const group = screen.getByRole('group');
    expect(within(group).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
