import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { default as HardwarePage } from '@/pages/empresa/HardwarePage';
import * as useHardwareModule from '@/hooks/useHardware';
import type { HardwareAsset } from '@/types/hardware';

vi.mock('@/hooks/useHardware');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockAssets: HardwareAsset[] = [
  {
    id: '1',
    name: 'Servidor RADIUS',
    category: 'server',
    serialNumber: 'SRV-001',
    model: 'PowerEdge R340',
    manufacturer: 'Dell',
    purchaseDate: '2024-03-15',
    purchasePrice: 450000,
    warrantyExpiry: '2027-03-15',
    location: 'Rack A, Slot 1',
    networkSiteId: '4',
    status: 'in_use',
    assignedTo: 'RADIUS Server',
    notes: 'Servidor principal',
  },
  {
    id: '2',
    name: 'Switch core',
    category: 'switch',
    serialNumber: 'SW-001',
    model: 'CRS354',
    manufacturer: 'MikroTik',
    purchaseDate: '2023-08-20',
    purchasePrice: 185000,
    warrantyExpiry: '2026-08-20',
    location: 'Rack B, Slot 1',
    networkSiteId: '1',
    status: 'in_use',
    assignedTo: 'Core network',
    notes: '',
  },
  {
    id: '3',
    name: 'Módulo SFP+ repuesto',
    category: 'sfp',
    serialNumber: 'SFP-001',
    model: 'S+85DLC03D',
    manufacturer: 'MikroTik',
    purchaseDate: '2024-04-01',
    purchasePrice: 8500,
    warrantyExpiry: null,
    location: 'Almacén',
    networkSiteId: null,
    status: 'spare',
    assignedTo: null,
    notes: '',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <HardwarePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HardwarePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useHardwareModule.useHardwareAssets).mockReturnValue({
      data: mockAssets,
      isLoading: false,
    } as ReturnType<typeof useHardwareModule.useHardwareAssets>);

    vi.mocked(useHardwareModule.useCreateHardwareAsset).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useHardwareModule.useCreateHardwareAsset>);

    vi.mocked(useHardwareModule.useUpdateHardwareAsset).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useHardwareModule.useUpdateHardwareAsset>);

    vi.mocked(useHardwareModule.useDeleteHardwareAsset).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useHardwareModule.useDeleteHardwareAsset>);
  });

  it('renders "Hardware" heading', () => {
    renderPage();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
  });

  it('summary cards render', () => {
    renderPage();
    expect(screen.getByText('Total activos')).toBeInTheDocument();
    expect(screen.getByText('Garantía por vencer')).toBeInTheDocument();
    // Some labels appear in both card and status badge — use getAllByText
    expect(screen.getAllByText('En uso').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Repuesto').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('En mantenimiento').length).toBeGreaterThanOrEqual(1);
  });

  it('table shows asset names from mock', () => {
    renderPage();
    expect(screen.getByText('Servidor RADIUS')).toBeInTheDocument();
    expect(screen.getByText('Switch core')).toBeInTheDocument();
    expect(screen.getByText('Módulo SFP+ repuesto')).toBeInTheDocument();
  });

  it('"Agregar hardware" button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /agregar hardware/i })).toBeInTheDocument();
  });

  it('warranty column renders', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: /garantía hasta/i })).toBeInTheDocument();
  });
});
