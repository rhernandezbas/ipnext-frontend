import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import type { TaskMaterialConsumption } from '@/types/taskMaterial';

vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
}));

vi.mock('@/hooks/useTaskMaterials', () => ({
  useTaskMaterials: vi.fn(),
}));

import { useServiceInstalledItems } from '@/hooks/useServiceInventory';
import { useTaskMaterials } from '@/hooks/useTaskMaterials';
import { ContractInventoryReadonly } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ContractInventoryReadonly';

const mockItem = (over: Partial<ServiceInstalledItem> = {}): ServiceInstalledItem => ({
  id: 'item-1',
  serviceId: 'svc-1',
  type: 'ONU',
  serialNumber: 'SN123',
  mac: 'AA:BB',
  model: 'ZTE F600',
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: 'Operador',
  confirmedAt: '2026-01-01T00:00:00.000Z',
  status: 'active',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const mockConsumption = (over: Partial<TaskMaterialConsumption> = {}): TaskMaterialConsumption => ({
  id: 'c-1',
  taskId: 't-1',
  materialCatalogId: 'mt-1',
  materialName: 'CABLE',
  quantity: 10,
  unit: 'm',
  notes: null,
  recordedByUserName: 'Operador',
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

function setupMocks({
  items = [mockItem()],
  itemsLoading = false,
  consumptions = [mockConsumption()],
  consumptionsLoading = false,
} = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue({ data: items, isLoading: itemsLoading } as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useTaskMaterials).mockReturnValue({ data: consumptions, isLoading: consumptionsLoading } as ReturnType<typeof useTaskMaterials>);
}

describe('ContractInventoryReadonly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders installed equipment section heading', () => {
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText(/equipos instalados/i)).toBeInTheDocument();
  });

  it('shows the installed item type and SN', () => {
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText('ONU')).toBeInTheDocument();
    expect(screen.getByText(/SN123/)).toBeInTheDocument();
  });

  it('renders materials summary section heading', () => {
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText(/materiales/i)).toBeInTheDocument();
  });

  it('shows consumed material name and quantity', () => {
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText('CABLE')).toBeInTheDocument();
    expect(screen.getByText(/× 10/)).toBeInTheDocument();
  });

  it('does NOT render when contractId is null — empty state, no crash', () => {
    // useServiceInstalledItems is gated by !!contractId in the hook, but the component should not render it
    vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useServiceInstalledItems>);
    vi.mocked(useTaskMaterials).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useTaskMaterials>);
    render(<ContractInventoryReadonly contractId={null} taskId={null} />);
    expect(screen.getByText(/sin contrato/i)).toBeInTheDocument();
  });

  it('does NOT show edit/remove actions (read-only)', () => {
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
  });

  it('shows loading state for items', () => {
    setupMocks({ itemsLoading: true, items: [] });
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows empty items state when no equipment', () => {
    setupMocks({ items: [] });
    render(<ContractInventoryReadonly contractId="svc-1" taskId="t-1" />);
    expect(screen.getByText(/sin equipos/i)).toBeInTheDocument();
  });
});
