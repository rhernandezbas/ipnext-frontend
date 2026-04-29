import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MonitoringPage from '@/pages/monitoring/MonitoringPage';
import * as useMonitoringModule from '@/hooks/useMonitoring';
import type { MonitoringStats, MonitoringDevice, MonitoringAlert } from '@/types/monitoring';

vi.mock('@/hooks/useMonitoring');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockStats: MonitoringStats = {
  totalDevices: 15,
  onlineDevices: 10,
  offlineDevices: 3,
  warningDevices: 2,
  activeAlerts: 8,
  criticalAlerts: 3,
  avgLatency: 18.5,
  avgUptimePercent: 90.2,
};

const mockDevices: MonitoringDevice[] = [
  {
    id: 'dev-1',
    name: 'NAS-Central-01',
    type: 'nas',
    ipAddress: '192.168.1.1',
    status: 'online',
    coordinates: { lat: -34.603, lng: -58.381 },
    nasId: 'nas-1',
    clientId: null,
    clientName: null,
    lastSeen: new Date(Date.now() - 60_000).toISOString(),
    uptimePercent: 99.9,
    latency: 2,
    downloadMbps: 100,
    uploadMbps: 50,
    alertCount: 0,
  },
  {
    id: 'dev-2',
    name: 'CPE-Cliente-Torres',
    type: 'cpe',
    ipAddress: '10.0.0.20',
    status: 'offline',
    coordinates: { lat: -34.63, lng: -58.37 },
    nasId: 'nas-1',
    clientId: 'client-15',
    clientName: 'Ana Torres',
    lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
    uptimePercent: 72.3,
    latency: null,
    downloadMbps: null,
    uploadMbps: null,
    alertCount: 2,
  },
];

const mockAlerts: MonitoringAlert[] = [
  {
    id: 'alert-1',
    deviceId: 'dev-2',
    deviceName: 'CPE-Cliente-Torres',
    type: 'offline',
    severity: 'critical',
    message: 'Dispositivo sin respuesta por más de 1 hora',
    occurredAt: new Date(Date.now() - 3_600_000).toISOString(),
    resolvedAt: null,
    acknowledged: false,
  },
];

const mockAcknowledgeMutate = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useMonitoringModule.useMonitoringStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as ReturnType<typeof useMonitoringModule.useMonitoringStats>);

    vi.mocked(useMonitoringModule.useMonitoringDevices).mockReturnValue({
      data: mockDevices,
      isLoading: false,
    } as ReturnType<typeof useMonitoringModule.useMonitoringDevices>);

    vi.mocked(useMonitoringModule.useMonitoringAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
    } as ReturnType<typeof useMonitoringModule.useMonitoringAlerts>);

    vi.mocked(useMonitoringModule.useAcknowledgeAlert).mockReturnValue({
      mutate: mockAcknowledgeMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useMonitoringModule.useAcknowledgeAlert>);
  });

  it('renders "Monitoreo de red" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /monitoreo de red/i })).toBeInTheDocument();
  });

  it('renders summary cards (Total, En linea, Sin respuesta, Alertas)', () => {
    renderPage();
    expect(screen.getByText('Total dispositivos')).toBeInTheDocument();
    expect(screen.getByText('En linea')).toBeInTheDocument();
    expect(screen.getAllByText(/sin respuesta/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Alertas activas')).toBeInTheDocument();
  });

  it('renders device map container', () => {
    renderPage();
    expect(screen.getByTestId('device-map')).toBeInTheDocument();
  });

  it('renders alerts panel', () => {
    renderPage();
    expect(screen.getByText('Alertas')).toBeInTheDocument();
  });

  it('alert has "Reconocer" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Reconocer' })).toBeInTheDocument();
  });

  it('device table renders with device names', () => {
    renderPage();
    expect(screen.getByText('NAS-Central-01')).toBeInTheDocument();
    expect(screen.getAllByText('CPE-Cliente-Torres').length).toBeGreaterThan(0);
  });

  it('loading state shows spinner', () => {
    vi.mocked(useMonitoringModule.useMonitoringStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useMonitoringModule.useMonitoringStats>);
    vi.mocked(useMonitoringModule.useMonitoringDevices).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useMonitoringModule.useMonitoringDevices>);
    vi.mocked(useMonitoringModule.useMonitoringAlerts).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useMonitoringModule.useMonitoringAlerts>);

    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
