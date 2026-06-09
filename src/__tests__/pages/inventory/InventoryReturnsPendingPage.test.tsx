import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import type { ReturnSuggestion } from '@/types/returns';

vi.mock('@/hooks/useReturns', () => ({
  usePendingReturns: vi.fn(),
  useConfirmReturn: vi.fn(),
  useDiscardReturn: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { usePendingReturns, useConfirmReturn, useDiscardReturn } from '@/hooks/useReturns';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import InventoryReturnsPendingPage from '@/pages/inventory/InventoryReturnsPendingPage';
import { RequirePermission } from '@/components/auth/RequirePermission';

const matched: ReturnSuggestion = {
  id: 'r1',
  serviceOrderId: 'so-1',
  taskId: 't1',
  serialNumber: 'SN-AAA-001',
  mac: 'AA:BB:CC:DD:EE:FF',
  deviceType: 'ONT Huawei',
  matchedAssetId: 'asset-1',
  status: 'pending',
  createdAt: '2026-06-01T10:00:00.000Z',
};

const needsReview: ReturnSuggestion = {
  id: 'r2',
  serviceOrderId: 'so-2',
  serialNumber: 'SN-ZZZ-999',
  matchedAssetId: null,
  status: 'needs_review',
  createdAt: '2026-06-02T10:00:00.000Z',
};

const confirmMutate = vi.fn();
const discardMutate = vi.fn();

function setHooks(data: ReturnSuggestion[], opts: { isLoading?: boolean; isError?: boolean } = {}) {
  vi.mocked(usePendingReturns).mockReturnValue({
    data,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  } as never);
  vi.mocked(useConfirmReturn).mockReturnValue({ mutate: confirmMutate, isPending: false } as never);
  vi.mocked(useDiscardReturn).mockReturnValue({ mutate: discardMutate, isPending: false } as never);
}

function allow() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [], roles: [], user: null, isLoading: false, isError: false, can: () => true,
  } as never);
}

function renderPage(node: ReactNode = <InventoryReturnsPendingPage />) {
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

describe('InventoryReturnsPendingPage — rows', () => {
  it('renders a matched (pending) row with serial, device type and a confirm action', () => {
    setHooks([matched]);
    renderPage();

    const row = screen.getByRole('listitem', { name: /SN-AAA-001/i });
    expect(within(row).getByText('SN-AAA-001')).toBeInTheDocument();
    expect(within(row).getByText(/ONT Huawei/i)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /confirmar devolución/i })).toBeInTheDocument();
  });

  it('renders a needs_review row with the "sin match" hint and the three escape-hatch actions', () => {
    setHooks([needsReview]);
    renderPage();

    const row = screen.getByRole('listitem', { name: /SN-ZZZ-999/i });
    expect(within(row).getByText(/sin match/i)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /crear en depósito/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /vincular a equipo/i })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /descartar/i })).toBeInTheDocument();
    // a needs_review row has NO direct confirm action
    expect(within(row).queryByRole('button', { name: /confirmar devolución/i })).not.toBeInTheDocument();
  });
});

describe('InventoryReturnsPendingPage — actions', () => {
  it('confirms a matched row with resolution "return"', () => {
    setHooks([matched]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /confirmar devolución/i }));
    expect(confirmMutate).toHaveBeenCalledWith({ id: 'r1', input: { resolution: 'return' } });
  });

  it('confirms a needs_review row with resolution "create" via "Crear en depósito"', () => {
    setHooks([needsReview]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /crear en depósito/i }));
    expect(confirmMutate).toHaveBeenCalledWith({ id: 'r2', input: { resolution: 'create' } });
  });

  it('discards a needs_review row', () => {
    setHooks([needsReview]);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(discardMutate).toHaveBeenCalledWith('r2');
  });
});

describe('InventoryReturnsPendingPage — empty / loading / error', () => {
  it('shows a contextual empty state that explains returns appear when a retiro closes', () => {
    setHooks([]);
    renderPage();

    expect(screen.getByText(/no hay devoluciones pendientes/i)).toBeInTheDocument();
    expect(screen.getByText(/cuando se cierra un retiro/i)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows a loading line while fetching', () => {
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

describe('InventoryReturnsPendingPage — permission gating', () => {
  it('renders NoPermissionPage instead of the list when the user lacks inventory.read', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [], roles: [], user: null, isLoading: false, isError: false, can: () => false,
    } as never);
    setHooks([matched]);

    renderPage(
      <RequirePermission permission="inventory.read">
        <InventoryReturnsPendingPage />
      </RequirePermission>,
    );

    expect(screen.getByText(/no tenés permisos/i)).toBeInTheDocument();
    expect(screen.queryByText('SN-AAA-001')).not.toBeInTheDocument();
  });
});
