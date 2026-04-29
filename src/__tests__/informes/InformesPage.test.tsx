import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InformesPage from '@/pages/informes/InformesPage';
import * as useReportsModule from '@/hooks/useReports';
import type { ReportDefinition } from '@/types/report';

vi.mock('@/hooks/useReports');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockDefinitions: ReportDefinition[] = [
  {
    id: 'rpt-clients-by-status',
    type: 'clients_by_status',
    category: 'clients',
    name: 'Clientes por estado',
    description: 'Distribución de clientes según su estado actual.',
    filters: [{ key: 'date', label: 'Fecha', type: 'date', required: false }],
  },
  {
    id: 'rpt-clients-by-plan',
    type: 'clients_by_plan',
    category: 'clients',
    name: 'Clientes por plan',
    description: 'Suscriptores agrupados por plan.',
    filters: [],
  },
  {
    id: 'rpt-revenue-by-period',
    type: 'revenue_by_period',
    category: 'finance',
    name: 'Ingresos por período',
    description: 'Facturación por período.',
    filters: [
      {
        key: 'period', label: 'Período', type: 'select', required: true,
        options: [{ value: 'monthly', label: 'Mensual' }],
      },
    ],
  },
  {
    id: 'rpt-device-uptime',
    type: 'device_uptime',
    category: 'network',
    name: 'Disponibilidad de dispositivos',
    description: 'Uptime por dispositivo.',
    filters: [],
  },
];

const mockGenerateMutate = vi.fn();
const mockExportMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <InformesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InformesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useReportsModule.useReportDefinitions).mockReturnValue({
      data: mockDefinitions,
      isLoading: false,
    } as ReturnType<typeof useReportsModule.useReportDefinitions>);

    vi.mocked(useReportsModule.useGenerateReport).mockReturnValue({
      mutateAsync: mockGenerateMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useReportsModule.useGenerateReport>);

    vi.mocked(useReportsModule.useExportReport).mockReturnValue({
      mutateAsync: mockExportMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useReportsModule.useExportReport>);
  });

  it('renders "Informes" heading', () => {
    renderPage();
    expect(screen.getByText(/informes/i)).toBeInTheDocument();
  });

  it('shows report categories in left panel: "Clientes", "Finanzas", "Red"', () => {
    renderPage();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
  });

  it('clicking a category expands its report list', async () => {
    const user = userEvent.setup();
    renderPage();

    // Finanzas is collapsed by default — click to expand
    const finanzasBtn = screen.getByRole('button', { name: /finanzas/i });
    await user.click(finanzasBtn);

    expect(screen.getByText('Ingresos por período')).toBeInTheDocument();
  });

  it('clicking a report type shows its title in right panel', async () => {
    const user = userEvent.setup();
    renderPage();

    // Clientes is open by default — click a report
    await user.click(screen.getByText('Clientes por estado'));

    expect(screen.getByRole('heading', { name: 'Clientes por estado' })).toBeInTheDocument();
  });

  it('right panel shows filter form for selected report', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Clientes por estado'));

    // The filter label "Fecha" should be visible
    expect(screen.getByText('Fecha')).toBeInTheDocument();
  });

  it('"Generar informe" button exists after selecting a report', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Clientes por estado'));

    expect(screen.getByRole('button', { name: /generar informe/i })).toBeInTheDocument();
  });

  it('"Exportar CSV" button exists after selecting a report', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('Clientes por estado'));

    expect(screen.getByRole('button', { name: /exportar csv/i })).toBeInTheDocument();
  });

  it('empty state shows when no report selected', () => {
    renderPage();

    expect(
      screen.getByText(/seleccioná un informe del menú para comenzar/i)
    ).toBeInTheDocument();
  });
});
