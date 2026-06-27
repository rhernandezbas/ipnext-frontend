/**
 * Tests for AssignStockToVehicleModal (EPIC #38, Wave 5b).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useDepotStock', () => ({
  useDepotStock: vi.fn(),
  DEPOT_STOCK_QUERY_KEY: ['inventory', 'depot'],
}));

vi.mock('@/hooks/useVehicles', () => ({
  useIssueStockToVehicle: vi.fn(),
  useVehicleStock: vi.fn(),
  useVehicles: vi.fn(),
  useCreateVehicle: vi.fn(),
  useUpdateVehicle: vi.fn(),
  useDeleteVehicle: vi.fn(),
  VEHICLES_QUERY_KEY: ['inventory', 'vehicles'],
  VEHICLE_STOCK_QUERY_KEY: (id: string) => ['inventory', 'vehicles', id, 'stock'],
}));

import { useDepotStock } from '@/hooks/useDepotStock';
import { useIssueStockToVehicle } from '@/hooks/useVehicles';
import { AssignStockToVehicleModal } from '@/components/inventory/AssignStockToVehicleModal';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

function mockDepotEmpty() {
  vi.mocked(useDepotStock).mockReturnValue(mockQuery({
    data: { assets: [], materials: [], depotLocationId: null },
    isLoading: false,
    isError: false,
  }));
}

function mockDepotWithAsset() {
  vi.mocked(useDepotStock).mockReturnValue(mockQuery({
    data: {
      assets: [{
        id: 'a-1',
        serialNumber: 'SN-001',
        deviceTypeId: 'dt-1',
        deviceTypeName: 'ONU',
        deviceTypeLabel: 'Óptico',
        mac: null,
        status: 'available',
        sourceTaskId: null,
      }],
      materials: [],
      depotLocationId: 'depot-1',
    },
    isLoading: false,
    isError: false,
  }));
}

function mockIssueMutation(mutate = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(useIssueStockToVehicle).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useIssueStockToVehicle>);
}

describe('AssignStockToVehicleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open=false', () => {
    mockDepotEmpty();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={false} vehicleId="v-1" onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when open=true', () => {
    mockDepotEmpty();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows empty depot message when depot has no stock', () => {
    mockDepotEmpty();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={vi.fn()} />,
    );
    expect(screen.getByText(/No hay stock en el depósito/i)).toBeInTheDocument();
  });

  it('shows asset checkboxes when depot has assets', () => {
    mockDepotWithAsset();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={vi.fn()} />,
    );
    expect(screen.getByLabelText(/SN-001/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockDepotEmpty();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={onClose} />,
    );
    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls issueStock with selected asset when submitting', async () => {
    const mutate = vi.fn().mockImplementation((_payload, opts) => opts?.onSuccess?.());
    mockDepotWithAsset();
    mockIssueMutation(mutate);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={onClose} />,
    );

    await user.click(screen.getByLabelText(/SN-001/i));
    await user.click(screen.getByRole('button', { name: /Asignar/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
    expect(mutate).toHaveBeenCalledWith(
      { items: [{ assetId: 'a-1' }] },
      expect.any(Object),
    );
  });

  it('submit button is disabled when no items are selected', () => {
    mockDepotWithAsset();
    mockIssueMutation();
    render(
      <AssignStockToVehicleModal open={true} vehicleId="v-1" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Asignar/i })).toBeDisabled();
  });
});
