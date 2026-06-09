import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { DeductionSuggestion } from '@/types/deductions';

vi.mock('@/hooks/useDeductionsPending', () => ({
  useDeductionsPending: vi.fn(),
  useConfirmDeduction: vi.fn(),
  useDiscardDeduction: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import {
  useDeductionsPending,
  useConfirmDeduction,
  useDiscardDeduction,
} from '@/hooks/useDeductionsPending';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import DeductionsPendingPage from '@/pages/inventory/DeductionsPendingPage';
import { RequirePermission } from '@/components/auth/RequirePermission';

// ── fixtures ──────────────────────────────────────────────────────────────────

const pendingRow: DeductionSuggestion = {
  id: 'd1',
  consumptionId: 'c1',
  taskId: 't1',
  taskSeq: 42,
  taskTitle: 'Instalación fibra óptica',
  materialId: 'm1',
  materialName: 'Cable coaxial',
  materialUnit: 'm',
  qty: 10,
  technicianId: 'tech-1',
  technicianName: 'Juan Pérez',
  status: 'pending',
  createdAt: '2026-06-01T10:00:00.000Z',
};

const needsReviewRow: DeductionSuggestion = {
  id: 'd2',
  consumptionId: 'c2',
  materialId: 'm2',
  materialName: 'Conector RJ45',
  qty: 5,
  technicianName: 'María García',
  status: 'needs_review',
  createdAt: '2026-06-02T10:00:00.000Z',
};

// ── helpers ───────────────────────────────────────────────────────────────────

const confirmMutate = vi.fn();
const discardMutate = vi.fn();

function setHooks(
  data: DeductionSuggestion[],
  opts: { isLoading?: boolean; isError?: boolean } = {},
) {
  vi.mocked(useDeductionsPending).mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  } as never);
  vi.mocked(useConfirmDeduction).mockReturnValue({
    mutate: confirmMutate,
    isPending: false,
    error: null,
  } as never);
  vi.mocked(useDiscardDeduction).mockReturnValue({
    mutate: discardMutate,
    isPending: false,
  } as never);
}

function allow() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  } as never);
}

function renderPage(node: ReactNode = <DeductionsPendingPage />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  allow();
});

// ── rows ──────────────────────────────────────────────────────────────────────

describe('DeductionsPendingPage — rows', () => {
  it('renders a pending row with material name, qty, technician name and a deduct action', () => {
    setHooks([pendingRow]);
    renderPage();

    const row = screen.getByRole('listitem', { name: /Cable coaxial/i });
    expect(within(row).getByText('Cable coaxial')).toBeInTheDocument();
    expect(within(row).getByText(/10/)).toBeInTheDocument();
    expect(within(row).getByText(/Juan Pérez/i)).toBeInTheDocument();
    // pending row shows a deduct button
    expect(within(row).getByRole('button', { name: /descontar stock/i })).toBeInTheDocument();
  });

  it('renders a needs_review row with review badge and the three resolution buttons, but NOT deduct', () => {
    setHooks([needsReviewRow]);
    renderPage();

    const row = screen.getByRole('listitem', { name: /Conector RJ45/i });
    // status badge
    expect(within(row).getByText(/revisar/i)).toBeInTheDocument();
    // applicable options for needs_review
    expect(within(row).getByRole('button', { name: /emitir primero/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /desde depósito/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    // deduct is only for pending
    expect(within(row).queryByRole('button', { name: /descontar stock/i })).not.toBeInTheDocument();
  });

  it('shows task link info (#seq · title) when task data is available', () => {
    setHooks([pendingRow]);
    renderPage();

    // task seq and title should appear somewhere in the row
    const row = screen.getByRole('listitem', { name: /Cable coaxial/i });
    expect(within(row).getByText(/#42/i)).toBeInTheDocument();
    expect(within(row).getByText(/Instalación fibra óptica/i)).toBeInTheDocument();
  });

  it('shows the item count badge when there are rows', () => {
    setHooks([pendingRow, needsReviewRow]);
    renderPage();

    // The count (2) should be visible
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ── actions ───────────────────────────────────────────────────────────────────

describe('DeductionsPendingPage — actions', () => {
  it('opens the resolution modal when clicking "Descontar stock" on a pending row', () => {
    setHooks([pendingRow]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /descontar stock/i }));

    // The modal should appear with the deduct option
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar descuento/i })).toBeInTheDocument();
  });

  it('calls confirm mutation with resolution "deduct" from the modal', () => {
    setHooks([pendingRow]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /descontar stock/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar descuento/i }));

    expect(confirmMutate).toHaveBeenCalledWith({
      id: 'd1',
      input: { resolution: 'deduct' },
    });
  });

  it('opens modal for needs_review and confirms with "issue-first" resolution', () => {
    setHooks([needsReviewRow]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /emitir primero/i }));

    expect(confirmMutate).toHaveBeenCalledWith({
      id: 'd2',
      input: { resolution: 'issue-first' },
    });
  });

  it('confirms needs_review row with "depot" resolution', () => {
    setHooks([needsReviewRow]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /desde depósito/i }));

    expect(confirmMutate).toHaveBeenCalledWith({
      id: 'd2',
      input: { resolution: 'depot' },
    });
  });

  it('discards a row when clicking "Descartar"', () => {
    setHooks([needsReviewRow]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));

    expect(discardMutate).toHaveBeenCalledWith('d2');
  });
});

// ── empty / loading / error ───────────────────────────────────────────────────

describe('DeductionsPendingPage — empty / loading / error', () => {
  it('shows a contextual empty state explaining where deductions come from', () => {
    setHooks([]);
    renderPage();

    expect(screen.getByText(/no hay descuentos pendientes/i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows a loading message while fetching', () => {
    setHooks([], { isLoading: true });
    renderPage();

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows an error banner when the list fails to load', () => {
    setHooks([], { isError: true });
    renderPage();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ── 409 handling ──────────────────────────────────────────────────────────────

describe('DeductionsPendingPage — 409 DEDUCTION_ALREADY_CONFIRMED', () => {
  it('shows an already-confirmed message when the hook error has code DEDUCTION_ALREADY_CONFIRMED', () => {
    const conflictError = Object.assign(new Error('Conflict'), {
      response: { status: 409, data: { code: 'DEDUCTION_ALREADY_CONFIRMED' } },
    });
    vi.mocked(useConfirmDeduction).mockReturnValue({
      mutate: confirmMutate,
      isPending: false,
      error: conflictError,
    } as never);
    vi.mocked(useDeductionsPending).mockReturnValue({
      data: [pendingRow],
      isLoading: false,
      isError: false,
    } as never);
    vi.mocked(useDiscardDeduction).mockReturnValue({
      mutate: discardMutate,
      isPending: false,
    } as never);

    renderPage();

    expect(screen.getByText(/ya fue procesado/i)).toBeInTheDocument();
  });
});

// ── permission gating ─────────────────────────────────────────────────────────

describe('DeductionsPendingPage — permission gating', () => {
  it('renders NoPermissionPage when user lacks inventory.read', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => false,
    } as never);
    setHooks([pendingRow]);

    renderPage(
      <RequirePermission permission="inventory.read">
        <DeductionsPendingPage />
      </RequirePermission>,
    );

    expect(screen.getByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('Cable coaxial')).not.toBeInTheDocument();
  });
});
