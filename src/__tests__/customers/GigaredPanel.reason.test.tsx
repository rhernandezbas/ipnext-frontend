/**
 * #127 — GigaredPanel: the cancel TV modal must require a reason.
 *
 * Tests:
 * 1. The confirm dialog shows a textarea for the reason.
 * 2. The confirm button is DISABLED when reason is empty.
 * 3. After typing a reason, the confirm button enables.
 * 4. Confirming POSTs cancel with both contractId AND reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomerAccountResult, GigaredSummary } from '@/types/gigared';
import type { Contract, ContractService } from '@/types/customer';

// ── Module mocks (must be at top level for hoisting) ─────────────────────────

vi.mock('@/hooks/useGigared', () => ({
  useGigaredCustomerAccount: vi.fn(),
  useGigaredSummary: vi.fn(),
  useGigaredAllAccounts: vi.fn(),
  useLinkCic: vi.fn(),
  useRegisterAccount: vi.fn(),
  useAddTvService: vi.fn(),
  useRemoveTvService: vi.fn(),
  useSetOtt: vi.fn(),
  useCancelTv: vi.fn(),
  useCancelTvStatus: vi.fn(),
  useChangeTvPassword: vi.fn(),
  useTvCredentials: vi.fn(),
}));
vi.mock('@/components/molecules/ActivationHistoryModal/ActivationHistoryModal', () => ({
  ActivationHistoryModal: () => null,
}));
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
}));
vi.mock('@/hooks/useContractServices', () => ({
  useRemoveContractService: vi.fn(),
  useAddContractService: vi.fn(),
}));
vi.mock('@/hooks/useServiceCatalog', () => ({
  useServiceCatalog: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');
vi.mock('@/context/ConfirmContext');
vi.mock('@/components/molecules/GigaredNotConfigured/GigaredNotConfigured', () => ({
  GigaredNotConfigured: () => <div>not configured</div>,
}));

import {
  useGigaredCustomerAccount,
  useGigaredSummary,
  useGigaredAllAccounts,
  useLinkCic,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
  useCancelTv,
  useCancelTvStatus,
  useChangeTvPassword,
  useTvCredentials,
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService, useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { GigaredPanel } from '@/pages/customers/tabs/contracts/GigaredPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cancelMutate = vi.fn();

const linkedAccount = {
  cic: '0000000001',
  gigaredId: 'GIG-1',
  email: 'test@test.com',
  firstName: 'Juan',
  lastName: 'Pérez',
  registrationDate: '2024-01-01',
  services: [{ id: 's1', name: 'Gigared Play Full' }],
  internalId: 'cust-1',
  clientId: 'cust-1',
  ott: null,
};

const tvSvc: ContractService = {
  id: 'cs-tv',
  serviceCatalogId: 'sc-tv',
  name: 'TV',
  label: 'TV',
  status: 'active',
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const baseContract: Contract = {
  id: 'ct-9',
  name: null,
  type: 'internet',
  plan: 'PLAN BASE',
  status: 'active',
  price: 1000,
  startDate: '2024-01-01',
  endDate: null,
  ip: null,
  description: '',
  services: [tvSvc],
};

const summary: GigaredSummary = {
  accounts: { registered: 1, unregistered: 0, total: 1 },
  services: [{ id: 's1', name: 'Gigared Play Full', qtyAvailable: 0, qtyUsed: 1, qtyPurchased: 1 }],
};

function setupMocks(cancelResult?: unknown) {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: ['tv.cancel', 'clients.write'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      // Grant tv.cancel and clients.write; deny all other tv.* granular keys
      return perms.every((x) => x === 'tv.cancel' || x === 'clients.write' || !x.startsWith('tv.'));
    },
  } as any);

  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));

  vi.mocked(useGigaredCustomerAccount).mockReturnValue({
    data: { linked: true, account: linkedAccount } as CustomerAccountResult,
    isLoading: false,
    isError: false,
    error: null,
  } as any);

  vi.mocked(useClientContracts).mockReturnValue({
    data: [baseContract],
    isLoading: false,
  } as any);

  vi.mocked(useGigaredSummary).mockReturnValue({
    data: summary,
    isLoading: false,
  } as any);

  vi.mocked(useGigaredAllAccounts).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);

  vi.mocked(useServiceCatalog).mockReturnValue({
    data: [],
    isLoading: false,
  } as any);

  vi.mocked(useLinkCic).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useRegisterAccount).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useAddTvService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useRemoveTvService).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useSetOtt).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useChangeTvPassword).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  vi.mocked(useTvCredentials).mockReturnValue({
    data: { login: 'GIGATV', password: 'abc12345', internalId: 'cust-1' },
    isLoading: false,
    isError: false,
  } as any);
  vi.mocked(useRemoveContractService).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);
  vi.mocked(useAddContractService).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);

  vi.mocked(useCancelTv).mockReturnValue({
    mutateAsync: cancelMutate.mockResolvedValue(
      cancelResult ?? { status: 202, data: { status: 'pending' } },
    ),
    isPending: false,
  } as any);

  vi.mocked(useCancelTvStatus).mockReturnValue({
    data: { status: 'done', result: {
      removed: ['s1'], failed: [], unremovable: [], ottDisabled: true,
      local: 'synced', renew: null, localCancelled: true, renewAttempted: true,
    }},
    isLoading: false,
  } as any);
}

function renderPanel() {
  return render(
    <GigaredPanel
      customerId="cust-1"
      contractId="ct-9"
      onClose={vi.fn()}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GigaredPanel — #127 cancel TV requires reason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  async function openCancelDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
  }

  it('the cancel confirm dialog shows a textarea for the reason', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openCancelDialog(user);
    const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
    expect(within(dialog).getByRole('textbox')).toBeInTheDocument();
  });

  it('confirm button is DISABLED when reason textarea is empty', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openCancelDialog(user);
    const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar baja/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('confirm button ENABLES after typing a reason', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openCancelDialog(user);
    const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
    await user.type(within(dialog).getByRole('textbox'), 'Servicio no utilizado');
    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar baja/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('confirming POSTs cancel with BOTH contractId AND reason', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openCancelDialog(user);
    const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
    await user.type(within(dialog).getByRole('textbox'), 'Servicio no utilizado');
    await user.click(within(dialog).getByRole('button', { name: /confirmar baja/i }));
    await waitFor(() =>
      expect(cancelMutate).toHaveBeenCalledWith({
        contractId: 'ct-9',
        reason: 'Servicio no utilizado',
      }),
    );
  });
});
