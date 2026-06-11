import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Admin } from '@/types/admin';

// --- Mock hooks ---
const useClientDetailMock = vi.fn();
const useClientContractsMock = vi.fn();

vi.mock('@/hooks/useCustomers', () => ({
  useClientDetail: (id: string) => useClientDetailMock(id),
  useClientContracts: (id: string, enabled: boolean) => useClientContractsMock(id, enabled),
}));

// Mock ContractInventoryReadonly — has its own hooks, keep CustomerSidebar tests focused
vi.mock(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/ContractInventoryReadonly',
  () => ({
    ContractInventoryReadonly: ({ contractId }: { contractId: string | null }) => (
      <div data-testid="contract-inventory-readonly">
        {contractId ? `Inventario de contrato ${contractId}` : 'Sin contrato asignado'}
      </div>
    ),
  }),
);

import { CustomerSidebar } from '@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar';

// --- Test fixtures ---
const admins: Admin[] = [
  { id: 'a1', name: 'Ana García', email: 'ana@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'a2', name: 'Bruno López', email: 'bruno@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

const defaultProps = {
  customerId: 'c-1',
  customerName: 'Juan Pérez',
  contractId: '42',
  reporterId: 'a1',
  watcherIds: ['a2'],
  admins,
  onWatchersChange: vi.fn().mockResolvedValue(undefined),
  isSavingWatchers: false,
};

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter>
      <CustomerSidebar {...defaultProps} {...props} />
    </MemoryRouter>,
  );
}

describe('CustomerSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: customer detail with contact info
    useClientDetailMock.mockReturnValue({
      data: { id: 'c-1', name: 'Juan Pérez', email: 'juan@test.com', phone: '1122334455', city: 'Buenos Aires' },
      isLoading: false,
    });
    // Default: contracts list with one matching contract (id = 42 → Number)
    useClientContractsMock.mockReturnValue({
      data: [
        { id: '42', plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, description: '', address: 'Av. Test 123' },
      ],
    });
  });

  // ── 3 tabs rendered in correct order ──────────────────────────────────────
  it('renders 3 tabs: Detalles, Inventario, Documentos', () => {
    renderSidebar();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent(/detalles/i);
    expect(tabs[1]).toHaveTextContent(/inventario/i);
    expect(tabs[2]).toHaveTextContent(/documentos/i);
  });

  // ── Default active tab ─────────────────────────────────────────────────────
  it('Detalles tab is active by default', () => {
    renderSidebar();
    expect(screen.getByRole('tab', { name: /detalles/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /inventario/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /documentos/i })).toHaveAttribute('aria-selected', 'false');
  });

  // ── Detalles tab renders all 4 cards ──────────────────────────────────────
  it('Detalles shows CustomerCard, ServiceCard, ReporterCard and WatchersChips', () => {
    renderSidebar();
    // CustomerCard heading
    expect(screen.getByRole('heading', { name: /cliente/i })).toBeInTheDocument();
    // ContractCard heading
    expect(screen.getByRole('heading', { name: /contrato/i })).toBeInTheDocument();
    // ReporterCard heading
    expect(screen.getByRole('heading', { name: /reporter/i })).toBeInTheDocument();
    // WatchersChips heading
    expect(screen.getByRole('heading', { name: /watchers/i })).toBeInTheDocument();
  });

  // ── Contact info from useClientDetail ─────────────────────────────────────
  it('shows email and phone from useClientDetail', () => {
    renderSidebar();
    expect(screen.getByText('juan@test.com')).toBeInTheDocument();
    expect(screen.getByText('1122334455')).toBeInTheDocument();
  });

  it('shows city from useClientDetail', () => {
    renderSidebar();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
  });

  // ── Contract plan resolved via String(id) === contractId ─────────────────
  it('shows the contract plan from useClientContracts matching String(id) === contractId', () => {
    renderSidebar();
    expect(screen.getByText('Plan 100Mbps')).toBeInTheDocument();
  });

  // ── customerId = null → hooks gated, no crash ─────────────────────────────
  it('does not crash when customerId is null', () => {
    useClientDetailMock.mockReturnValue({ data: undefined, isLoading: false });
    useClientContractsMock.mockReturnValue({ data: [] });
    renderSidebar({ customerId: null, customerName: null, contractId: null });
    // Should render without throwing; CustomerCard shows empty state
    expect(screen.getByText(/sin cliente asignado/i)).toBeInTheDocument();
  });

  it('passes enabled=false to useClientContracts when customerId is null', () => {
    useClientDetailMock.mockReturnValue({ data: undefined, isLoading: false });
    useClientContractsMock.mockReturnValue({ data: [] });
    renderSidebar({ customerId: null });
    // Hook was called with enabled=false
    // Component normalises null → '' for the hook; enabled=false so no fetch happens
    expect(useClientContractsMock).toHaveBeenCalledWith('', false);
  });

  // ── No matching service → graceful fallback ────────────────────────────────
  it('renders gracefully when no contract matches contractId', () => {
    useClientContractsMock.mockReturnValue({
      data: [
        { id: '99', plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, description: '', address: null },
      ],
    });
    renderSidebar({ contractId: '42' }); // 99 ≠ 42 → no match
    // ContractCard renders with just the ID fallback
    expect(screen.getByText(/contrato #42/i)).toBeInTheDocument();
  });

  // ── Inventory tab → ContractInventoryReadonly ─────────────────────────────
  it('Inventory tab shows ContractInventoryReadonly', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('tab', { name: /inventario/i }));
    expect(screen.getByTestId('contract-inventory-readonly')).toBeInTheDocument();
  });

  // ── Documents tab → ComingSoonPanel ───────────────────────────────────────
  it('Documents tab shows ComingSoonPanel', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('tab', { name: /documentos/i }));
    expect(screen.getByText(/documentos/i, { selector: 'h3' })).toBeInTheDocument();
  });

  // ── ARIA: switching tabs updates aria-selected ─────────────────────────────
  it('updates aria-selected when switching tabs', () => {
    renderSidebar();
    const inventoryTab = screen.getByRole('tab', { name: /inventario/i });
    fireEvent.click(inventoryTab);
    expect(inventoryTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /detalles/i })).toHaveAttribute('aria-selected', 'false');
  });

  // ── Reporter and Watcher resolved from admins ─────────────────────────────
  it('shows the reporter name from admins', () => {
    renderSidebar();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
  });

  it('shows watcher chips from admins', () => {
    renderSidebar();
    expect(screen.getByText('Bruno López')).toBeInTheDocument();
  });
});
