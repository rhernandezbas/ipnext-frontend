/**
 * ServiceInventorySection — "Agregar por PPPoE" button + inspect flow
 *
 * Covers:
 * 1. "Agregar por PPPoE" button is rendered (gated by inventory.write — granted by default)
 * 2. Clicking it calls inspectPppoeDevices and shows loading state "Inspeccionando…"
 * 3. On success → opens AddByPppoeReviewModal with the result
 * 4. On inspect error → shows an error message (toast/banner)
 * 5. Confirm in modal calls addInstalledItem for each included device
 * 6. After confirm, the modal closes
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem, InspectPppoeDevicesResult } from '@/types/serviceInventory';
import type { DeviceType } from '@/types/deviceType';

// Mock hooks and api
vi.mock('@/hooks/useServiceInventory', () => ({
  useServiceInstalledItems: vi.fn(),
  useAddInstalledItem: vi.fn(),
  useUpdateInstalledItem: vi.fn(),
  useRemoveInstalledItem: vi.fn(),
  useInspectPppoeDevices: vi.fn(),
}));

vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(),
}));

import {
  useServiceInstalledItems,
  useAddInstalledItem,
  useUpdateInstalledItem,
  useRemoveInstalledItem,
  useInspectPppoeDevices,
} from '@/hooks/useServiceInventory';
import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { useConfirm } from '@/context/ConfirmContext';
import { ServiceInventorySection } from '@/pages/customers/tabs/ServiceInventorySection';

const mockDT = (name: string, sortOrder: number): DeviceType => ({
  id: `dt-${name}`, name, label: name, active: true, sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

const DEFAULT_TYPES = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'].map((n, i) => mockDT(n, i + 1));

const inspectResult: InspectPppoeDevicesResult = {
  antenna: { mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa C5x' },
  router: { mac: 'AA:BB:CC:DD:EE:02', brand: 'TP-Link' },
  warnings: [],
};

const noop = vi.fn();

function setupMocks({
  items = [] as ServiceInstalledItem[],
  isLoading = false,
  addMutate = noop,
  inspect = vi.fn().mockResolvedValue(inspectResult),
} = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue({ data: items, isLoading } as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useAddInstalledItem).mockReturnValue({ mutate: addMutate, isPending: false } as unknown as ReturnType<typeof useAddInstalledItem>);
  vi.mocked(useUpdateInstalledItem).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useUpdateInstalledItem>);
  vi.mocked(useRemoveInstalledItem).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as unknown as ReturnType<typeof useRemoveInstalledItem>);
  vi.mocked(useDeviceTypes).mockReturnValue({ data: DEFAULT_TYPES, isLoading: false } as ReturnType<typeof useDeviceTypes>);
  vi.mocked(useInspectPppoeDevices).mockReturnValue({ inspect, isPending: false } as ReturnType<typeof useInspectPppoeDevices>);
}

function dialog() {
  return screen.getByRole('dialog');
}

describe('ServiceInventorySection — Agregar por PPPoE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    setupMocks();
  });

  it('renders "Agregar por PPPoE" button', () => {
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByRole('button', { name: /agregar por pppoe/i })).toBeInTheDocument();
  });

  it('clicking "Agregar por PPPoE" triggers inspect call with contractId', async () => {
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(inspect).toHaveBeenCalledWith('svc-1'));
  });

  it('shows loading state while inspecting', async () => {
    // Inspect never resolves (pending)
    const inspect = vi.fn(() => new Promise(() => {}));
    vi.mocked(useInspectPppoeDevices).mockReturnValue({ inspect, isPending: true } as ReturnType<typeof useInspectPppoeDevices>);
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByRole('button', { name: /inspeccionando/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inspeccionando/i })).toBeDisabled();
  });

  it('opens AddByPppoeReviewModal on inspect success', async () => {
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(within(dialog()).getByText('AA:BB:CC:DD:EE:01')).toBeInTheDocument();
  });

  it('shows inspect error banner when inspect rejects', async () => {
    const inspect = vi.fn().mockRejectedValue(new Error('Network error'));
    setupMocks({ inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo inspeccionar/i);
  });

  it('confirm in review modal calls addInstalledItem for antenna', async () => {
    const addMutate = vi.fn((input, { onSuccess } = {}) => { onSuccess?.(); });
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ addMutate, inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(within(dialog()).getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01' }),
      expect.anything(),
    ));
  });

  it('after confirm, modal closes', async () => {
    const addMutate = vi.fn((_input, { onSuccess } = {}) => { onSuccess?.(); });
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ addMutate, inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(within(dialog()).getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
