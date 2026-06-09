/**
 * Tests for VehiclesBody (EPIC #38, Wave 5b — SCEN-FE-1, SCEN-FE-2).
 * Mocks hooks so we control data flow directly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Vehicle } from '@/types/vehicle';
import { useMyPermissions } from '@/hooks/useMyPermissions';

vi.mock('@/hooks/useVehicles', () => ({
  useVehicles: vi.fn(),
  useCreateVehicle: vi.fn(),
  useUpdateVehicle: vi.fn(),
  useDeleteVehicle: vi.fn(),
}));

import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from '@/hooks/useVehicles';
import { VehiclesBody } from '@/pages/inventory/settings/VehiclesBody';
import { useConfirm } from '@/context/ConfirmContext';

const noop = vi.fn().mockResolvedValue(undefined);

function makeVehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    plate: 'ABC-123',
    name: 'Camioneta Norte',
    assignedTechnicianId: null,
    status: 'active',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function mockHooks({
  data = [makeVehicle()],
  isLoading = false,
  createMutate = noop,
  updateMutate = noop,
  deleteMutate = noop,
}: {
  data?: Vehicle[];
  isLoading?: boolean;
  createMutate?: ReturnType<typeof vi.fn>;
  updateMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useVehicles).mockReturnValue({ data, isLoading } as ReturnType<typeof useVehicles>);
  vi.mocked(useCreateVehicle).mockReturnValue({ mutateAsync: createMutate, isPending: false } as unknown as ReturnType<typeof useCreateVehicle>);
  vi.mocked(useUpdateVehicle).mockReturnValue({ mutateAsync: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateVehicle>);
  vi.mocked(useDeleteVehicle).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteVehicle>);
}

function renderVehiclesBody() {
  return render(
    <MemoryRouter>
      <VehiclesBody />
    </MemoryRouter>,
  );
}

describe('VehiclesBody — SCEN-FE-1: vehicle list render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
  });

  it('renders table headers: Patente, Nombre, Estado', () => {
    mockHooks();
    renderVehiclesBody();
    expect(screen.getByText('Patente')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('renders a row with plate and name for each vehicle', () => {
    mockHooks({
      data: [
        makeVehicle({ id: 'v-1', plate: 'ABC-123', name: 'Camioneta Norte' }),
        makeVehicle({ id: 'v-2', plate: 'XYZ-999', name: null }),
      ],
    });
    renderVehiclesBody();
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText('XYZ-999')).toBeInTheDocument();
    expect(screen.getByText('Camioneta Norte')).toBeInTheDocument();
  });

  it('renders a status badge — "Activo" for active vehicle', () => {
    mockHooks({ data: [makeVehicle({ status: 'active' })] });
    renderVehiclesBody();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders a status badge — "Inactivo" for inactive vehicle', () => {
    mockHooks({ data: [makeVehicle({ status: 'inactive' })] });
    renderVehiclesBody();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('renders "Ver stock" link pointing to /admin/inventory/vehicles/:id', () => {
    mockHooks({ data: [makeVehicle({ id: 'v-1' })] });
    renderVehiclesBody();
    const link = screen.getByRole('link', { name: /Ver stock/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/admin/inventory/vehicles/v-1');
  });

  it('shows loading state', () => {
    mockHooks({ data: [], isLoading: true });
    renderVehiclesBody();
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('shows empty state when no vehicles', () => {
    mockHooks({ data: [] });
    renderVehiclesBody();
    expect(screen.getByText(/no hay camionetas/i)).toBeInTheDocument();
  });
});

describe('VehiclesBody — SCEN-FE-2: permission gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('shows + Nueva camioneta and Editar/Eliminar when user has inventory.manage', () => {
    // Setup: default mock from setup.ts grants '*' (all permissions)
    mockHooks();
    renderVehiclesBody();
    expect(screen.getByText(/Nueva camioneta/i)).toBeInTheDocument();
    expect(screen.getByText('Editar')).toBeInTheDocument();
    expect(screen.getByText('Eliminar')).toBeInTheDocument();
  });

  it('hides mutation controls when user lacks inventory.manage (read-only)', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['inventory.read'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.some(perm => perm === 'inventory.read');
      },
    });
    mockHooks();
    renderVehiclesBody();
    expect(screen.queryByText(/Nueva camioneta/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
  });
});

describe('VehiclesBody — mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    // Restore permissive mock after potential denials in SCEN-FE-2
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    });
  });

  it('opens create modal on click "+ Nueva camioneta"', async () => {
    const user = userEvent.setup();
    mockHooks({ data: [] });
    renderVehiclesBody();
    await user.click(screen.getByText(/Nueva camioneta/i));
    expect(screen.getByRole('heading', { name: /Nueva camioneta/i })).toBeInTheDocument();
  });

  it('calls createVehicle with plate', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    renderVehiclesBody();
    await user.click(screen.getByText(/Nueva camioneta/i));
    const plateInput = screen.getByLabelText(/Patente/i);
    await user.clear(plateInput);
    await user.type(plateInput, 'ABC-123');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce());
    expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ plate: 'ABC-123' }));
  });

  it('shows DUPLICATE_PLATE error in modal when 409 VEHICLE_PLATE_CONFLICT', async () => {
    const createMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'VEHICLE_PLATE_CONFLICT' } },
    });
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    renderVehiclesBody();
    await user.click(screen.getByText(/Nueva camioneta/i));
    const plateInput = screen.getByLabelText(/Patente/i);
    await user.clear(plateInput);
    await user.type(plateInput, 'ABC-123');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(screen.getByText(/Ya existe una camioneta con esa patente/i)).toBeInTheDocument());
  });

  it('calls deleteMutateAsync after confirm', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [makeVehicle()], deleteMutate });
    renderVehiclesBody();
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith('v-1'));
  });

  it('shows VEHICLE_IN_USE alert when deleting a vehicle with stock', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'VEHICLE_IN_USE' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [makeVehicle()], deleteMutate });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderVehiclesBody();
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('stock')));
    alertSpy.mockRestore();
  });

  it('opens edit modal on click Editar', async () => {
    const user = userEvent.setup();
    mockHooks({ data: [makeVehicle()] });
    renderVehiclesBody();
    const editBtn = screen.getAllByText('Editar')[0];
    await user.click(editBtn);
    expect(screen.getByRole('heading', { name: /Editar camioneta/i })).toBeInTheDocument();
  });
});
