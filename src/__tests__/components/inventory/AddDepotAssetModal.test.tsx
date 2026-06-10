/**
 * Tests for AddDepotAssetModal (EPIC #38 depot stock entry — "Agregar equipo").
 * RED → GREEN: written before implementation.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(),
}));

vi.mock('@/hooks/useDepotEntry', () => ({
  useAddDepotAsset: vi.fn(),
}));

import { useDeviceTypes } from '@/hooks/useDeviceTypes';
import { useAddDepotAsset } from '@/hooks/useDepotEntry';
import { AddDepotAssetModal } from '@/components/inventory/AddDepotAssetModal';
import type { DeviceType } from '@/types/deviceType';

const deviceTypes: DeviceType[] = [
  { id: 'dt-1', name: 'ont', label: 'ONT Huawei', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
  { id: 'dt-2', name: 'router', label: 'Router Mikrotik', active: true, sortOrder: 2, createdAt: '', updatedAt: '' },
  { id: 'dt-3', name: 'old', label: 'Old inactive', active: false, sortOrder: 99, createdAt: '', updatedAt: '' },
];

function makeMutation(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean; reset: ReturnType<typeof vi.fn> }> = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.mocked(useAddDepotAsset).mockReturnValue({
    mutate,
    isPending: overrides.isPending ?? false,
    reset: overrides.reset ?? vi.fn(),
    isSuccess: false,
    isError: false,
  } as never);
  return mutate;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDeviceTypes).mockReturnValue({
    data: deviceTypes,
    isLoading: false,
    isError: false,
  } as never);
  makeMutation();
});

function renderModal(props: Partial<React.ComponentProps<typeof AddDepotAssetModal>> = {}) {
  return render(
    <AddDepotAssetModal
      open={props.open ?? true}
      onClose={props.onClose ?? vi.fn()}
    />,
  );
}

describe('AddDepotAssetModal', () => {
  it('does not render when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open=true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Agregar equipo/i })).toBeInTheDocument();
  });

  it('renders active device types in the select and excludes inactive ones', () => {
    renderModal();
    expect(screen.getByRole('option', { name: /ONT Huawei/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Router Mikrotik/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Old inactive/i })).not.toBeInTheDocument();
  });

  it('submit button is disabled when no device type or serial/mac is entered', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Agregar equipo/i })).toBeDisabled();
  });

  it('submits with serialNumber when type + serial provided', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } });
    fireEvent.change(screen.getByLabelText(/Número de serie/i), { target: { value: 'SN-001' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { deviceTypeId: 'dt-1', serialNumber: 'SN-001' },
        expect.anything(),
      ),
    );
  });

  it('submits with mac only when no serial is entered', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-2' } });
    fireEvent.change(screen.getByLabelText(/Dirección MAC/i), { target: { value: 'AA:BB:CC:DD:EE:FF' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { deviceTypeId: 'dt-2', mac: 'AA:BB:CC:DD:EE:FF' },
        expect.anything(),
      ),
    );
  });

  it('sends note when provided', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } });
    fireEvent.change(screen.getByLabelText(/Número de serie/i), { target: { value: 'SN-002' } });
    fireEvent.change(screen.getByLabelText(/Nota/i), { target: { value: 'Reacondicionado' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { deviceTypeId: 'dt-1', serialNumber: 'SN-002', note: 'Reacondicionado' },
        expect.anything(),
      ),
    );
  });

  it('shows 409 ASSET_ALREADY_EXISTS error with a clear message', async () => {
    const error = { response: { data: { code: 'ASSET_ALREADY_EXISTS', error: 'Conflict' } } };
    const mutate = vi.fn((_payload, opts) => opts?.onError?.(error));
    makeMutation({ mutate });
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } });
    fireEvent.change(screen.getByLabelText(/Número de serie/i), { target: { value: 'EXISTING' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/ya existe un equipo con ese serial o mac/i),
    );
  });

  it('submit is disabled while the mutation is pending', () => {
    makeMutation({ isPending: true });
    renderModal();
    expect(screen.getByRole('button', { name: /Guardando/i })).toBeDisabled();
  });

  it('closes when the mutation succeeds', async () => {
    const onClose = vi.fn();
    const mutate = vi.fn((_payload, opts) => opts?.onSuccess?.());
    makeMutation({ mutate });
    renderModal({ onClose });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } });
    fireEvent.change(screen.getByLabelText(/Número de serie/i), { target: { value: 'SN-003' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar equipo/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit when neither serial nor mac is entered (type is selected)', async () => {
    const mutate = makeMutation();
    renderModal();

    // Select a type but leave serial and mac empty
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } });
    // The submit button should still be disabled
    expect(screen.getByRole('button', { name: /Agregar equipo/i })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
