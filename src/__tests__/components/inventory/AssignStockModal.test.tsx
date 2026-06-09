import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DepotStockDTO } from '@/types/depot';

vi.mock('@/hooks/useDepotStock', () => ({
  useDepotStock: vi.fn(),
  DEPOT_STOCK_QUERY_KEY: ['inventory', 'depot'],
}));

vi.mock('@/hooks/useTechnicianStock', () => ({
  useIssueStock: vi.fn(),
}));

import { useDepotStock } from '@/hooks/useDepotStock';
import { useIssueStock } from '@/hooks/useTechnicianStock';
import { AssignStockModal } from '@/components/inventory/AssignStockModal';

const depot: DepotStockDTO = {
  assets: [
    {
      id: 'a1',
      serialNumber: 'SN-AAA-001',
      mac: null,
      deviceTypeId: 'dt1',
      deviceTypeName: 'ont',
      deviceTypeLabel: 'ONT Huawei',
      status: 'available',
      sourceTaskId: null,
    },
  ],
  materials: [
    { id: 'm1', materialCatalogId: 'mc1', name: 'cable-utp', label: 'Cable UTP', unit: 'm', qty: 100 },
  ],
  depotLocationId: 'loc-depot',
};

const emptyDepot: DepotStockDTO = { assets: [], materials: [], depotLocationId: null };

function setMutation(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean }> = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.mocked(useIssueStock).mockReturnValue({
    mutate,
    isPending: overrides.isPending ?? false,
  } as never);
  return mutate;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDepotStock).mockReturnValue({
    data: depot,
    isLoading: false,
    isError: false,
  } as never);
  setMutation();
});

function renderModal(props: Partial<React.ComponentProps<typeof AssignStockModal>> = {}) {
  return render(
    <AssignStockModal
      open
      technicianId="tech-1"
      onClose={props.onClose ?? vi.fn()}
    />,
  );
}

describe('AssignStockModal', () => {
  it('does not render when open is false', () => {
    render(<AssignStockModal open={false} technicianId="tech-1" onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists depot assets and materials available to assign', () => {
    renderModal();
    expect(screen.getByText('SN-AAA-001')).toBeInTheDocument();
    expect(screen.getByText(/ONT Huawei/i)).toBeInTheDocument();
    expect(screen.getByText(/Cable UTP/i)).toBeInTheDocument();
  });

  it('shows an empty depot message when there is nothing to assign', () => {
    vi.mocked(useDepotStock).mockReturnValue({
      data: emptyDepot,
      isLoading: false,
      isError: false,
    } as never);
    renderModal();
    expect(screen.getByText(/no hay stock en el depósito/i)).toBeInTheDocument();
  });

  it('disables submit until at least one item is selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /asignar/i })).toBeDisabled();
  });

  it('submits the selected asset to useIssueStock', async () => {
    const mutate = setMutation();
    renderModal();

    fireEvent.click(screen.getByRole('checkbox', { name: /SN-AAA-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /asignar/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { items: [{ assetId: 'a1' }] },
        expect.anything(),
      ),
    );
  });

  it('submits a material with the entered quantity', async () => {
    const mutate = setMutation();
    renderModal();

    const qtyInput = screen.getByLabelText(/cantidad de Cable UTP/i);
    fireEvent.change(qtyInput, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /asignar/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { items: [{ materialCatalogId: 'mc1', qty: 7 }] },
        expect.anything(),
      ),
    );
  });

  it('disables submit while the issue request is in flight', () => {
    setMutation({ isPending: true });
    renderModal();
    expect(screen.getByRole('button', { name: /asignando/i })).toBeDisabled();
  });

  it('closes when the mutation succeeds', async () => {
    const onClose = vi.fn();
    const mutate = vi.fn((_payload, opts) => opts?.onSuccess?.());
    setMutation({ mutate });
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('checkbox', { name: /SN-AAA-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /asignar/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('closes on Cancel without issuing', () => {
    const onClose = vi.fn();
    const mutate = setMutation();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
