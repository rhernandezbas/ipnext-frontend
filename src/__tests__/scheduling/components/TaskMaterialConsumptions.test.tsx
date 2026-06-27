import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskMaterialConsumption } from '@/types/taskMaterial';
import type { MaterialType } from '@/types/materialType';

vi.mock('@/hooks/useTaskMaterials', () => ({
  useTaskMaterials: vi.fn(),
  useRecordTaskMaterial: vi.fn(),
  useDeleteTaskMaterial: vi.fn(),
}));

vi.mock('@/hooks/useMaterialTypes', () => ({
  useMaterialTypes: vi.fn(),
}));

import {
  useTaskMaterials,
  useRecordTaskMaterial,
  useDeleteTaskMaterial,
} from '@/hooks/useTaskMaterials';
import { useMaterialTypes } from '@/hooks/useMaterialTypes';
import { TaskMaterialConsumptions } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskMaterialConsumptions';

const mockConsumption = (over: Partial<TaskMaterialConsumption> = {}): TaskMaterialConsumption => ({
  id: 'c-1',
  taskId: 't-1',
  materialCatalogId: 'mt-1',
  materialName: 'CABLE',
  quantity: 10,
  unit: 'm',
  notes: null,
  recordedByUserName: 'Operador',
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const mockMT = (over: Partial<MaterialType> = {}): MaterialType => ({
  id: 'mt-1',
  name: 'CABLE',
  label: 'Cable coaxial',
  unit: 'm',
  active: true,
  sortOrder: 1,
  minStock: 0,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const noop = vi.fn().mockResolvedValue(undefined);

function setupMocks({
  consumptions = [mockConsumption()],
  isLoading = false,
  recordMutate = noop,
  deleteMutate = noop,
  materialTypes = [mockMT()],
  typesLoading = false,
} = {}) {
  vi.mocked(useTaskMaterials).mockReturnValue({ data: consumptions, isLoading } as ReturnType<typeof useTaskMaterials>);
  vi.mocked(useRecordTaskMaterial).mockReturnValue({ mutateAsync: recordMutate, isPending: false } as unknown as ReturnType<typeof useRecordTaskMaterial>);
  vi.mocked(useDeleteTaskMaterial).mockReturnValue({ mutateAsync: deleteMutate, isPending: false } as unknown as ReturnType<typeof useDeleteTaskMaterial>);
  vi.mocked(useMaterialTypes).mockReturnValue({ data: materialTypes, isLoading: typesLoading } as ReturnType<typeof useMaterialTypes>);
}

describe('TaskMaterialConsumptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders consumption list with materialName, quantity, unit', () => {
    render(<TaskMaterialConsumptions taskId="t-1" />);
    expect(screen.getByText('CABLE')).toBeInTheDocument();
    expect(screen.getByText(/× 10/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    setupMocks({ isLoading: true, consumptions: [] });
    render(<TaskMaterialConsumptions taskId="t-1" />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows empty state when no consumptions', () => {
    setupMocks({ consumptions: [] });
    render(<TaskMaterialConsumptions taskId="t-1" />);
    expect(screen.getByText(/sin consumos/i)).toBeInTheDocument();
  });

  it('shows the add consumption form (material dropdown + quantity + notes)', () => {
    render(<TaskMaterialConsumptions taskId="t-1" />);
    // The form should be available gated by permission (setup grants all by default)
    expect(screen.getByText(/agregar consumo/i)).toBeInTheDocument();
  });

  it('opens add form when clicking button', async () => {
    const user = userEvent.setup();
    render(<TaskMaterialConsumptions taskId="t-1" />);
    await user.click(screen.getByText(/agregar consumo/i));
    // After clicking, a form should appear with material dropdown
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('calls recordTaskMaterial with correct data on submit', async () => {
    const recordMutate = vi.fn().mockResolvedValue(undefined);
    setupMocks({ recordMutate });
    const user = userEvent.setup();
    render(<TaskMaterialConsumptions taskId="t-1" />);
    await user.click(screen.getByText(/agregar consumo/i));

    // Set quantity
    const quantityInput = screen.getByPlaceholderText(/cantidad/i);
    await user.clear(quantityInput);
    await user.type(quantityInput, '5');

    await user.click(screen.getByText('Registrar'));
    await waitFor(() => expect(recordMutate).toHaveBeenCalledWith(
      expect.objectContaining({ materialCatalogId: 'mt-1', quantity: 5 })
    ));
  });

  it('calls deleteTaskMaterial when clicking delete button', async () => {
    const deleteMutate = vi.fn().mockResolvedValue(undefined);
    setupMocks({ deleteMutate });
    const user = userEvent.setup();
    render(<TaskMaterialConsumptions taskId="t-1" />);
    const deleteBtn = screen.getByRole('button', { name: /quitar/i });
    await user.click(deleteBtn);
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith('c-1'));
  });
});
