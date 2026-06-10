/**
 * Tests for LoadDepotMaterialModal (EPIC #38 depot stock entry — "Cargar material").
 * RED → GREEN: written before implementation.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useMaterialTypes', () => ({
  useMaterialTypes: vi.fn(),
}));

vi.mock('@/hooks/useDepotEntry', () => ({
  useLoadDepotMaterial: vi.fn(),
}));

import { useMaterialTypes } from '@/hooks/useMaterialTypes';
import { useLoadDepotMaterial } from '@/hooks/useDepotEntry';
import { LoadDepotMaterialModal } from '@/components/inventory/LoadDepotMaterialModal';
import type { MaterialType } from '@/types/materialType';

const materialTypes: MaterialType[] = [
  {
    id: 'mc-1',
    name: 'cable-utp',
    label: 'Cable UTP Cat6',
    unit: 'm',
    active: true,
    sortOrder: 1,
    minStock: 100,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'mc-2',
    name: 'conector-rj45',
    label: 'Conector RJ45',
    unit: 'u',
    active: true,
    sortOrder: 2,
    minStock: 50,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'mc-3',
    name: 'old-material',
    label: 'Obsoleto',
    unit: null,
    active: false,
    sortOrder: 99,
    minStock: 0,
    createdAt: '',
    updatedAt: '',
  },
];

function makeMutation(overrides: Partial<{ mutate: ReturnType<typeof vi.fn>; isPending: boolean; reset: ReturnType<typeof vi.fn> }> = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  vi.mocked(useLoadDepotMaterial).mockReturnValue({
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
  vi.mocked(useMaterialTypes).mockReturnValue({
    data: materialTypes,
    isLoading: false,
    isError: false,
  } as never);
  makeMutation();
});

function renderModal(props: Partial<React.ComponentProps<typeof LoadDepotMaterialModal>> = {}) {
  return render(
    <LoadDepotMaterialModal
      open={props.open ?? true}
      onClose={props.onClose ?? vi.fn()}
    />,
  );
}

describe('LoadDepotMaterialModal', () => {
  it('does not render when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open=true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Cargar material/i)).toBeInTheDocument();
  });

  it('renders active material types in the select and excludes inactive ones', () => {
    renderModal();
    expect(screen.getByRole('option', { name: /Cable UTP Cat6/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Conector RJ45/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Obsoleto/i })).not.toBeInTheDocument();
  });

  it('submit button is disabled when no material or qty is entered', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /Cargar stock/i })).toBeDisabled();
  });

  it('submits with materialCatalogId and qty', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-1' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Cargar stock/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { materialCatalogId: 'mc-1', qty: 50 },
        expect.anything(),
      ),
    );
  });

  it('sends note when provided', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-2' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Nota/i), { target: { value: 'Compra junio' } });
    fireEvent.click(screen.getByRole('button', { name: /Cargar stock/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { materialCatalogId: 'mc-2', qty: 20, note: 'Compra junio' },
        expect.anything(),
      ),
    );
  });

  it('shows the new qty in a success confirmation after submit', async () => {
    const mutate = vi.fn((_payload, opts) =>
      opts?.onSuccess?.({ ok: true, materialCatalogId: 'mc-1', newQty: 150 }),
    );
    makeMutation({ mutate });
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-1' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Cargar stock/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/150/),
    );
  });

  it('shows MATERIAL_NOT_FOUND error with a clear message', async () => {
    const error = { response: { data: { code: 'MATERIAL_NOT_FOUND', error: 'Not found' } } };
    const mutate = vi.fn((_payload, opts) => opts?.onError?.(error));
    makeMutation({ mutate });
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-1' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Cargar stock/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no se encontró ese material/i),
    );
  });

  it('submit is disabled while the mutation is pending', () => {
    makeMutation({ isPending: true });
    renderModal();
    expect(screen.getByRole('button', { name: /Cargando/i })).toBeDisabled();
  });

  it('calls onClose when Cancelar is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit when qty is 0 or negative', async () => {
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-1' } });
    // qty = 0 means button should be disabled
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: /Cargar stock/i })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  // ── FIX 4: fractional qty ─────────────────────────────────────────────────

  it('FIX4 — fractional qty (12.5) is submitted as a float, not truncated to int', async () => {
    // Materials like cable in meters can have decimal quantities.
    // parseInt('12.5') = 12 (BUG), parseFloat('12.5') = 12.5 (CORRECT).
    const mutate = makeMutation();
    renderModal();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mc-1' } });
    fireEvent.change(screen.getByLabelText(/Cantidad/i), { target: { value: '12.5' } });

    // Submit button should be enabled (qty > 0)
    expect(screen.getByRole('button', { name: /Cargar stock/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Cargar stock/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { materialCatalogId: 'mc-1', qty: 12.5 },
        expect.anything(),
      ),
    );
  });

  it('FIX4 — input has step="any" to allow fractional values', () => {
    renderModal();
    const input = screen.getByLabelText(/Cantidad/i);
    // step="any" (or a decimal step) allows the browser to accept fractional values.
    // With step=1 the browser would reject 12.5 even if our JS accepts it.
    expect(input).toHaveAttribute('step', 'any');
  });
});
