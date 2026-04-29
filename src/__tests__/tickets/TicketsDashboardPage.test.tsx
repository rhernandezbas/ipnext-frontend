import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketsDashboardPage from '@/pages/tickets/TicketsDashboardPage';
import * as useTicketsModule from '@/hooks/useTickets';
import type { Ticket } from '@/types/ticket';

vi.mock('@/hooks/useTickets');

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  Legend: () => null,
}));

const mockTickets: Ticket[] = [
  {
    id: 1,
    subject: 'No hay internet',
    message: 'Sin conexión',
    status: 'open',
    priority: 'high',
    type: null,
    customerId: 1,
    customerName: 'Alice García',
    assignedTo: 1,
    assignedToName: 'Admin',
    reporter: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    resolvedAt: null,
    tags: [],
  },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/tickets']}>
        <Routes>
          <Route path="/admin/tickets" element={<TicketsDashboardPage />} />
          <Route path="/admin/tickets/new" element={<div>Nuevo Ticket</div>} />
          <Route path="/admin/tickets/opened" element={<div>Lista Tickets</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketsModule.useTicketStats).mockReturnValue({
      data: { open: 5, pending: 3, resolved: 12, closed: 8, total: 28, avgResolutionTimeHours: 4.5, closedToday: 7, avgResolutionTime: '4h 30m', unassigned: 2 },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicketStats>);
    vi.mocked(useTicketsModule.useTicketList).mockReturnValue({
      data: { data: mockTickets, total: 1, page: 1, pageSize: 25, totalPages: 1 },
      isLoading: false,
    } as ReturnType<typeof useTicketsModule.useTicketList>);
  });

  it('renders page title', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
  });

  it('renders Nuevo Ticket button', () => {
    renderDashboard();
    expect(screen.getByRole('button', { name: 'Nuevo Ticket' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useTicketsModule.useTicketStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketsModule.useTicketStats>);
    renderDashboard();
    expect(screen.getByText('Cargando estadísticas...')).toBeInTheDocument();
  });

  it('renders stats cards with correct values', () => {
    renderDashboard();
    expect(screen.getByTestId('kpi-open')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-closedToday')).toHaveTextContent('7');
    expect(screen.getByTestId('kpi-avgResolutionTime')).toHaveTextContent('4h 30m');
    expect(screen.getByTestId('kpi-unassigned')).toHaveTextContent('2');
    expect(screen.getByText('Tickets abiertos')).toBeInTheDocument();
    expect(screen.getByText('Cerrados hoy')).toBeInTheDocument();
    expect(screen.getByText('Tiempo prom. resolución')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('navigates to Nuevo Ticket on button click', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: 'Nuevo Ticket' }));
    expect(screen.getByText('Nuevo Ticket')).toBeInTheDocument();
  });

  it('navigates to tickets list on "Ver todos" click', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /ver todos/i }));
    expect(screen.getByText('Lista Tickets')).toBeInTheDocument();
  });

  it('renders "Asignado a mí" table heading', () => {
    renderDashboard();
    expect(screen.getByText('Asignado a mí')).toBeInTheDocument();
  });

  it('renders "Asignados a administradores" table heading', () => {
    renderDashboard();
    expect(screen.getByText('Asignados a administradores')).toBeInTheDocument();
  });

  it('assignment tables show expected column headers', () => {
    renderDashboard();
    // Both tables share same column names; getAllByText handles multiples
    expect(screen.getAllByRole('columnheader', { name: 'ID' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: 'Asunto' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: 'Estado' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Estadísticas section heading', () => {
    renderDashboard();
    expect(screen.getByText('Estadísticas')).toBeInTheDocument();
  });

  it('renders "Tickets abiertos" KPI card with value from stats', () => {
    renderDashboard();
    expect(screen.getByText('Tickets abiertos')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-open')).toHaveTextContent('5');
  });

  it('renders "Cerrados hoy" KPI card with value from stats', () => {
    renderDashboard();
    expect(screen.getByText('Cerrados hoy')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-closedToday')).toHaveTextContent('7');
  });

  it('renders "Tiempo promedio resolución" KPI card with value from stats', () => {
    renderDashboard();
    expect(screen.getByText('Tiempo prom. resolución')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-avgResolutionTime')).toHaveTextContent('4h 30m');
  });

  it('renders "Sin asignar" KPI card with value from stats', () => {
    renderDashboard();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-unassigned')).toHaveTextContent('2');
  });

  it('renders "Tickets recientes" section heading', () => {
    renderDashboard();
    expect(screen.getByText('Tickets recientes')).toBeInTheDocument();
  });

  it('renders "Por categoría" section heading', () => {
    renderDashboard();
    expect(screen.getByText('Por categoría')).toBeInTheDocument();
  });

  it('renders BarChart for ticket stats', () => {
    renderDashboard();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders date range inputs Desde and Hasta', () => {
    renderDashboard();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  });
});
