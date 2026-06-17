/**
 * Tests for DatosForm endDate mirror behavior (FIX 2).
 *
 * Desired behavior:
 * a. Changing startDate twice re-mirrors endDate both times (no stale guard)
 * b. After manually editing endDate, changing startDate does NOT change endDate
 * c. Mounting with an initial endDate does NOT overwrite it on mount
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatosForm } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm';

// ── Mock hooks that DatosForm calls internally ────────────────────────────────
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(() => ({ data: [] })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Minimal initial values for a task with no endDate. */
function makeInitial(overrides: Partial<{
  startDate: string | null;
  endDate: string | null;
}> = {}) {
  return {
    projectId: 'proj-1',
    assigneeId: null,
    partnerId: null,
    customerId: null,
    contractId: null,
    startDate: null,
    endDate: null,
    travelTimeTo: null,
    travelTimeFrom: null,
    address: null,
    coordinates: null,
    ...overrides,
  };
}

function renderDatosForm(initial = makeInitial()) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  return {
    onSubmit,
    ...render(
      <QueryClientProvider client={makeQC()}>
        <DatosForm
          initial={initial}
          onSubmit={onSubmit}
          isSaving={false}
          admins={[]}
          partners={[]}
          projects={[{ id: 'proj-1', title: 'Proyecto 1', isNetworkProject: false, workflowId: null } as never]}
        />
      </QueryClientProvider>,
    ),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DatosForm — endDate mirror behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) mirrors endDate = startDate + 1h on EVERY startDate change, not just the first', async () => {
    const user = userEvent.setup();
    renderDatosForm();

    const startInput = screen.getByLabelText('Inicia') as HTMLInputElement;
    const endInput = screen.getByLabelText('Termina') as HTMLInputElement;

    // First change — sets 09:00, should mirror endDate to 10:00
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T09:00');

    await waitFor(() => {
      expect(endInput.value).toBe('2025-06-01T10:00');
    });

    // Second change — sets 14:00, should mirror endDate to 15:00 (NOT stuck at 10:00)
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T14:00');

    await waitFor(() => {
      expect(endInput.value).toBe('2025-06-01T15:00');
    });
  });

  it('(b) does NOT update endDate after user manually edited it', async () => {
    const user = userEvent.setup();
    renderDatosForm();

    const startInput = screen.getByLabelText('Inicia') as HTMLInputElement;
    const endInput = screen.getByLabelText('Termina') as HTMLInputElement;

    // Set startDate — triggers auto-mirror
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T09:00');
    await waitFor(() => expect(endInput.value).toBe('2025-06-01T10:00'));

    // User manually edits endDate — now endDateTouched should be set
    await user.clear(endInput);
    await user.type(endInput, '2025-06-01T11:30');

    // Now change startDate again — endDate should NOT update
    await user.clear(startInput);
    await user.type(startInput, '2025-06-01T14:00');

    await waitFor(() => {
      // endDate should still be 11:30, NOT 15:00
      expect(endInput.value).toBe('2025-06-01T11:30');
    });
  });

  it('(c) does NOT overwrite an existing saved endDate on initial mount', async () => {
    // Use a 4-hour window: end is 4h after start (not 1h).
    // We use local-time strings to avoid timezone-conversion issues.
    const initial = makeInitial({
      startDate: '2025-06-01T09:00',
      endDate: '2025-06-01T13:00', // saved 4h window, NOT 1h
    });

    renderDatosForm(initial);

    const endInput = screen.getByLabelText('Termina') as HTMLInputElement;

    // Wait for any potential effect runs to settle
    await waitFor(() => {
      expect(endInput.value).not.toBe('');
    });

    // The endDate must NOT be overwritten to start+1h (10:00).
    // It should remain at the saved 13:00 value.
    expect(endInput.value).toBe('2025-06-01T13:00');
  });
});
