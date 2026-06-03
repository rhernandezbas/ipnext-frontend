import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DeviceType } from '@/types/deviceType';

// Mock the hooks so we control them directly (no QueryClient needed)
vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(),
  useCreateDeviceType: vi.fn(),
  useUpdateDeviceType: vi.fn(),
  useDeleteDeviceType: vi.fn(),
}));

import {
  useDeviceTypes,
  useCreateDeviceType,
  useUpdateDeviceType,
  useDeleteDeviceType,
} from '@/hooks/useDeviceTypes';
import { DeviceTypesBody } from '@/pages/inventory/settings/DeviceTypesBody';
import { useConfirm } from '@/context/ConfirmContext';

const mockDT = (over: Partial<DeviceType> = {}): DeviceType => ({
  id: 'dt-1',
  name: 'ONU',
  label: 'Óptico',
  active: true,
  sortOrder: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function mockHooks({
  data = [mockDT()],
  isLoading = false,
  createMutate = noop,
  updateMutate = noop,
  deleteMutate = noop,
}: {
  data?: DeviceType[];
  isLoading?: boolean;
  createMutate?: ReturnType<typeof vi.fn>;
  updateMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useDeviceTypes).mockReturnValue({ data, isLoading } as ReturnType<typeof useDeviceTypes>);
  vi.mocked(useCreateDeviceType).mockReturnValue({ mutateAsync: createMutate, isPending: false } as unknown as ReturnType<typeof useCreateDeviceType>);
  vi.mocked(useUpdateDeviceType).mockReturnValue({ mutateAsync: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateDeviceType>);
  vi.mocked(useDeleteDeviceType).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteDeviceType>);
}

describe('DeviceTypesBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply confirm mock after clearAllMocks
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renders the table with Nombre/Etiqueta/Activo/Orden/Acciones headers', () => {
    mockHooks();
    render(<DeviceTypesBody />);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Etiqueta')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Orden')).toBeInTheDocument();
  });

  it('renders a row for each device type', () => {
    mockHooks({
      data: [
        mockDT({ id: 'dt-1', name: 'ONU', label: 'Óptico', sortOrder: 1 }),
        mockDT({ id: 'dt-2', name: 'ROUTER', label: null, active: false, sortOrder: 2 }),
      ],
    });
    render(<DeviceTypesBody />);
    expect(screen.getByText('ONU')).toBeInTheDocument();
    expect(screen.getByText('ROUTER')).toBeInTheDocument();
    expect(screen.getByText('Óptico')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockHooks({ data: [], isLoading: true });
    render(<DeviceTypesBody />);
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('shows empty state when no device types', () => {
    mockHooks({ data: [] });
    render(<DeviceTypesBody />);
    expect(screen.getByText(/no hay tipos/i)).toBeInTheDocument();
  });

  it('opens create modal on click "+ Nuevo tipo"', async () => {
    const user = userEvent.setup();
    mockHooks();
    render(<DeviceTypesBody />);
    await user.click(screen.getByText(/Nuevo tipo/i));
    expect(screen.getByText(/Nuevo tipo de equipo/i)).toBeInTheDocument();
  });

  it('calls createMutateAsync with name and sortOrder', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<DeviceTypesBody />);
    await user.click(screen.getByText(/Nuevo tipo/i));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'ANTENA');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce());
  });

  it('shows NAME_CONFLICT error in modal', async () => {
    const createMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'DEVICE_TYPE_NAME_CONFLICT' } },
    });
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<DeviceTypesBody />);
    await user.click(screen.getByText(/Nuevo tipo/i));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'ONU');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(screen.getByText(/Ya existe un tipo con ese nombre/i)).toBeInTheDocument());
  });

  it('opens edit modal when clicking Editar', async () => {
    const user = userEvent.setup();
    mockHooks({ data: [mockDT({ name: 'ONU', label: 'Óptico' })] });
    render(<DeviceTypesBody />);
    await user.click(screen.getByText('Editar'));
    expect(screen.getByText(/Editar tipo de equipo/i)).toBeInTheDocument();
  });

  it('calls deleteMutateAsync after confirm', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockDT()], deleteMutate });
    render(<DeviceTypesBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith('dt-1'));
  });

  it('shows IN_USE error when deleting a used type', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'DEVICE_TYPE_IN_USE' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockDT()], deleteMutate });

    // Spy on alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<DeviceTypesBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('equipos que usan este tipo')));
    alertSpy.mockRestore();
  });

  it('shows PROTECTED error when deleting OTROS', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'DEVICE_TYPE_PROTECTED' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockDT({ name: 'OTROS' })], deleteMutate });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<DeviceTypesBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('OTROS no se puede eliminar')));
    alertSpy.mockRestore();
  });
});
