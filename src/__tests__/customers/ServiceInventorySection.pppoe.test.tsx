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
import type { ServiceInstalledItem, InspectPppoeDevicesResult, AddInstalledItemResult } from '@/types/serviceInventory';
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

/** A device that the BE created (HTTP 201). */
function createdResult(item: Partial<ServiceInstalledItem> = {}): AddInstalledItemResult {
  return {
    outcome: 'created',
    item: {
      id: 'new-1', serviceId: 'svc-1', type: 'ANTENA', serialNumber: null, mac: null, model: null,
      source: 'MANUAL', sourceTaskId: null, addedByUserId: null, addedByUserName: null,
      confirmedAt: null, status: 'active', notes: null, createdAt: '2026-06-01T00:00:00.000Z',
      ...item,
    },
  };
}

function setupMocks({
  items = [] as ServiceInstalledItem[],
  isLoading = false,
  addMutateAsync = vi.fn().mockResolvedValue(createdResult()),
  inspect = vi.fn().mockResolvedValue(inspectResult),
}: {
  items?: ServiceInstalledItem[];
  isLoading?: boolean;
  addMutateAsync?: ReturnType<typeof vi.fn>;
  inspect?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue({ data: items, isLoading } as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useAddInstalledItem).mockReturnValue({ mutate: noop, mutateAsync: addMutateAsync, isPending: false } as unknown as ReturnType<typeof useAddInstalledItem>);
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

  it('muestra el modal "Sin conexión" cuando no hay nada para agregar (offline)', async () => {
    const confirmMock = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmMock);
    const inspect = vi.fn().mockResolvedValue({
      antenna: { mac: null, model: null },
      router: null,
      warnings: ['No se pudo entrar a la antena por SSH (offline?).'],
    });
    setupMocks({ inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() =>
      expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sin conexión' })),
    );
    // NO abre el modal de revisión cuando no hay nada para agregar
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm in review modal calls addInstalledItem (mutateAsync) for antenna', async () => {
    const addMutateAsync = vi.fn().mockResolvedValue(createdResult());
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ addMutateAsync, inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(within(dialog()).getByRole('button', { name: /agregar equipos/i }));
    await waitFor(() => expect(addMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ANTENA', mac: 'AA:BB:CC:DD:EE:01' }),
    ));
  });

  it('after a successful confirm, the modal shows a result summary (does not auto-close)', async () => {
    const addMutateAsync = vi.fn().mockResolvedValue(createdResult());
    const inspect = vi.fn().mockResolvedValue(inspectResult);
    setupMocks({ addMutateAsync, inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(within(dialog()).getByRole('button', { name: /agregar equipos/i }));
    // Summary step: stays open, shows the outcome (antenna + router), then "Listo" closes it.
    expect((await within(dialog()).findAllByText(/agregad[oa]/i)).length).toBeGreaterThan(0);
    await user.click(within(dialog()).getByRole('button', { name: /^listo$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('200 enriched from the BE → summary says "datos completados"', async () => {
    const addMutateAsync = vi.fn().mockResolvedValue({
      outcome: 'enriched',
      item: createdResult({ id: 'existing-1' }).item,
    } satisfies AddInstalledItemResult);
    const inspect = vi.fn().mockResolvedValue({
      antenna: { mac: 'AA:BB:CC:DD:EE:01', model: 'Mimosa' },
      router: null,
      warnings: [],
    });
    setupMocks({ addMutateAsync, inspect });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /agregar por pppoe/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(within(dialog()).getByRole('button', { name: /agregar equipos/i }));
    expect(await within(dialog()).findByText(/datos completados/i)).toBeInTheDocument();
  });
});
