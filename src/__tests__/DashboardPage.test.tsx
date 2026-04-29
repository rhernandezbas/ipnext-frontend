import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DashboardPage from '@/pages/DashboardPage/DashboardPage';
import * as useDashboardModule from '@/hooks/useDashboard';
import type { DashboardStats, DashboardShortcut, RecentActivity } from '@/types/dashboard';

vi.mock('@/hooks/useDashboard');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockStats: DashboardStats = {
  newClientsThisMonth: 131,
  activeClients: 1843,
  openTickets: 57,
  pendingTickets: 23,
  unresponsiveDevices: 12,
  onlineDevices: 248,
  revenueThisMonth: 4850000,
  unpaidInvoices: 89,
  overdueInvoices: 34,
  cpuUsage: 23,
  ramUsage: 61,
  diskUsage: 45,
  uptime: '15 días, 4 horas',
};

const mockShortcuts: DashboardShortcut[] = [
  { id: '1', label: 'Nuevo cliente', icon: '👤', href: '/admin/crm/clientes', color: '#2563eb' },
  { id: '2', label: 'Nuevo ticket', icon: '🎫', href: '/admin/crm/tickets/new', color: '#f59e0b' },
];

const mockActivity: RecentActivity[] = [
  {
    id: '1',
    type: 'client_added',
    description: 'Nuevo cliente: María González agregada',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    link: '/admin/crm/clientes',
  },
  {
    id: '2',
    type: 'ticket_opened',
    description: 'Ticket #1042 abierto',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    link: '/admin/crm/tickets',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDashboardModule.useDashboardStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as ReturnType<typeof useDashboardModule.useDashboardStats>);

    vi.mocked(useDashboardModule.useDashboardShortcuts).mockReturnValue({
      data: mockShortcuts,
      isLoading: false,
    } as ReturnType<typeof useDashboardModule.useDashboardShortcuts>);

    vi.mocked(useDashboardModule.useRecentActivity).mockReturnValue({
      data: mockActivity,
      isLoading: false,
    } as ReturnType<typeof useDashboardModule.useRecentActivity>);
  });

  it('renders "Panel de control" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Panel de control' })).toBeInTheDocument();
  });

  it('renders active clients KPI card', () => {
    renderPage();
    expect(screen.getByText('1.843')).toBeInTheDocument();
    expect(screen.getByText('Clientes online')).toBeInTheDocument();
  });

  it('renders open tickets KPI card', () => {
    renderPage();
    expect(screen.getByText('57')).toBeInTheDocument();
    expect(screen.getByText('Tickets nuevos/abiertos')).toBeInTheDocument();
  });

  it('renders recent activity feed', () => {
    renderPage();
    expect(screen.getByText('Nuevo cliente: María González agregada')).toBeInTheDocument();
    expect(screen.getByText('Ticket #1042 abierto')).toBeInTheDocument();
  });

  it('renders CPU usage progress bar', () => {
    renderPage();
    expect(screen.getByLabelText('CPU usage progress bar')).toBeInTheDocument();
  });

  it('renders RAM usage', () => {
    renderPage();
    expect(screen.getByText('61%')).toBeInTheDocument();
  });

  it('renders shortcuts section', () => {
    renderPage();
    expect(screen.getByText('Nuevo cliente')).toBeInTheDocument();
    expect(screen.getByText('Nuevo ticket')).toBeInTheDocument();
  });

  it('loading state shows skeleton/spinner', () => {
    vi.mocked(useDashboardModule.useDashboardStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useDashboardModule.useDashboardStats>);

    const { container } = renderPage();
    // KPI skeleton divs are rendered when loading
    const kpiGrid = container.querySelector('[aria-label="KPI cards"]');
    expect(kpiGrid).toBeInTheDocument();
    expect(kpiGrid!.children.length).toBe(4);
  });
});
