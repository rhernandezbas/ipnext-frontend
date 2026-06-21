import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ServiceInstalledItem } from '@/types/serviceInventory';
import type { DeviceType } from '@/types/deviceType';

// Mock hooks
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

const mockItem = (over: Partial<ServiceInstalledItem> = {}): ServiceInstalledItem => ({
  id: 'item-1',
  serviceId: 'svc-1',
  type: 'ONU',
  serialNumber: 'SN123',
  mac: 'AA:BB:CC',
  model: 'ZTE',
  source: 'MANUAL',
  sourceTaskId: null,
  addedByUserId: null,
  addedByUserName: 'Juan',
  confirmedAt: '2026-01-01T00:00:00.000Z',
  status: 'active',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const mockDT = (name: string, sortOrder: number): DeviceType => ({
  id: `dt-${name}`,
  name,
  label: name,
  active: true,
  sortOrder,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const DEFAULT_TYPES = ['ONU', 'ROUTER', 'ANTENA', 'REPETIDOR', 'OTROS'].map((n, i) => mockDT(n, i + 1));

const noop = vi.fn();

function setupMocks({
  items = [mockItem()],
  isLoading = false,
  addMutate = noop,
  updateMutate = noop,
  removeMutate = vi.fn().mockResolvedValue(undefined),
  deviceTypes = DEFAULT_TYPES,
} = {}) {
  vi.mocked(useServiceInstalledItems).mockReturnValue({ data: items, isLoading } as ReturnType<typeof useServiceInstalledItems>);
  vi.mocked(useAddInstalledItem).mockReturnValue({ mutate: addMutate, isPending: false } as unknown as ReturnType<typeof useAddInstalledItem>);
  vi.mocked(useUpdateInstalledItem).mockReturnValue({ mutate: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateInstalledItem>);
  vi.mocked(useRemoveInstalledItem).mockReturnValue({ mutateAsync: removeMutate, isPending: false } as unknown as ReturnType<typeof useRemoveInstalledItem>);
  vi.mocked(useDeviceTypes).mockReturnValue({ data: deviceTypes, isLoading: false } as ReturnType<typeof useDeviceTypes>);
  vi.mocked(useInspectPppoeDevices).mockReturnValue({ inspect: vi.fn().mockResolvedValue({ antenna: { mac: null, model: null }, router: null, warnings: [] }), isPending: false } as ReturnType<typeof useInspectPppoeDevices>);
}

/** The modal portals to document.body; scope queries to the dialog. */
function dialog() {
  return screen.getByRole('dialog');
}

describe('ServiceInventorySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    setupMocks();
  });

  it('renders equipment rows with type, SN, MAC, model', () => {
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByText('ONU')).toBeInTheDocument();
    expect(screen.getByText('SN123')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC')).toBeInTheDocument();
    expect(screen.getByText('ZTE')).toBeInTheDocument();
  });

  it('shows add button gated by inventory.write (setup grants all perms by default)', () => {
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByRole('button', { name: /Agregar SN/i })).toBeInTheDocument();
  });

  it('shows Editar and Quitar buttons per row gated by inventory.write', () => {
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Quitar')).toBeInTheDocument();
  });

  it('opens the add modal when clicking "Agregar SN"', async () => {
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /Agregar SN/i }));
    expect(within(dialog()).getByText(/Agregar SN al contrato/i)).toBeInTheDocument();
  });

  it('creates an item with normalized (uppercased, trimmed) serial', async () => {
    const addMutate = vi.fn();
    setupMocks({ addMutate });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);

    await user.click(screen.getByRole('button', { name: /Agregar SN/i }));
    const d = dialog();
    await user.type(within(d).getByLabelText(/Serial/i), '  zte abc123  ');
    await user.click(within(d).getByRole('button', { name: /Agregar equipo/i }));

    expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ serialNumber: 'ZTEABC123' }),
      expect.anything(),
    );
  });

  it('blocks submit and warns when the MAC format is invalid', async () => {
    const addMutate = vi.fn();
    setupMocks({ addMutate });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);

    await user.click(screen.getByRole('button', { name: /Agregar SN/i }));
    const d = dialog();
    await user.type(within(d).getByLabelText(/^MAC$/i), 'not-a-mac');
    await user.click(within(d).getByRole('button', { name: /Agregar equipo/i }));

    expect(within(d).getByText(/Formato de MAC inválido/i)).toBeInTheDocument();
    expect(addMutate).not.toHaveBeenCalled();
  });

  it('calls removeInstalledItem after confirm when clicking Quitar', async () => {
    const removeMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    setupMocks({ removeMutate });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByText('Quitar'));
    await waitFor(() => expect(removeMutate).toHaveBeenCalledWith('item-1'));
  });

  it('does NOT call removeInstalledItem when confirm is cancelled', async () => {
    const removeMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
    setupMocks({ removeMutate });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByText('Quitar'));
    expect(removeMutate).not.toHaveBeenCalled();
  });

  it('opens the edit modal prefilled when clicking Editar', async () => {
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByText('Editar'));
    const d = dialog();
    expect(within(d).getByText(/Editar equipo/i)).toBeInTheDocument();
    expect(within(d).getByLabelText(/Serial/i)).toHaveValue('SN123');
  });

  it('calls updateInstalledItem when submitting the edit modal', async () => {
    const updateMutate = vi.fn();
    setupMocks({ updateMutate });
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByText('Editar'));
    await user.click(within(dialog()).getByRole('button', { name: /Guardar cambios/i }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1' }),
      expect.anything(),
    ));
  });

  it('closes the modal on Escape', async () => {
    const user = userEvent.setup();
    render(<ServiceInventorySection serviceId="svc-1" />);
    await user.click(screen.getByRole('button', { name: /Agregar SN/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    setupMocks({ isLoading: true, items: [] });
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByText(/cargando equipos/i)).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    setupMocks({ items: [] });
    render(<ServiceInventorySection serviceId="svc-1" />);
    expect(screen.getByText(/sin equipos/i)).toBeInTheDocument();
  });
});
