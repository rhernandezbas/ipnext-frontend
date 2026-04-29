import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as CpePage } from '@/pages/empresa/CpePage';
import * as useCpeModule from '@/hooks/useCpe';
import type { CpeDevice } from '@/types/cpe';

vi.mock('@/hooks/useCpe');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockDevices: CpeDevice[] = [
  {
    id: '1',
    serialNumber: 'SN-ROT-001',
    model: 'hAP ac2',
    manufacturer: 'MikroTik',
    type: 'router',
    macAddress: 'AA:BB:CC:11:22:33',
    ipAddress: '192.168.100.10',
    status: 'online',
    clientId: 'c-01',
    clientName: 'Juan Pérez',
    nasId: '1',
    networkSiteId: '1',
    firmwareVersion: '7.11',
    lastSeen: '2026-04-28T09:00:00Z',
    signal: null,
    connectedAt: '2026-04-01T08:00:00Z',
    description: 'Router hogar',
  },
  {
    id: '2',
    serialNumber: 'SN-ONU-001',
    model: 'HG8310M',
    manufacturer: 'Huawei',
    type: 'onu',
    macAddress: 'AA:BB:CC:11:22:44',
    ipAddress: null,
    status: 'offline',
    clientId: null,
    clientName: null,
    nasId: null,
    networkSiteId: null,
    firmwareVersion: 'V3R017',
    lastSeen: null,
    signal: -18,
    connectedAt: null,
    description: 'ONU GPON',
  },
  {
    id: '3',
    serialNumber: 'SN-RAD-001',
    model: 'LiteBeam 5AC',
    manufacturer: 'Ubiquiti',
    type: 'cpe_radio',
    macAddress: 'AA:BB:CC:11:22:55',
    ipAddress: '10.10.10.5',
    status: 'online',
    clientId: 'c-02',
    clientName: 'Ana Martínez',
    nasId: '2',
    networkSiteId: '3',
    firmwareVersion: '8.7.11',
    lastSeen: '2026-04-28T08:55:00Z',
    signal: -62,
    connectedAt: '2026-02-20T12:00:00Z',
    description: 'CPE radio',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <CpePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CpePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useCpeModule.useCpeDevices).mockReturnValue({
      data: mockDevices,
      isLoading: false,
    } as ReturnType<typeof useCpeModule.useCpeDevices>);

    vi.mocked(useCpeModule.useCreateCpeDevice).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCpeModule.useCreateCpeDevice>);

    vi.mocked(useCpeModule.useDeleteCpeDevice).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCpeModule.useDeleteCpeDevice>);

    vi.mocked(useCpeModule.useAssignCpeToClient).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCpeModule.useAssignCpeToClient>);
  });

  it('renders "CPE" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /CPE/i })).toBeInTheDocument();
  });

  it('summary cards render', () => {
    renderPage();
    expect(screen.getByText('Total CPE')).toBeInTheDocument();
    // These labels appear multiple times (card label + filter option/status badge)
    expect(screen.getAllByText('Online').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin configurar').length).toBeGreaterThanOrEqual(1);
  });

  it('table shows serial numbers from mock', () => {
    renderPage();
    expect(screen.getByText('SN-ROT-001')).toBeInTheDocument();
    expect(screen.getByText('SN-ONU-001')).toBeInTheDocument();
    expect(screen.getByText('SN-RAD-001')).toBeInTheDocument();
  });

  it('"Agregar CPE" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /agregar cpe/i })).toBeInTheDocument();
  });

  it('status filter exists', () => {
    renderPage();
    expect(screen.getByRole('combobox', { name: /filtrar por estado/i })).toBeInTheDocument();
  });

  it('signals column visible', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: /señal/i })).toBeInTheDocument();
  });
});
