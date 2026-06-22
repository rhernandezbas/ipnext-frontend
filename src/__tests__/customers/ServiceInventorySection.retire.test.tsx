/**
 * ServiceInventorySection — "Quitar" → RetireInstalledItemModal wiring
 *
 * Covers:
 * 1. "Quitar" opens the destination modal (not a bare confirm)
 * 2. Submitting calls the retire mutation with { itemId, input }
 * 3. "Con un técnico" + technician → sends technicianId
 * 4. On success the modal closes
 * 5. A 409 ASSET_NOT_INSTALLED keeps the modal open with a clear message
 */
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import type { TechnicianListItemDTO } from '@/types/technicianList';
import type { DeviceType } from '@/types/deviceType';
import { AssetNotInstalledError } from '@/api/serviceInventory.api';

vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
  useAddInstalledItem: vi.fn(),
  useUpdateInstalledItem: vi.fn(),
  useRetireInstalledItem: vi.fn(),
  useInventoryTechnicians: vi.fn(),
  useInspectPppoeDevices: vi.fn(),
}));

vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(),
}));

import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRetireInstalledItem,
  useInventoryTechnicians,
  useInspectPppoeDevices,
} from '@/hooks/useServiceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { ServiceInventorySection } from '@/pages/customers/tabs/ServiceInventorySection';

const mockDT = (name: string, sortOrder: number): DeviceType => ({
  id: `dt-${name}`, name, label: name, active: true, sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});
const DEFAULT_TYPES = ['ONU', 'ROUTER', 'ANTENA'].map((n, i) => mockDT(n, i + 1));

const installed: ServiceInstalledItem = {
  id: 'item-1', serviceId: 'svc-1', type: 'ANTENA', serialNumber: 'SN-001', mac: null, model: null,
  source: 'MANUAL', sourceTaskId: null, addedByUserId: null, addedByUserName: null,
  confirmedAt: null, status: 'active', notes: null, createdAt: '2026-06-01T00:00:00.000Z',
};

const technicians: TechnicianListItemDTO[] = [
  { id: 'tech-1', name: 'Ana Técnica', assetCount: 2, materialQty: 5 },
];

const noop = vi.fn();

function setupMocks(retireMutateAsync = vi.fn().mockResolvedValue(installed)) {
  vi.mocked(useServiceInstalledItems).mockReturnValue({ data: [installed], isLoading: false } as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useAddInstalledItem).mockReturnValue({ mutate: noop, mutateAsync: noop, isPending: false } as unknown as ReturnType<typeof useAddInstalledItem>);
  vi.mocked(useUpdateInstalledItem).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useUpdateInstalledItem>);
  vi.mocked(useRetireInstalledItem).mockReturnValue({ mutateAsync: retireMutateAsync, isPending: false } as unknown as ReturnType<typeof useRetireInstalledItem>);
  vi.mocked(useInventoryTechnicians).mockReturnValue({ data: technicians, isLoading: false } as unknown as ReturnType<typeof useInventoryTechnicians>);
  vi.mocked(useDeviceTypes).mockReturnValue({ data: DEFAULT_TYPES, isLoading: false } as ReturnType<typeof useDeviceTypes>);
  vi.mocked(useInspectPppoeDevices).mockReturnValue({ inspect: vi.fn(), isPending: false } as ReturnType<typeof useInspectPppoeDevices>);
  return retireMutateAsync;
}

function dialog() {
  return screen.getByRole('dialog');
}

describe('ServiceInventorySection — Quitar (retire flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('"Quitar" opens the destination modal', async () => {
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(within(dialog()).getByRole('radio', { name: /depósito/i })).toBeInTheDocument();
  });

  it('submitting DEPOSITO calls the retire mutation with { itemId, input }', async () => {
    const retire = setupMocks();
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await user.click(within(dialog()).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      expect(retire).toHaveBeenCalledWith({ itemId: 'item-1', input: { disposition: 'DEPOSITO' } }),
    );
  });

  it('"Con un técnico" + technician → sends technicianId', async () => {
    const retire = setupMocks();
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await user.click(within(dialog()).getByRole('radio', { name: /con un técnico/i }));
    await user.selectOptions(within(dialog()).getByRole('combobox'), 'tech-1');
    await user.click(within(dialog()).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      expect(retire).toHaveBeenCalledWith({
        itemId: 'item-1',
        input: { disposition: 'TECNICO', technicianId: 'tech-1' },
      }),
    );
  });

  it('closes the modal after a successful retire', async () => {
    setupMocks(vi.fn().mockResolvedValue(installed));
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await user.click(within(dialog()).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the modal open with a clear message on 409 ASSET_NOT_INSTALLED', async () => {
    setupMocks(vi.fn().mockRejectedValue(new AssetNotInstalledError()));
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    await user.click(within(dialog()).getByRole('button', { name: /^quitar$/i }));
    expect(await within(dialog()).findByText(/ya no figura instalado/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
