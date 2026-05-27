import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Admin } from '@/types/admin';

// --- Mock hooks ---
const useClientDetailMock = vi.fn();
const useClientServicesMock = vi.fn();

vi.mock('@/hooks/useCustomers', () => ({
  useClientDetail: (id: string) => useClientDetailMock(id),
  useClientServices: (id: string, enabled: boolean) => useClientServicesMock(id, enabled),
}));

import { CustomerSidebar } from '@/pages/scheduling/SchedulingTaskDetailPage/components/CustomerSidebar';

// --- Test fixtures ---
const admins: Admin[] = [
  { id: 'a1', name: 'Ana García', email: 'ana@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
  { id: 'a2', name: 'Bruno López', email: 'bruno@test.com', role: 'admin', status: 'active', createdAt: '', lastLogin: null },
];

const defaultProps = {
  customerId: 'c-1',
  customerName: 'Juan Pérez',
  serviceId: '42',
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
    // Default: services list with one matching service (id = 42 → Number)
    useClientServicesMock.mockReturnValue({
      data: [
        { id: 42, plan: 'Plan 100Mbps', type: 'internet', status: 'active', price: 3000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: 'Av. Test 123' },
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
    // ServiceCard heading
    expect(screen.getByRole('heading', { name: /servicio/i })).toBeInTheDocument();
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

  // ── Service plan resolved via String(id) === serviceId ────────────────────
  it('shows the service plan from useClientServices matching String(id) === serviceId', () => {
    renderSidebar();
    expect(screen.getByText('Plan 100Mbps')).toBeInTheDocument();
  });

  // ── customerId = null → hooks gated, no crash ─────────────────────────────
  it('does not crash when customerId is null', () => {
    useClientDetailMock.mockReturnValue({ data: undefined, isLoading: false });
    useClientServicesMock.mockReturnValue({ data: [] });
    renderSidebar({ customerId: null, customerName: null, serviceId: null });
    // Should render without throwing; CustomerCard shows empty state
    expect(screen.getByText(/sin cliente asignado/i)).toBeInTheDocument();
  });

  it('passes enabled=false to useClientServices when customerId is null', () => {
    useClientDetailMock.mockReturnValue({ data: undefined, isLoading: false });
    useClientServicesMock.mockReturnValue({ data: [] });
    renderSidebar({ customerId: null });
    // Hook was called with enabled=false
    // Component normalises null → '' for the hook; enabled=false so no fetch happens
    expect(useClientServicesMock).toHaveBeenCalledWith('', false);
  });

  // ── No matching service → graceful fallback ────────────────────────────────
  it('renders gracefully when no service matches serviceId', () => {
    useClientServicesMock.mockReturnValue({
      data: [
        { id: 99, plan: 'Plan 50Mbps', type: 'internet', status: 'active', price: 2000, startDate: '2024-01-01', endDate: null, ipAddress: null, description: '', address: null },
      ],
    });
    renderSidebar({ serviceId: '42' }); // 99 ≠ 42 → no match
    // ServiceCard renders with just the ID fallback
    expect(screen.getByText(/servicio #42/i)).toBeInTheDocument();
  });

  // ── Inventory tab → ComingSoonPanel ───────────────────────────────────────
  it('Inventory tab shows ComingSoonPanel', () => {
    renderSidebar();
    fireEvent.click(screen.getByRole('tab', { name: /inventario/i }));
    expect(screen.getByText(/inventario del cliente/i)).toBeInTheDocument();
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
