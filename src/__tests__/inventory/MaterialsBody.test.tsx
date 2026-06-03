import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MaterialType } from '@/types/materialType';

vi.mock('@/hooks/useMaterialTypes', () => ({
  useMaterialTypes: vi.fn(),
  useCreateMaterialType: vi.fn(),
  useUpdateMaterialType: vi.fn(),
  useDeleteMaterialType: vi.fn(),
}));

import {
  useMaterialTypes,
  useCreateMaterialType,
  useUpdateMaterialType,
  useDeleteMaterialType,
} from '@/hooks/useMaterialTypes';
import { MaterialsBody } from '@/pages/inventory/settings/MaterialsBody';
import { useConfirm } from '@/context/ConfirmContext';

const mockMT = (over: Partial<MaterialType> = {}): MaterialType => ({
  id: 'mt-1',
  name: 'CABLE',
  label: 'Cable coaxial',
  unit: 'm',
  active: true,
  sortOrder: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function mockHooks({
  data = [mockMT()],
  isLoading = false,
  createMutate = noop,
  updateMutate = noop,
  deleteMutate = noop,
}: {
  data?: MaterialType[];
  isLoading?: boolean;
  createMutate?: ReturnType<typeof vi.fn>;
  updateMutate?: ReturnType<typeof vi.fn>;
  deleteMutate?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(useMaterialTypes).mockReturnValue({ data, isLoading } as ReturnType<typeof useMaterialTypes>);
  vi.mocked(useCreateMaterialType).mockReturnValue({ mutateAsync: createMutate, isPending: false } as unknown as ReturnType<typeof useCreateMaterialType>);
  vi.mocked(useUpdateMaterialType).mockReturnValue({ mutateAsync: updateMutate, isPending: false } as unknown as ReturnType<typeof useUpdateMaterialType>);
  vi.mocked(useDeleteMaterialType).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteMaterialType>);
}

describe('MaterialsBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renders table with Nombre/Etiqueta/Unidad/Activo/Orden columns', () => {
    mockHooks();
    render(<MaterialsBody />);
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Etiqueta')).toBeInTheDocument();
    expect(screen.getByText('Unidad')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Orden')).toBeInTheDocument();
  });

  it('renders a row for each material type', () => {
    mockHooks({
      data: [
        mockMT({ id: 'mt-1', name: 'CABLE', label: 'Cable coaxial', unit: 'm' }),
        mockMT({ id: 'mt-2', name: 'CONECTOR', label: null, unit: 'u', active: false, sortOrder: 2 }),
      ],
    });
    render(<MaterialsBody />);
    expect(screen.getByText('CABLE')).toBeInTheDocument();
    expect(screen.getByText('CONECTOR')).toBeInTheDocument();
    expect(screen.getByText('Cable coaxial')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockHooks({ data: [], isLoading: true });
    render(<MaterialsBody />);
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('shows empty state when no materials', () => {
    mockHooks({ data: [] });
    render(<MaterialsBody />);
    expect(screen.getByText(/no hay materiales/i)).toBeInTheDocument();
  });

  it('opens create modal on click "+ Nuevo material"', async () => {
    const user = userEvent.setup();
    mockHooks();
    render(<MaterialsBody />);
    await user.click(screen.getByText(/Nuevo material/i));
    expect(screen.getByText(/Nuevo material/i, { selector: 'h2' })).toBeInTheDocument();
  });

  it('calls createMutateAsync with name, unit, and sortOrder', async () => {
    const createMutate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<MaterialsBody />);
    await user.click(screen.getByText(/Nuevo material/i));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'CABLE');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(createMutate).toHaveBeenCalledOnce());
    expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CABLE' }));
  });

  it('shows NAME_CONFLICT error in modal', async () => {
    const createMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'MATERIAL_NAME_CONFLICT' } },
    });
    const user = userEvent.setup();
    mockHooks({ data: [], createMutate });
    render(<MaterialsBody />);
    await user.click(screen.getByText(/Nuevo material/i));
    const nameInput = screen.getByLabelText(/Nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'CABLE');
    await user.click(screen.getByText('Guardar'));
    await waitFor(() => expect(screen.getByText(/Ya existe un material con ese nombre/i)).toBeInTheDocument());
  });

  it('opens edit modal when clicking Editar', async () => {
    const user = userEvent.setup();
    mockHooks({ data: [mockMT({ name: 'CABLE', label: 'Cable coaxial' })] });
    render(<MaterialsBody />);
    await user.click(screen.getByText('Editar'));
    expect(screen.getByText(/Editar material/i, { selector: 'h2' })).toBeInTheDocument();
  });

  it('calls deleteMutateAsync after confirm', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockMT()], deleteMutate });
    render(<MaterialsBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith('mt-1'));
  });

  it('shows IN_USE error when deleting a used material', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'MATERIAL_IN_USE' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockMT()], deleteMutate });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<MaterialsBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('consumos que usan este material')));
    alertSpy.mockRestore();
  });

  it('shows PROTECTED error when deleting a protected material', async () => {
    const deleteMutate = vi.fn().mockRejectedValue({
      response: { status: 409, data: { code: 'MATERIAL_PROTECTED' } },
    });
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    const user = userEvent.setup();
    mockHooks({ data: [mockMT()], deleteMutate });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<MaterialsBody />);
    await user.click(screen.getByText('Eliminar'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('no se puede eliminar')));
    alertSpy.mockRestore();
  });
});
