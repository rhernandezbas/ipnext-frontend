/**
 * TaskInventorySuggestions — Batch B tests (B1.3, B2.1, B3.1).
 * Strict TDD: tests written BEFORE implementation.
 *
 * Mock strategy:
 * - setup.ts globally mocks useMyPermissions/useCan to grant all.
 * - Denial tests override via vi.mocked(useCan).mockImplementation(...)
 * - useTaskInventorySuggestions is mocked at module level.
 * - useCreateManualSuggestion is mocked where needed.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TaskInventorySuggestion } from '@/types/serviceInventory';

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock('@/hooks/useDeviceTypes', () => ({
  useDeviceTypes: vi.fn(() => ({
    data: [
      { id: 'dt-1', name: 'ONU', label: 'Óptico', active: true, sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'dt-2', name: 'ANTENA', label: 'Antena', active: true, sortOrder: 2, createdAt: '', updatedAt: '' },
      { id: 'dt-3', name: 'ROUTER', label: 'Router', active: true, sortOrder: 3, createdAt: '', updatedAt: '' },
    ],
    isLoading: false,
  })),
}));

vi.mock('@/hooks/useServiceInventory', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useServiceInventory')>();
  return {
    ...original,
    useTaskInventorySuggestions: vi.fn(),
    useCreateManualSuggestion: vi.fn(),
    useConfirmSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useDiscardSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useReplaceSuggestion: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    useCorrectSuggestionType: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  };
});

vi.mock('@/api/serviceInventory.api', () => ({
  createManualSuggestion: vi.fn(),
  listTaskInventorySuggestions: vi.fn(),
  confirmInventorySuggestion: vi.fn(),
  discardInventorySuggestion: vi.fn(),
  replaceInventorySuggestion: vi.fn(),
  correctSuggestionType: vi.fn(),
}));

import {
  useTaskInventorySuggestions,
  useCreateManualSuggestion,
} from '@/hooks/useServiceInventory';
import { useCan } from '@/hooks/useMyPermissions';
import { TaskInventorySuggestions } from './TaskInventorySuggestions';

// ── Fixture helpers ──────────────────────────────────────────────────────────
function makeSuggestion(over: Partial<TaskInventorySuggestion> = {}): TaskInventorySuggestion {
  return {
    id: 'sug-1',
    taskId: 'task-1',
    kind: 'DEVICE',
    deviceType: 'ONU',
    qwenDeviceType: null,
    serialNumber: 'SN-001',
    mac: null,
    materialDesc: null,
    quantity: null,
    unit: null,
    source: 'OCR',
    photoUrl: null,
    status: 'pending',
    confirmedItemId: null,
    ...over,
  };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderComponent(taskId = 'task-1') {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <TaskInventorySuggestions taskId={taskId} />
    </QueryClientProvider>,
  );
}

// ── B1.3: useCreateManualSuggestion hook contract ────────────────────────────
describe('useCreateManualSuggestion — hook (B1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls mutation with the correct input when form is submitted with valid data', async () => {
    const mutateFn = vi.fn();
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);

    renderComponent('task-42');

    // Open the form
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    // Form is open — fill DEVICE fields (kind=DEVICE is default)
    const snInput = screen.getByLabelText(/número de serie/i);
    await userEvent.type(snInput, 'SN-TEST');

    // Use exact text to avoid matching "Agregar ítem" toggle button
    const buttons = screen.getAllByRole('button', { name: /agregar/i });
    const submitBtn = buttons.find(b => b.textContent?.trim() === 'Agregar')!;
    await userEvent.click(submitBtn);

    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'DEVICE', serialNumber: 'SN-TEST' }),
      expect.anything(),
    );
  });

  it('hook is initialized with the correct taskId from ManualSuggestionForm', async () => {
    // The ManualSuggestionForm calls useCreateManualSuggestion(taskId) internally.
    // We verify it's called with the right taskId by checking the mock is invoked correctly.
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);

    renderComponent('task-99');

    // Open the form to trigger ManualSuggestionForm mount which calls the hook
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    expect(vi.mocked(useCreateManualSuggestion)).toHaveBeenCalledWith('task-99');
  });
});

// ── B2.1: ManualSuggestionForm component tests ────────────────────────────────
describe('ManualSuggestionForm — fields and validation (B2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);
  });

  it('DEVICE fields visible when kind=DEVICE (default)', async () => {
    renderComponent();
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    // DEVICE fields should be visible
    expect(screen.getByLabelText(/número de serie/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mac/i)).toBeInTheDocument();
    // MATERIAL fields should NOT be visible
    expect(screen.queryByLabelText(/descripción/i)).toBeNull();
  });

  it('MATERIAL fields visible when kind=MATERIAL', async () => {
    renderComponent();
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    // Switch to MATERIAL
    const materialRadio = screen.getByRole('radio', { name: /material/i });
    await userEvent.click(materialRadio);

    // MATERIAL fields should now be visible
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
    // DEVICE fields should NOT be visible
    expect(screen.queryByLabelText(/número de serie/i)).toBeNull();
  });

  it('submit DEVICE with no SN/MAC shows incompleteHint, no API call', async () => {
    const mutateFn = vi.fn();
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);

    renderComponent();
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    // Submit without filling SN or MAC — click the form submit button (exact "Agregar")
    const buttons = screen.getAllByRole('button', { name: /agregar/i });
    const submitBtn = buttons.find(b => b.textContent?.trim() === 'Agregar')!;
    await userEvent.click(submitBtn);

    // incompleteHint must appear
    expect(screen.getByText(/falta sn o mac/i)).toBeInTheDocument();
    // API must NOT be called
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('successful DEVICE submit calls mutation + collapses form', async () => {
    const mutateFn = vi.fn((_input, options?: { onSuccess?: () => void }) => {
      // Simulate immediate success
      options?.onSuccess?.();
    });
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);

    renderComponent();
    const addBtn = screen.getByRole('button', { name: /agregar ítem/i });
    await userEvent.click(addBtn);

    // Fill in SN
    const snInput = screen.getByLabelText(/número de serie/i);
    await userEvent.type(snInput, 'SN-001');

    // Click the form submit (exact "Agregar", not "Agregar ítem")
    const buttons = screen.getAllByRole('button', { name: /agregar/i });
    const submitBtn = buttons.find(b => b.textContent?.trim() === 'Agregar')!;
    await userEvent.click(submitBtn);

    // mutation called
    expect(mutateFn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'DEVICE', serialNumber: 'SN-001' }),
      expect.anything(),
    );

    // form collapses — SN input no longer visible
    expect(screen.queryByLabelText(/número de serie/i)).toBeNull();
  });
});

// ── B3.1: TaskInventorySuggestions panel restructure ─────────────────────────
describe('TaskInventorySuggestions — Agregar ítem button (B3.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateManualSuggestion).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateManualSuggestion>);
    // Default: useCan grants all (from setup.ts)
  });

  it('button visible in empty state with inventory.write', () => {
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);

    renderComponent();

    expect(screen.getByRole('button', { name: /agregar ítem/i })).toBeInTheDocument();
  });

  it('button visible in non-empty state with inventory.write', () => {
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [makeSuggestion()],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);

    renderComponent();

    expect(screen.getByRole('button', { name: /agregar ítem/i })).toBeInTheDocument();
  });

  it('button NOT rendered without inventory.write', () => {
    vi.mocked(useTaskInventorySuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTaskInventorySuggestions>);

    // Override useCan to deny inventory.write
    vi.mocked(useCan).mockImplementation((perm: string) => perm !== 'inventory.write');

    renderComponent();

    expect(screen.queryByRole('button', { name: /agregar ítem/i })).toBeNull();
  });
});
