import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount, CustomerAccountResult, GigaredSummary } from '@/types/gigared';

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
  useChangeTvPassword: vi.fn(),
  useTvCredentials: vi.fn(),
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
  useChangeTvPassword,
  useTvCredentials,
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService, useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { GigaredPanel } from '@/pages/customers/tabs/contracts/GigaredPanel';
import type { Contract, ContractService } from '@/types/customer';

/** The granular TV permission keys that replaced tv.write. */
const TV_GRANULAR_KEYS = ['tv.link', 'tv.register', 'tv.packs', 'tv.ott', 'tv.cancel'] as const;

/** Override the globally-permissive useMyPermissions mock to DENY all granular tv.* keys. */
function denyTvWrite() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((x) => !(TV_GRANULAR_KEYS as readonly string[]).includes(x));
    },
  } as unknown as ReturnType<typeof useMyPermissions>);
}

/** Grant only the given granular tv key (plus everything else except the other tv keys). */
function grantOnly(tvKey: typeof TV_GRANULAR_KEYS[number]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [tvKey],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((x) =>
        x === tvKey || !(TV_GRANULAR_KEYS as readonly string[]).includes(x),
      );
    },
  } as unknown as ReturnType<typeof useMyPermissions>);
}

const linkedAccount: GigaredAccount = {
  cic: '0000000001',
  gigaredId: 'g-1',
  email: 'a@b.com',
  firstName: 'Ana',
  lastName: 'García',
  registrationDate: '2026-01-01T00:00:00Z',
  services: [{ id: 's1', name: 'Gigared Play Full' }],
  internalId: 'cust-1',
  // #47j Fix 1 — OTT status is now the FROZEN 'enabled' | 'disabled' | null.
  ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: 'enabled' },
};

// #47j Fix 2 — an account whose ONLY pack is a removable (non-base) one, so the
// "Quitar" flow still has a target. "Gigared Play Full" is the partner BASE pack
// and intentionally has no "Quitar" (see Fix 2 block), so the removal tests must
// not lean on it.
const removableAccount: GigaredAccount = {
  ...linkedAccount,
  services: [{ id: 's2', name: 'Gigared Play Lite' }],
};

const summary: GigaredSummary = {
  accounts: { registered: 1, unregistered: 0, total: 1 },
  services: [
    { id: 's1', name: 'Gigared Play Full', qtyAvailable: 0, qtyUsed: 1, qtyPurchased: 1 },
    { id: 's2', name: 'Gigared Play Lite', qtyAvailable: 3, qtyUsed: 0, qtyPurchased: 3 },
  ],
};

const addMutate = vi.fn();
const linkMutate = vi.fn();
const registerMutate = vi.fn();
const removeMutate = vi.fn();
const ottMutate = vi.fn();
const cancelMutate = vi.fn();
const pwMutate = vi.fn();
const onClose = vi.fn();
// #47c — local ContractService item mutations (the #43 endpoints) reused inside
// the panel: remove the local TV line, and add a plain local TV item.
const removeLocalMutate = vi.fn();
const addLocalMutate = vi.fn();

// A TV entry in the service catalog (drives Fix 3's "add only the local item").
const tvCatalogEntry = { id: 'sc-tv', name: 'TV', label: 'TV', active: true };

// ── Contract fixtures for F1 (cross-contract TV ownership) ──────────────────
const tvService = (over: Partial<ContractService> = {}): ContractService => ({
  id: 'cs-tv',
  serviceCatalogId: 'sc-tv',
  name: 'TV',
  label: 'TV',
  status: 'active',
  notes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const contract = (id: string, services: ContractService[] = [], over: Partial<Contract> = {}): Contract => ({
  id,
  name: null,
  type: 'internet',
  plan: `PLAN ${id}`,
  status: 'active',
  price: 1000,
  startDate: '2024-01-01',
  endDate: null,
  ip: null,
  description: '',
  services,
  ...over,
});

function mockQuery(over: {
  account?: CustomerAccountResult;
  accountError?: unknown;
  addResult?: unknown;
  removeResult?: unknown;
  /**
   * The cancel mutation resolved value. Shape: `{ status: number; data: CancelTvResult }`.
   * Defaults to a 200 full-success result.
   */
  cancelResult?: unknown;
  contracts?: Contract[];
  /** Picker accounts keyed by the status the hook is called with. */
  allAccounts?: Partial<Record<'registered' | 'unregistered', GigaredAccount[]>>;
  allAccountsLoading?: boolean;
  allAccountsError?: boolean;
  /** #65 H3 — the credentials the dedicated endpoint returns. Defaults to a present pair. */
  tvCredentials?: { login: string | null; password: string | null };
  tvCredentialsLoading?: boolean;
  tvCredentialsError?: boolean;
} = {}) {
  // The panel calls useGigaredAllAccounts('registered') for the link picker and
  // useGigaredAllAccounts('unregistered') for the register-CIC select. Return a
  // list keyed by the status argument so both selects get the right data.
  vi.mocked(useGigaredAllAccounts).mockImplementation((status: 'registered' | 'unregistered') => ({
    data: over.allAccounts?.[status] ?? [],
    isLoading: !!over.allAccountsLoading,
    isError: !!over.allAccountsError,
    refetch: vi.fn(),
  }) as unknown as ReturnType<typeof useGigaredAllAccounts>);

  vi.mocked(useClientContracts).mockReturnValue({
    data: over.contracts ?? [],
    isLoading: false,
  } as unknown as ReturnType<typeof useClientContracts>);

  vi.mocked(useGigaredCustomerAccount).mockReturnValue({
    data: over.account,
    isLoading: false,
    isError: !!over.accountError,
    error: over.accountError,
  } as unknown as ReturnType<typeof useGigaredCustomerAccount>);

  vi.mocked(useGigaredSummary).mockReturnValue({
    data: summary,
    isLoading: false,
  } as ReturnType<typeof useGigaredSummary>);

  vi.mocked(useLinkCic).mockReturnValue({ mutateAsync: linkMutate, isPending: false } as unknown as ReturnType<typeof useLinkCic>);
  vi.mocked(useRegisterAccount).mockReturnValue({ mutateAsync: registerMutate, isPending: false } as unknown as ReturnType<typeof useRegisterAccount>);
  vi.mocked(useAddTvService).mockReturnValue({
    mutateAsync: addMutate.mockResolvedValue(over.addResult ?? { gigared: 'ok', local: 'ok' }),
    isPending: false,
  } as unknown as ReturnType<typeof useAddTvService>);
  vi.mocked(useRemoveTvService).mockReturnValue({
    mutateAsync: removeMutate.mockResolvedValue(over.removeResult ?? { gigared: 'ok', local: 'ok' }),
    isPending: false,
  } as unknown as ReturnType<typeof useRemoveTvService>);
  vi.mocked(useSetOtt).mockReturnValue({ mutateAsync: ottMutate, isPending: false } as unknown as ReturnType<typeof useSetOtt>);
  vi.mocked(useCancelTv).mockReturnValue({
    mutateAsync: cancelMutate.mockResolvedValue(
      over.cancelResult ?? {
        status: 200,
        data: {
          removed: ['s2'], failed: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        },
      },
    ),
    isPending: false,
  } as unknown as ReturnType<typeof useCancelTv>);
  vi.mocked(useChangeTvPassword).mockReturnValue({ mutateAsync: pwMutate, isPending: false } as unknown as ReturnType<typeof useChangeTvPassword>);
  // #65 H3 — the lazy credentials query. Default: present pair, not loading.
  vi.mocked(useTvCredentials).mockReturnValue({
    data: over.tvCredentials ?? { login: 'GIGA2432', password: 'ip243200' },
    isLoading: !!over.tvCredentialsLoading,
    isError: !!over.tvCredentialsError,
  } as unknown as ReturnType<typeof useTvCredentials>);

  vi.mocked(useRemoveContractService).mockReturnValue({
    mutateAsync: removeLocalMutate.mockResolvedValue(undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useRemoveContractService>);
  vi.mocked(useAddContractService).mockReturnValue({
    mutateAsync: addLocalMutate.mockResolvedValue(undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useAddContractService>);
  vi.mocked(useServiceCatalog).mockReturnValue({
    data: [tvCatalogEntry],
    isLoading: false,
  } as unknown as ReturnType<typeof useServiceCatalog>);
}

function renderPanel(customer?: { name: string; email: string; grClienteId?: string | null }) {
  return render(
    <MemoryRouter>
      <GigaredPanel
        customerId="cust-1"
        contractId="ct-9"
        onClose={onClose}
        customer={customer}
      />
    </MemoryRouter>,
  );
}

/** A registered, UNLINKED account (internalId null) — eligible for the picker. */
function pickAccount(over: Partial<GigaredAccount> = {}): GigaredAccount {
  return {
    cic: '0000000123',
    gigaredId: 'g-123',
    email: null,
    firstName: 'JUAN',
    lastName: 'PEREZ',
    registrationDate: null,
    services: [{ id: 'p1', name: 'Gigared Play Full' }],
    internalId: null,
    ott: null,
    ...over,
  };
}

describe('GigaredPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    } as unknown as ReturnType<typeof useMyPermissions>);
    // clearAllMocks wipes the global setup impl — re-arm the auto-confirm.
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renders as a dialog (modal) with a close control', () => {
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
  });

  it('clicking the close control calls onClose', async () => {
    const user = userEvent.setup();
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  // ── State 1: NOT_CONFIGURED ───────────────────────────────────────────────
  it('state 1: NOT_CONFIGURED → renders the banner', () => {
    mockQuery({ accountError: { response: { status: 503, data: { code: 'GIGARED_NOT_CONFIGURED' } } } });
    renderPanel();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  // ── State 2: not linked ───────────────────────────────────────────────────
  it('state 2: not linked → shows link form and collapsible register form', () => {
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    // The link form now defaults to the picker; its Vincular button is present.
    expect(screen.getByRole('button', { name: /vincular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar cuenta nueva/i })).toBeInTheDocument();
  });

  it('state 2: submitting the link form calls linkCic with the CIC and contractId', async () => {
    const user = userEvent.setup();
    linkMutate.mockResolvedValue({ account: linkedAccount });
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
    await user.type(screen.getByLabelText(/^cic$/i), '0000000001');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    // #47f — the link carries the effective (owner) contractId so the BE
    // reconciles the local TV item onto it.
    await waitFor(() =>
      expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000001', contractId: 'ct-9' }),
    );
  });

  it('state 2: 404 CIC_NOT_FOUND → "El CIC no existe en Gigared"', async () => {
    const user = userEvent.setup();
    linkMutate.mockRejectedValue({ response: { status: 404, data: { code: 'CIC_NOT_FOUND' } } });
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
    await user.type(screen.getByLabelText(/^cic$/i), '999');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    await waitFor(() => expect(screen.getByText(/el cic no existe en gigared/i)).toBeInTheDocument());
  });

  it('state 2: register 422 GIGARED_REJECTED shows the partner `detail`', async () => {
    const user = userEvent.setup();
    registerMutate.mockRejectedValue({
      response: { status: 422, data: { code: 'GIGARED_REJECTED', detail: 'El email ya está en uso en Gigared' } },
    });
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/apellido/i), 'García');
    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
    await user.type(screen.getByLabelText(/^cic$/i), '0001');
    // #70 rework — sin campo de contraseña: el submit se destraba solo con los datos.
    await user.click(screen.getByRole('button', { name: /^registrar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/el email ya está en uso en gigared/i)).toBeInTheDocument(),
    );
  });

  // ── State 3: linked ───────────────────────────────────────────────────────
  it('state 3: linked → shows account, services and the Suspender TV action', () => {
    // #47k — OTT enabled → the semantic "Suspender TV" action stands in for the
    // old raw checkbox.
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('Gigared Play Full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /suspender tv/i })).toBeInTheDocument();
  });

  it('state 3: add pack uses THIS contractId (no contract picker)', async () => {
    const user = userEvent.setup();
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    // No contract selector — the panel is scoped to its contract.
    expect(screen.queryByLabelText(/^contrato$/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
    await user.click(screen.getByRole('button', { name: /agregar$/i }));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-9' }),
    );
  });

  it('state 3: 207 local failed on add → amber notice with retry', async () => {
    const user = userEvent.setup();
    mockQuery({
      account: { linked: true, account: linkedAccount },
      addResult: { gigared: 'ok', local: 'failed', localError: 'db down' },
    });
    renderPanel();
    await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
    await user.click(screen.getByRole('button', { name: /agregar$/i }));
    await waitFor(() => expect(screen.getByText(/falló el registro local/i)).toBeInTheDocument());
  });

  it('state 3: remove uses THIS contractId', async () => {
    const user = userEvent.setup();
    // #47j Fix 2 — use a removable (non-base) pack; "Gigared Play Full" is base.
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    const dialogs = screen.getAllByRole('dialog');
    const confirm = dialogs[dialogs.length - 1];
    const { within } = await import('@testing-library/react');
    await user.click(within(confirm).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-9' }),
    );
  });

  it('state 3: Suspender TV calls setOtt { enabled: false }', async () => {
    const user = userEvent.setup();
    ottMutate.mockResolvedValue({ ok: true });
    // OTT enabled → "Suspender TV" behind a soft confirm (auto-true in beforeEach).
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /suspender tv/i }));
    await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: false }));
  });

  // ── granular TV permission gating ────────────────────────────────────────
  it('tv.read only — all operational buttons hidden', () => {
    denyTvWrite();
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.queryByRole('button', { name: /vincular/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspender tv|reactivar tv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja tv/i })).not.toBeInTheDocument();
  });

  it('tv.link only — Vincular shown; register/packs/ott/cancel hidden', () => {
    grantOnly('tv.link');
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    expect(screen.getByRole('button', { name: /vincular/i })).toBeInTheDocument();
  });

  it('tv.link only — Vincular hidden in linked state (no packs/ott/cancel)', () => {
    grantOnly('tv.link');
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspender tv|reactivar tv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja tv/i })).not.toBeInTheDocument();
  });

  it('tv.register only — Registrar button shown when form is expanded', async () => {
    const user = userEvent.setup();
    grantOnly('tv.register');
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
    expect(screen.getByRole('button', { name: /^registrar$/i })).toBeInTheDocument();
    // Vincular must still be hidden
    expect(screen.queryByRole('button', { name: /^vincular$/i })).not.toBeInTheDocument();
  });

  it('tv.packs only — Agregar and Quitar shown; ott/cancel hidden', () => {
    grantOnly('tv.packs');
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspender tv|reactivar tv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja tv/i })).not.toBeInTheDocument();
  });

  it('tv.ott only — Suspender/Reactivar shown; packs/cancel hidden', () => {
    grantOnly('tv.ott');
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.getByRole('button', { name: /suspender tv/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja tv/i })).not.toBeInTheDocument();
  });

  it('tv.cancel only — Dar de baja shown; ott/packs hidden', () => {
    grantOnly('tv.cancel');
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.getByRole('button', { name: /dar de baja tv/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspender tv|reactivar tv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
  });

  it('* (super_admin) — all controls visible', () => {
    // beforeEach already sets can: () => true for '*'
    mockQuery({ account: { linked: true, account: removableAccount } });
    renderPanel();
    expect(screen.getByRole('button', { name: /suspender tv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agregar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dar de baja tv/i })).toBeInTheDocument();
  });

  // ── F1: cross-contract TV ownership (one owner contract per account) ────────
  // The panel derives an effectiveContractId: if ANY contract owns the local TV
  // item (services[] has name==='TV' with status active), that contract is the
  // owner and ALL mutations target it regardless of which card opened the panel.
  describe('F1 — cross-contract ownership', () => {
    it('add from B with owner A → mutation carries owner contractId A + hint', async () => {
      const user = userEvent.setup();
      // Owner is contract A (ct-A holds the TV item); panel opened from ct-9.
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-A', [tvService()]), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      expect(screen.getByText(/la tv vive en el contrato/i)).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() =>
        expect(addMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-A' }),
      );
    });

    it('remove from B with owner A → DELETE carries owner contractId A', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: removableAccount },
        contracts: [contract('ct-A', [tvService()]), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      // Exact "Quitar" → the Gigared service line button (the #47c local-item
      // remove button reads "Quitar el ítem TV de este contrato").
      await user.click(screen.getByRole('button', { name: /^quitar$/i }));
      const dialogs = screen.getAllByRole('dialog');
      const confirm = dialogs[dialogs.length - 1];
      const { within } = await import('@testing-library/react');
      await user.click(within(confirm).getByRole('button', { name: /^quitar$/i }));
      await waitFor(() =>
        expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-A' }),
      );
    });

    it('first activation from B (no owner) → uses the opening contractId B', async () => {
      const user = userEvent.setup();
      // No contract owns TV yet → the opening card (ct-9) defines the owner.
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-A', []), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      expect(screen.queryByText(/la tv vive en el contrato/i)).not.toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() =>
        expect(addMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-9' }),
      );
    });

    it('owner is the opening contract itself → no hint (TV lives here)', () => {
      // ct-9 (the prop) is itself the owner → no "lives elsewhere" hint.
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-9', [tvService()]), contract('ct-A', [])],
      });
      renderPanel(); // contractId="ct-9"
      expect(screen.queryByText(/la tv vive en el contrato/i)).not.toBeInTheDocument();
    });

    it('an INACTIVE TV item does not count as ownership → uses opening contract', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-A', [tvService({ status: 'inactive' })]), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      expect(screen.queryByText(/la tv vive en el contrato/i)).not.toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() =>
        expect(addMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-9' }),
      );
    });
  });

  // ── F2: error codes pinned on add (mapped messages) ─────────────────────────
  describe('F2 — add error mapping', () => {
    it('TV_CATALOG_MISSING → "Falta el servicio TV en el catálogo"', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      addMutate.mockReset().mockRejectedValue({ response: { status: 422, data: { code: 'TV_CATALOG_MISSING' } } });
      renderPanel();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() =>
        expect(screen.getByText(/falta el servicio "tv" en el catálogo/i)).toBeInTheDocument(),
      );
    });

    it('CONTRACT_NOT_FOUND → "El contrato elegido no es válido"', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      addMutate.mockReset().mockRejectedValue({ response: { status: 404, data: { code: 'CONTRACT_NOT_FOUND' } } });
      renderPanel();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() =>
        expect(screen.getByText(/el contrato elegido no es válido/i)).toBeInTheDocument(),
      );
    });
  });

  // ── F3: 403 explicit (no permission) on the account load ───────────────────
  describe('F3 — 403 explicit', () => {
    it('a 403 on the account query → "No tenés permiso para gestionar TV" (not the retry)', () => {
      mockQuery({ accountError: { response: { status: 403, data: {} } } });
      renderPanel();
      expect(screen.getByText(/no tenés permiso para gestionar tv/i)).toBeInTheDocument();
      // Must NOT show the transient retry banner.
      expect(screen.queryByText(/reintentá en unos segundos/i)).not.toBeInTheDocument();
    });
  });

  // ── F4: OTT hint auto-dismisses ────────────────────────────────────────────
  describe('F4 — OTT hint auto-dismiss', () => {
    it('the "será habilitado" hint disappears after the timeout', async () => {
      vi.useFakeTimers();
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        ottMutate.mockResolvedValue({ ok: true });
        vi.mocked(useSetOtt).mockReturnValue({
          mutateAsync: ottMutate,
          isPending: false,
          isSuccess: true,
        } as unknown as ReturnType<typeof useSetOtt>);
        mockQuery({ account: { linked: true, account: linkedAccount } });
        // re-apply the isSuccess override (mockQuery resets useSetOtt)
        vi.mocked(useSetOtt).mockReturnValue({
          mutateAsync: ottMutate,
          isPending: false,
          isSuccess: true,
        } as unknown as ReturnType<typeof useSetOtt>);
        renderPanel();
        expect(screen.getByText(/será habilitado en los próximos minutos/i)).toBeInTheDocument();
        await vi.advanceTimersByTimeAsync(5000);
        expect(screen.queryByText(/será habilitado en los próximos minutos/i)).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // ── Restored TvTab coverage (moved into the panel) ─────────────────────────
  describe('restored coverage', () => {
    it('207 local failed on REMOVE → amber notice with retry', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: removableAccount },
        removeResult: { gigared: 'ok', local: 'failed', localError: 'db down' },
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /quitar/i }));
      const dialogs = screen.getAllByRole('dialog');
      const confirm = dialogs[dialogs.length - 1];
      const { within } = await import('@testing-library/react');
      await user.click(within(confirm).getByRole('button', { name: /^quitar$/i }));
      await waitFor(() => expect(screen.getByText(/falló el registro local/i)).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('OTT failed toggle surfaces a visible error', async () => {
      const user = userEvent.setup();
      ottMutate.mockRejectedValue({ response: { status: 500, data: {} } });
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /suspender tv/i }));
      await waitFor(() =>
        expect(screen.getByText(/no se pudo cambiar (el )?ott/i)).toBeInTheDocument(),
      );
    });

    it('OTT pending shows "Aplicando…"', () => {
      vi.mocked(useSetOtt).mockReturnValue({
        mutateAsync: ottMutate,
        isPending: true,
      } as unknown as ReturnType<typeof useSetOtt>);
      mockQuery({ account: { linked: true, account: linkedAccount } });
      vi.mocked(useSetOtt).mockReturnValue({
        mutateAsync: ottMutate,
        isPending: true,
      } as unknown as ReturnType<typeof useSetOtt>);
      renderPanel();
      expect(screen.getByText(/aplicando…/i)).toBeInTheDocument();
    });

    it('register success (email ficticio, default) → "Cuenta registrada" SIN claim de email', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount, credentialsPersisted: true });
      mockQuery({ account: { linked: false, account: null } });
      // #70 (rework) — sin campo de password: el form solo prefillea el email ficticio; la clave la genera el BE.
      renderPanel({ name: 'García Ana', email: 'a@b.com', grClienteId: '243200' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(screen.getByText(/^Cuenta registrada\s*\.$/)).toBeInTheDocument(),
      );
      // #65 — el email es ficticio y el checkbox arranca off → NO se afirma haber enviado email.
      expect(screen.queryByText(/se envió el email de activación/i)).not.toBeInTheDocument();
    });

    // #65 fix wave M7 — register OK but credentials not persisted → sutil warning.
    it('M7 — register con credentialsPersisted:false → warning "la clave no quedó guardada"', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount, credentialsPersisted: false });
      mockQuery({ account: { linked: false, account: null } });
      // #70 (rework) — el grClienteId solo alimenta el email ficticio; la clave la genera el BE.
      renderPanel({ name: 'García Ana', email: 'a@b.com', grClienteId: '243200' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(screen.getByText(/la clave no quedó guardada en el sistema/i)).toBeInTheDocument(),
      );
    });

    it('409 CIC_ALREADY_LINKED → "ya está vinculado a otro cliente"', async () => {
      const user = userEvent.setup();
      linkMutate.mockRejectedValue({ response: { status: 409, data: { code: 'CIC_ALREADY_LINKED' } } });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '123');
      await user.click(screen.getByRole('button', { name: /vincular/i }));
      await waitFor(() =>
        expect(screen.getByText(/ese cic ya está vinculado a otro cliente/i)).toBeInTheDocument(),
      );
    });
  });

  // ── #47c Fix 2: remove the LOCAL TV item from the contract ──────────────────
  // The local TV ContractService line lives on the owner contract. The panel
  // exposes an "Ítem local" section to remove it via the #43 endpoint
  // (useRemoveContractService → DELETE /contracts/:id/services/:lineId), gated by
  // clients.write (the chips' permission), NOT the granular tv.* keys.
  describe('Fix 2 — remove local TV item', () => {
    it('not-linked + owner contract holds the local TV line → shows the remove action', () => {
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel(); // contractId="ct-9"
      expect(
        screen.getByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      ).toBeInTheDocument();
    });

    it('clicking the local-remove action fires useRemoveContractService for the owner line', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel(); // contractId="ct-9"
      await user.click(
        screen.getByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      );
      await waitFor(() =>
        expect(removeLocalMutate).toHaveBeenCalledWith({ contractId: 'ct-9', id: 'cs-tv' }),
      );
    });

    it('cancelling the confirm does NOT remove the local item', async () => {
      const user = userEvent.setup();
      vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel();
      await user.click(
        screen.getByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      );
      await waitFor(() => expect(useConfirm).toHaveBeenCalled());
      expect(removeLocalMutate).not.toHaveBeenCalled();
    });

    it('no local TV item on any contract → the local-remove action is absent', () => {
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [])],
      });
      renderPanel();
      expect(
        screen.queryByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      ).not.toBeInTheDocument();
    });

    // #47i Fix 3 — the "Ítem local" remove section lives ONLY in the unlinked
    // view now. In the linked flow the item inactivates on its own when the last
    // pack is removed (reconcile), so the manual remove must NOT appear.
    it('linked + local item present → the local-remove section is ABSENT (Fix 3)', () => {
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel();
      expect(
        screen.queryByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/no toca gigared/i)).not.toBeInTheDocument();
    });

    it('without clients.write the local-remove action is hidden', () => {
      vi.mocked(useMyPermissions).mockReturnValue({
        permissions: [],
        roles: [],
        user: null,
        isLoading: false,
        isError: false,
        can: (p: string | string[]) => {
          const perms = Array.isArray(p) ? p : [p];
          return perms.every((x) => x !== 'clients.write');
        },
      } as unknown as ReturnType<typeof useMyPermissions>);
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel();
      expect(
        screen.queryByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── #47c Fix 3: in the unlinked state, add ONLY the local item (no Gigared) ──
  describe('Fix 3 — add only the local item from the unlinked state', () => {
    it('not-linked → hint clarifies nothing is created until you act', () => {
      mockQuery({ account: { linked: false, account: null }, contracts: [contract('ct-9', [])] });
      renderPanel();
      expect(screen.getByText(/no se agregó nada/i)).toBeInTheDocument();
    });

    it('the secondary action creates the plain local ContractService for TV', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null }, contracts: [contract('ct-9', [])] });
      renderPanel(); // contractId="ct-9"
      await user.click(
        screen.getByRole('button', { name: /agregar solo el ítem local/i }),
      );
      await waitFor(() =>
        expect(addLocalMutate).toHaveBeenCalledWith({
          contractId: 'ct-9',
          payload: { serviceCatalogId: 'sc-tv' },
        }),
      );
    });

    it('when the contract already owns the local TV item, the add action is hidden', () => {
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel();
      expect(
        screen.queryByRole('button', { name: /agregar solo el ítem local/i }),
      ).not.toBeInTheDocument();
    });

    it('without clients.write the add-local action is hidden', () => {
      vi.mocked(useMyPermissions).mockReturnValue({
        permissions: [],
        roles: [],
        user: null,
        isLoading: false,
        isError: false,
        can: (p: string | string[]) => {
          const perms = Array.isArray(p) ? p : [p];
          return perms.every((x) => x !== 'clients.write');
        },
      } as unknown as ReturnType<typeof useMyPermissions>);
      mockQuery({ account: { linked: false, account: null }, contracts: [contract('ct-9', [])] });
      renderPanel();
      expect(
        screen.queryByRole('button', { name: /agregar solo el ítem local/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── #47g-3: surface the partner `detail` on EVERY gigared error ─────────────
  // The BE now sends `detail` on ALL gigared errors (422/502/503), not just the
  // 422 register reject. Link/add/remove/ott must show "{generic}: {detail}" when
  // a detail comes, falling back to the generic message when it does not.
  describe('#47g-3 — partner detail on every error', () => {
    it('link error with detail → shows the detail', async () => {
      const user = userEvent.setup();
      linkMutate.mockRejectedValue({
        response: { status: 502, data: { code: 'GIGARED_UNAVAILABLE', detail: 'Gigared timeout (502)' } },
      });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '123');
      await user.click(screen.getByRole('button', { name: /vincular/i }));
      await waitFor(() => expect(screen.getByText(/gigared timeout \(502\)/i)).toBeInTheDocument());
    });

    it('add error with detail → shows the detail', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      addMutate.mockReset().mockRejectedValue({
        response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE', detail: 'Servicio no disponible' } },
      });
      renderPanel();
      await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
      await user.click(screen.getByRole('button', { name: /agregar$/i }));
      await waitFor(() => expect(screen.getByText(/servicio no disponible/i)).toBeInTheDocument());
    });

    it('OTT error with detail → shows the detail', async () => {
      const user = userEvent.setup();
      ottMutate.mockRejectedValue({
        response: { status: 502, data: { code: 'GIGARED_UNAVAILABLE', detail: 'OTT upstream caído' } },
      });
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /suspender tv/i }));
      await waitFor(() => expect(screen.getByText(/ott upstream caído/i)).toBeInTheDocument());
    });

    it('remove error with detail → shows the detail in the confirm dialog', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: removableAccount } });
      removeMutate.mockReset().mockRejectedValue({
        response: { status: 502, data: { code: 'GIGARED_UNAVAILABLE', detail: 'No se pudo dar de baja' } },
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /quitar/i }));
      const dialogs = screen.getAllByRole('dialog');
      const confirm = dialogs[dialogs.length - 1];
      const { within } = await import('@testing-library/react');
      await user.click(within(confirm).getByRole('button', { name: /^quitar$/i }));
      await waitFor(() => expect(screen.getByText(/no se pudo dar de baja/i)).toBeInTheDocument());
    });

    it('register error with detail (non-422) → shows the detail', async () => {
      const user = userEvent.setup();
      registerMutate.mockRejectedValue({
        response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE', detail: 'Gigared no responde ahora' } },
      });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.type(screen.getByLabelText(/nombre/i), 'Ana');
      await user.type(screen.getByLabelText(/apellido/i), 'García');
      await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
      // #70 rework — sin campo de contraseña: el submit llega al POST directo.
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() => expect(screen.getByText(/gigared no responde ahora/i)).toBeInTheDocument());
    });
  });

  // ── #47g-2: VINCULAR account picker is now a MODAL ──────────────────────────
  // The bad inline select-list becomes a presentable modal: title "Vincular
  // cuenta de Gigared", a search input (autofocus), clickable rows (name
  // prominent; CIC + packs secondary). Click a row → it selects AND closes,
  // leaving the chosen account visible as a summary with a "Cambiar" button. Esc
  // and click-outside close. The modal carries loading / empty / error states.
  // The "Ingresar CIC manualmente" fallback stays available OUTSIDE the modal.
  describe('#47g-2 — link account picker modal', () => {
    /** Open the picker modal from the unlinked link form. */
    async function openPicker(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /elegir cuenta de la lista|buscar cuenta para vincular/i }));
    }

    it('a trigger opens the modal titled "Vincular cuenta de Gigared"', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' })] },
      });
      renderPanel();
      await openPicker(user);
      expect(screen.getByRole('heading', { name: /vincular cuenta de gigared/i })).toBeInTheDocument();
    });

    it('lists only registered+unlinked accounts as clickable rows', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [
            pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' }),
            // already linked (internalId set) → must NOT appear in the picker
            pickAccount({ cic: '0000000999', firstName: 'OTRO', lastName: 'CLIENTE', internalId: 'cust-7' }),
          ],
        },
      });
      renderPanel();
      await openPicker(user);
      // The unlinked one is offered as a clickable row…
      expect(screen.getByRole('button', { name: /PEREZ JUAN/i })).toBeInTheDocument();
      // …the linked one is excluded.
      expect(screen.queryByText(/OTRO CLIENTE/i)).not.toBeInTheDocument();
    });

    it('a row shows the name prominent with CIC + packs secondary', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [pickAccount({ firstName: 'JUAN', lastName: 'PEREZ', cic: '0000000123' })],
        },
      });
      renderPanel();
      await openPicker(user);
      const row = screen.getByRole('button', { name: /PEREZ JUAN/i });
      expect(row.textContent).toMatch(/0000000123/);
      expect(row.textContent).toMatch(/Gigared Play Full/i);
    });

    it('filters the rows client-side by text (name or CIC)', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [
            pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' }),
            pickAccount({ cic: '0000000456', firstName: 'MARIA', lastName: 'GOMEZ' }),
          ],
        },
      });
      renderPanel();
      await openPicker(user);
      await user.type(screen.getByLabelText(/buscar cuenta/i), 'gomez');
      expect(screen.getByRole('button', { name: /GOMEZ MARIA/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /PEREZ JUAN/i })).not.toBeInTheDocument();
    });

    it('clicking a row selects it, CLOSES the modal, and shows it in the form', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' })] },
      });
      renderPanel();
      await openPicker(user);
      await user.click(screen.getByRole('button', { name: /PEREZ JUAN/i }));
      // The modal title is gone (modal closed)…
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: /vincular cuenta de gigared/i })).not.toBeInTheDocument(),
      );
      // …and the chosen account is visible in the form, with a "Cambiar" control.
      expect(screen.getByText(/0000000123/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cambiar/i })).toBeInTheDocument();
    });

    it('choosing a row → Vincular fires linkCic with that CIC', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' })] },
      });
      renderPanel();
      await openPicker(user);
      await user.click(screen.getByRole('button', { name: /PEREZ JUAN/i }));
      await user.click(screen.getByRole('button', { name: /^vincular$/i }));
      await waitFor(() =>
        expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000123', contractId: 'ct-9' }),
      );
    });

    it('Esc closes the modal without selecting', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' })] },
      });
      renderPanel();
      await openPicker(user);
      await user.keyboard('{Escape}');
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: /vincular cuenta de gigared/i })).not.toBeInTheDocument(),
      );
    });

    it('manual fallback (outside the modal) reveals the free-text CIC input and still links', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [pickAccount({ cic: '0000000123' })] },
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      const input = screen.getByLabelText(/^cic$/i);
      await user.type(input, '0000000777');
      await user.click(screen.getByRole('button', { name: /^vincular$/i }));
      await waitFor(() =>
        expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000777', contractId: 'ct-9' }),
      );
    });

    it('empty list → the modal shows "No quedan cuentas disponibles para vincular"', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null }, allAccounts: { registered: [] } });
      renderPanel();
      await openPicker(user);
      expect(
        screen.getByText(/no quedan cuentas disponibles para vincular/i),
      ).toBeInTheDocument();
    });

    it('loading → the modal shows a loading hint', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null }, allAccountsLoading: true });
      renderPanel();
      await openPicker(user);
      expect(screen.getByText(/cargando cuentas/i)).toBeInTheDocument();
    });

    it('error → the modal shows an error with a retry control', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null }, allAccountsError: true });
      renderPanel();
      await openPicker(user);
      expect(screen.getByText(/no se pudieron cargar las cuentas/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });
  });

  // ── #47e B: register prefilled from the Prominense customer ──────────────────
  // The register form prefills firstName/lastName/email from the customer prop.
  // Name split heuristic (local "APELLIDO NOMBRE(S)"): first token → lastName,
  // the rest → firstName. The CIC field is a select over UNREGISTERED accounts.
  describe('#47e B — register prefill from customer', () => {
    it('prefills lastName/firstName from the customer name ("DAMONTE JIMENA")', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel({ name: 'DAMONTE JIMENA', email: 'jimena@example.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      expect(screen.getByLabelText(/apellido/i)).toHaveValue('DAMONTE');
      expect(screen.getByLabelText(/nombre/i)).toHaveValue('JIMENA');
      expect(screen.getByLabelText(/^email$/i)).toHaveValue('jimena@example.com');
    });

    it('multi-token name → first token is lastName, rest is firstName', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel({ name: 'GONZALEZ MARIA LAURA', email: 'ml@example.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      expect(screen.getByLabelText(/apellido/i)).toHaveValue('GONZALEZ');
      expect(screen.getByLabelText(/nombre/i)).toHaveValue('MARIA LAURA');
    });

    it('the prefilled fields stay editable', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel({ name: 'DAMONTE JIMENA', email: 'jimena@example.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      const last = screen.getByLabelText(/apellido/i);
      await user.clear(last);
      await user.type(last, 'OTRO');
      expect(last).toHaveValue('OTRO');
    });

    it('register CIC is a select over UNREGISTERED accounts', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          unregistered: [
            pickAccount({ cic: '0000000900', firstName: 'LIBRE', lastName: 'CIC', services: [] }),
          ],
        },
      });
      // #70 rework — con grClienteId el form prefillea SOLO el email ficticio; la contraseña
      // ya NO se carga (la genera el backend) y NO viaja en el payload.
      renderPanel({ name: 'DAMONTE JIMENA', email: 'jimena@example.com', grClienteId: '243200' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.selectOptions(screen.getByLabelText(/cic disponible/i), '0000000900');
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(registerMutate).toHaveBeenCalledWith({
          firstName: 'JIMENA',
          lastName: 'DAMONTE',
          email: 'damonte243200@gmail.com',
          cic: '0000000900',
          // #65 — sendActivationEmail defaults FALSE (correo ficticio); contractId travels.
          sendActivationEmail: false,
          contractId: 'ct-9',
        }),
      );
      // #70 rework — el payload NUNCA lleva password.
      expect(registerMutate.mock.calls[0][0]).not.toHaveProperty('password');
    });

    it('register CIC manual fallback toggle reveals the free-text input', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { unregistered: [pickAccount({ cic: '0000000900' })] },
      });
      renderPanel({ name: 'DAMONTE JIMENA', email: 'jimena@example.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      expect(screen.getByLabelText(/^cic$/i)).toBeInTheDocument();
    });

    it('no customer prop → fields render empty (no crash)', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      expect(screen.getByLabelText(/apellido/i)).toHaveValue('');
      expect(screen.getByLabelText(/nombre/i)).toHaveValue('');
    });

    // #70 rework — el ALTA ya NO pide contraseña: el campo fue REMOVIDO y en su lugar hay una
    // nota de autogeneración. Sin grClienteId el submit ya NO se bloquea por la password.
    describe('#70 rework — el alta no pide contraseña (autogeneración)', () => {
      it('NO hay campo de contraseña en el form de registro', async () => {
        const user = userEvent.setup();
        mockQuery({ account: { linked: false, account: null } });
        renderPanel({ name: 'DAMONTE JIMENA', email: 'j@x.com', grClienteId: '243200' });
        await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
        expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
        // tampoco el toggle mostrar/ocultar del campo viejo.
        expect(screen.queryByRole('button', { name: /mostrar contraseña/i })).not.toBeInTheDocument();
      });

      it('muestra la nota de que la contraseña se genera automáticamente (+ Credenciales)', async () => {
        const user = userEvent.setup();
        mockQuery({ account: { linked: false, account: null } });
        renderPanel({ name: 'DAMONTE JIMENA', email: 'j@x.com', grClienteId: '243200' });
        await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
        expect(screen.getByText(/se genera automáticamente/i)).toBeInTheDocument();
        expect(screen.getByText(/credenciales/i)).toBeInTheDocument();
      });

      it('cliente SIN grClienteId → el submit NO se bloquea por la contraseña (se habilita con los datos)', async () => {
        const user = userEvent.setup();
        mockQuery({ account: { linked: false, account: null } });
        renderPanel({ name: 'DAMONTE JIMENA', email: 'j@x.com' });
        await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
        await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
        await user.type(screen.getByLabelText(/^cic$/i), '0001');
        // sin campo de contraseña, con nombre/apellido/email/cic completos → submit habilitado.
        expect(screen.getByRole('button', { name: /^registrar$/i })).toBeEnabled();
      });
    });
  });

  // ── #47f: link reconciles the local TV item onto the owner contract ─────────
  // The link now carries the EFFECTIVE contractId (the owner) so the BE
  // reconciles the local 'TV' ContractService. A 207 (local:'failed') surfaces
  // the same amber + retry pattern as the add; the retry re-posts the link
  // (idempotent).
  describe('#47f — link reconciles local TV item', () => {
    it('(a) link carries the OWNER contractId when a contract already owns TV', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount, local: 'synced' });
      // ct-A holds the local TV line → it is the owner; panel opened from ct-9.
      mockQuery({
        account: { linked: false, account: null },
        contracts: [contract('ct-A', [tvService()]), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0000000001');
      await user.click(screen.getByRole('button', { name: /vincular/i }));
      await waitFor(() =>
        expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000001', contractId: 'ct-A' }),
      );
    });

    it('(b) 207 local failed on link → amber notice with retry; retry re-posts the link', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount, local: 'failed', localError: 'db down' });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0000000001');
      await user.click(screen.getByRole('button', { name: /vincular/i }));
      await waitFor(() => expect(screen.getByText(/falló el registro local/i)).toBeInTheDocument());
      const retry = screen.getByRole('button', { name: /reintentar/i });
      expect(retry).toBeInTheDocument();
      // The retry re-posts the same link (idempotent) with the same contractId.
      await user.click(retry);
      await waitFor(() =>
        expect(linkMutate).toHaveBeenLastCalledWith({ cic: '0000000001', contractId: 'ct-9' }),
      );
    });

    it('(b2) link with local:synced → no amber notice', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount, local: 'synced' });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0000000001');
      await user.click(screen.getByRole('button', { name: /vincular/i }));
      await waitFor(() => expect(linkMutate).toHaveBeenCalled());
      expect(screen.queryByText(/falló el registro local/i)).not.toBeInTheDocument();
    });
  });

  // ── #70 rework — el alta NO pide contraseña ──────────────────────────────────
  // Wire contract final: el form de registro NO tiene campo de contraseña (input,
  // validación viva ni toggle). En su lugar, una nota: la contraseña se genera
  // automáticamente (server-side, a partir del idGR) y se ve luego en Credenciales.
  // El payload del register NUNCA lleva `password`. El modal "Cambiar contraseña"
  // del #65 NO se toca — sigue libre y se cubre en su propio describe.
  describe('#70 rework — register sin campo de contraseña', () => {
    /** Open the register form and fill the always-required fields + a manual CIC. */
    async function openRegisterFilled(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.type(screen.getByLabelText(/nombre/i), 'Ana');
      await user.type(screen.getByLabelText(/apellido/i), 'García');
      await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
    }

    it('NO renderiza campo de contraseña (input ni toggle), SÍ la nota de autogeneración', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      // El campo de contraseña fue removido por completo.
      expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /mostrar contraseña/i })).not.toBeInTheDocument();
      // El warning viejo "sin contraseña … no podrá ingresar" desaparece.
      expect(screen.queryByText(/sin contraseña/i)).not.toBeInTheDocument();
      // La nota sutil reemplaza al campo.
      expect(screen.getByText(/se genera automáticamente/i)).toBeInTheDocument();
    });

    it('el register postea SIN password en el payload (la genera el backend)', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await openRegisterFilled(user);
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        // #65 — sendActivationEmail defaults FALSE + contractId travels. #70 — NO password.
        expect(registerMutate).toHaveBeenCalledWith({
          firstName: 'Ana',
          lastName: 'García',
          email: 'a@b.com',
          cic: '0001',
          sendActivationEmail: false,
          contractId: 'ct-9',
        }),
      );
      expect(registerMutate.mock.calls[0][0]).not.toHaveProperty('password');
    });

    it('sin grClienteId el submit NO se bloquea por la contraseña (queda habilitado con los datos)', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await openRegisterFilled(user);
      expect(screen.getByRole('button', { name: /^registrar$/i })).toBeEnabled();
    });
  });

  // ── #65 — sendActivationEmail checkbox (correo ficticio) ────────────────────
  // El correo del alta es FICTICIO, así que el checkbox arranca SIEMPRE INACTIVO y el
  // POST manda sendActivationEmail:false. El operador puede activarlo a mano si usa un
  // correo real. La advertencia "no podrá ingresar" aparece cuando el toggle está off y
  // no hay password — que es el estado por DEFAULT cuando no hay clave determinística.
  describe('sendActivationEmail checkbox (#65 — correo ficticio)', () => {
    /** Open the register form, fill required fields + a manual CIC. */
    async function openRegisterFilled(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.type(screen.getByLabelText(/nombre/i), 'Ana');
      await user.type(screen.getByLabelText(/apellido/i), 'García');
      await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
    }

    it('(a) default → checkbox UNCHECKED, POST carries sendActivationEmail:false', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await openRegisterFilled(user);
      // #65 — checkbox defaults to UNCHECKED (ficticio).
      expect(screen.getByLabelText(/enviar email de activación al cliente/i)).not.toBeChecked();
      // #70 rework — sin campo de contraseña, el submit ya no la necesita para destrabarse.
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(registerMutate).toHaveBeenCalledWith({
          firstName: 'Ana',
          lastName: 'García',
          email: 'a@b.com',
          cic: '0001',
          sendActivationEmail: false,
          contractId: 'ct-9',
        }),
      );
    });

    it('(b) checked → POST carries sendActivationEmail:true (always explicit)', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await openRegisterFilled(user);
      await user.click(screen.getByLabelText(/enviar email de activación al cliente/i));
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(registerMutate).toHaveBeenCalledWith({
          firstName: 'Ana',
          lastName: 'García',
          email: 'a@b.com',
          cic: '0001',
          sendActivationEmail: true,
          contractId: 'ct-9',
        }),
      );
    });

    // #70 rework — el warning viejo "sin email y sin contraseña, no podrá ingresar" se eliminó:
    // ya no existe campo de contraseña, así que esa condición no se evalúa más.
    it('(c) el warning viejo "sin contraseña" ya NO aparece (campo removido)', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await openRegisterFilled(user);
      expect(
        screen.queryByText(/sin email de activación y sin contraseña/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── #47i Fix 1: "Agregar servicio" excludes packs the account already has ────
  // Feedback: "Agregué un servicio y me sigue apareciendo [disponible]". The
  // partner catalog (summary.services) must EXCLUDE any pack already on the
  // account (match by id). When nothing is left, hide the control and show a
  // subtle hint. The qtyAvailable===0 disable still applies to the rest.
  describe('#47i Fix 1 — add-service excludes owned packs', () => {
    it('account owns s1 → the add select offers ONLY the missing pack (s2)', () => {
      // linkedAccount.services = [{ id: 's1', ... }]; summary has s1 + s2.
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      const select = screen.getByLabelText(/agregar servicio/i);
      // The owned pack (s1) is gone from the options…
      expect(
        within(select).queryByRole('option', { name: /gigared play full/i }),
      ).not.toBeInTheDocument();
      // …the available one (s2) remains selectable.
      expect(
        within(select).getByRole('option', { name: /gigared play lite/i }),
      ).toBeInTheDocument();
    });

    it('account owns ALL packs → the control is hidden and a hint shows', () => {
      const allOwned: GigaredAccount = {
        ...linkedAccount,
        services: [
          { id: 's1', name: 'Gigared Play Full' },
          { id: 's2', name: 'Gigared Play Lite' },
        ],
      };
      mockQuery({ account: { linked: true, account: allOwned } });
      renderPanel();
      expect(screen.queryByLabelText(/agregar servicio/i)).not.toBeInTheDocument();
      expect(
        screen.getByText(/ya tiene todos los packs disponibles/i),
      ).toBeInTheDocument();
    });

    it('a remaining pack with no cupo stays disabled (filter preserved)', () => {
      // Account owns nothing → both packs offered; s1 (qtyAvailable 0) disabled.
      const ownsNothing: GigaredAccount = { ...linkedAccount, services: [] };
      mockQuery({ account: { linked: true, account: ownsNothing } });
      renderPanel();
      const select = screen.getByLabelText(/agregar servicio/i);
      const full = within(select).getByRole('option', { name: /gigared play full/i }) as HTMLOptionElement;
      expect(full.disabled).toBe(true);
    });
  });

  // ── #47i Fix 2: human OTT copy ──────────────────────────────────────────────
  // Feedback: "OTT… ¿qué es?". The section gets a human title + subtitle and a
  // legible data line with correct singular/plural.
  describe('#47i Fix 2 — human OTT copy', () => {
    it('renders the human title and subtitle', () => {
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      expect(screen.getByText(/streaming \(ott\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/la app de tv de gigared \(gigared play\)/i),
      ).toBeInTheDocument();
    });

    it('legible data line uses correct singular (1 fija, 1 móvil) — sin dispositivos', () => {
      // linkedAccount.ott = stationary 1, mobile 1, registered 0.
      // #60: el contador de dispositivos no se muestra (viene roto upstream).
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      expect(
        screen.getByText(/puede ver en hasta 1 pantalla fija y 1 móvil/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/dispositivos? registrados?/i)).not.toBeInTheDocument();
    });

    it('legible data line pluralizes correctly (2 fijas, 3 móviles) — sin dispositivos', () => {
      const plural: GigaredAccount = {
        ...linkedAccount,
        ott: { id: 'o1', stationaryLicenses: 2, mobileLicenses: 3, registeredDevices: 1, status: 'enabled' },
      };
      mockQuery({ account: { linked: true, account: plural } });
      renderPanel();
      expect(
        screen.getByText(/puede ver en hasta 2 pantallas fijas y 3 móviles/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/dispositivos? registrados?/i)).not.toBeInTheDocument();
    });

    it('the Suspender TV action still works with its pending', async () => {
      const user = userEvent.setup();
      ottMutate.mockResolvedValue({ ok: true });
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /suspender tv/i }));
      await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: false }));
    });
  });

  // ── #47k ① — Suspender / Reactivar TV (semantic OTT actions) ─────────────────
  // The raw OTT checkbox is replaced by semantic actions. OTT enabled → a
  // "Suspender TV" action behind a SOFT confirm → PUT ott { enabled: false }.
  // OTT disabled → a prominent SUSPENDIDA badge + "Reactivar TV" → PUT ott
  // { enabled: true } (no confirm). status reads the FROZEN normalized value.
  describe('#47k ① — Suspender / Reactivar TV', () => {
    const disabledAccount: GigaredAccount = {
      ...linkedAccount,
      ott: { ...linkedAccount.ott!, status: 'disabled' },
    };

    it("status 'enabled' → shows Suspender TV (no SUSPENDIDA badge)", () => {
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      expect(screen.getByRole('button', { name: /suspender tv/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reactivar tv/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/suspendida/i)).not.toBeInTheDocument();
    });

    it("status 'disabled' → shows the SUSPENDIDA badge + Reactivar TV", () => {
      mockQuery({ account: { linked: true, account: disabledAccount } });
      renderPanel();
      expect(screen.getByText(/suspendida/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reactivar tv/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /suspender tv/i })).not.toBeInTheDocument();
    });

    it("status null → treated as suspended (Reactivar TV available)", () => {
      const unknown: GigaredAccount = {
        ...linkedAccount,
        ott: { ...linkedAccount.ott!, status: null },
      };
      mockQuery({ account: { linked: true, account: unknown } });
      renderPanel();
      expect(screen.getByRole('button', { name: /reactivar tv/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /suspender tv/i })).not.toBeInTheDocument();
    });

    it('Suspender TV → soft confirm, then PUT ott { enabled: false }', async () => {
      const user = userEvent.setup();
      ottMutate.mockResolvedValue({ ok: true });
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /suspender tv/i }));
      // The soft confirm fires (auto-true in beforeEach) before the PUT.
      await waitFor(() => expect(useConfirm).toHaveBeenCalled());
      await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: false }));
    });

    it('Suspender TV → cancelling the soft confirm does NOT PUT', async () => {
      const user = userEvent.setup();
      vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /suspender tv/i }));
      await waitFor(() => expect(useConfirm).toHaveBeenCalled());
      expect(ottMutate).not.toHaveBeenCalled();
    });

    it('Reactivar TV → PUT ott { enabled: true } (no confirm needed)', async () => {
      const user = userEvent.setup();
      ottMutate.mockResolvedValue({ ok: true });
      mockQuery({ account: { linked: true, account: disabledAccount } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /reactivar tv/i }));
      await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: true }));
    });

    it('the pantallas/dispositivos info line stays visible in both states', () => {
      mockQuery({ account: { linked: true, account: disabledAccount } });
      renderPanel();
      expect(
        screen.getByText(/puede ver en hasta 1 pantalla fija y 1 móvil/i),
      ).toBeInTheDocument();
    });
  });

  // ── #47j Fix 2: "Gigared Play Full" is the partner BASE pack ─────────────────
  // It cannot be removed — instead of a "Quitar" action it shows a subtle "Pack
  // base" tag. Match is by exact name 'Gigared Play Full'; if the partner ever
  // renames it the "Quitar" reappears (upstream decides). Other packs keep Quitar.
  describe('#47j Fix 2 — base pack has no Quitar', () => {
    it('"Gigared Play Full" shows a "Pack base" tag instead of "Quitar"', () => {
      // linkedAccount's only service is "Gigared Play Full" (the base pack).
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      const item = screen.getByText('Gigared Play Full').closest('li')!;
      const { getByText, queryByRole } = within(item);
      expect(getByText(/pack base/i)).toBeInTheDocument();
      expect(queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    });

    it('a non-base pack still offers "Quitar"', () => {
      mockQuery({ account: { linked: true, account: removableAccount } });
      renderPanel();
      const item = screen.getByText('Gigared Play Lite').closest('li')!;
      const { getByRole, queryByText } = within(item);
      expect(getByRole('button', { name: /quitar/i })).toBeInTheDocument();
      expect(queryByText(/pack base/i)).not.toBeInTheDocument();
    });

    it('mixed list: base pack tagged, other pack removable', () => {
      const mixed: GigaredAccount = {
        ...linkedAccount,
        services: [
          { id: 's1', name: 'Gigared Play Full' },
          { id: 's2', name: 'Gigared Play Lite' },
        ],
      };
      mockQuery({ account: { linked: true, account: mixed } });
      renderPanel();
      const baseItem = screen.getByText('Gigared Play Full').closest('li')!;
      expect(within(baseItem).getByText(/pack base/i)).toBeInTheDocument();
      expect(within(baseItem).queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
      const liteItem = screen.getByText('Gigared Play Lite').closest('li')!;
      expect(within(liteItem).getByRole('button', { name: /quitar/i })).toBeInTheDocument();
    });
  });

  // ── #47k ② — Dar de baja TV (cancel) ────────────────────────────────────────
  // A danger "Dar de baja TV" action at the foot of the services area opens a
  // STRONG confirm. Confirming POSTs /cancel with the panel's effective
  // contractId. 200 → success banner "cupo liberado" + invalidations (in the
  // hook). 207 → amber banner with counts (removed N, failed M + first detail,
  // OTT yes/no, local yes/no) + a "Reintentar baja" that re-POSTs (idempotent).
  // Gated by tv.cancel.
  describe('#47k ② — Dar de baja TV', () => {
    /** Open the strong confirm from the danger action. */
    async function openCancel(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
    }

    it('renders the danger "Dar de baja TV" action when linked', () => {
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      expect(screen.getByRole('button', { name: /dar de baja tv/i })).toBeInTheDocument();
    });

    it('the action opens a STRONG confirm (frees the cupo, apaga streaming)', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await openCancel(user);
      expect(screen.getByRole('dialog', { name: /dar de baja tv/i })).toBeInTheDocument();
      expect(screen.getByText(/libera el cupo del partner/i)).toBeInTheDocument();
    });

    it('confirming POSTs cancel with the EFFECTIVE (owner) contractId', async () => {
      const user = userEvent.setup();
      // Owner is ct-A; the panel opened from ct-9 → cancel must target ct-A.
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-A', [tvService()]), contract('ct-9', [])],
      });
      renderPanel(); // contractId="ct-9"
      await openCancel(user);
      const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(dialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith({ contractId: 'ct-A' }));
    });

    it('first activation contract (no owner) → cancel uses the opening contractId', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel(); // contractId="ct-9"
      await openCancel(user);
      const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(dialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith({ contractId: 'ct-9' }));
    });

    it('cancelling the strong confirm does NOT POST', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      await openCancel(user);
      const dialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));
      expect(cancelMutate).not.toHaveBeenCalled();
    });

    it('#64 200 OK → success MODAL "se estará deshabilitando en los próximos minutos"', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: ['s1', 's2'], failed: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      renderPanel();
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      // The outcome MODAL (not a banner) announces the async OTT teardown.
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      expect(within(outcome).getByText(/se estará deshabilitando en los próximos minutos/i)).toBeInTheDocument();
    });

    it('#64 200 OK MODAL lists the steps (packs, OTT, renovación de CIC)', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: ['s1', 's2'], failed: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      renderPanel();
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      // step detail: packs quitados, streaming apagado, CIC renovado/desvinculado.
      expect(within(outcome).getByText(/cupo liberado/i)).toBeInTheDocument();
      expect(within(outcome).getByText(/renovado \(0000000001 → 0000000002\)/i)).toBeInTheDocument();
      expect(within(outcome).getByText(/desvinculado del cliente/i)).toBeInTheDocument();
    });

    it('#64 207 partial → MODAL with the failed steps + Reintentar', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 207, data: {
          removed: ['s1'],
          failed: [
            { id: 's2', detail: 'partner timeout' },
            { id: 's3', detail: 'otra' },
          ],
          ottDisabled: false,
          local: 'failed',
          renew: null,
          unlinked: false,
        }},
      });
      renderPanel();
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      expect(within(outcome).getByText(/partner timeout/i)).toBeInTheDocument();
      expect(within(outcome).getByRole('button', { name: /reintentar baja/i })).toBeInTheDocument();
    });

    it('#67 200 + unremovable (pack base) → success MODAL + línea informativa (no error, no Reintentar)', async () => {
      const user = userEvent.setup();
      // El pack BASE no se puede quitar (424). El BE ya NO lo cuenta como failed:
      // viaja en `unremovable` (informativo) y el status es 200 (éxito).
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: ['s2'],
          failed: [],
          unremovable: [
            { id: 's1', detail: 'El servicio seleccionado no se puede dar de baja' },
          ],
          ottDisabled: true,
          local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      renderPanel();
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      // Modal de ÉXITO normal (no parcial): el mensaje de éxito y SIN Reintentar.
      expect(within(outcome).getByText(/se estará deshabilitando en los próximos minutos/i)).toBeInTheDocument();
      expect(within(outcome).queryByRole('button', { name: /reintentar baja/i })).not.toBeInTheDocument();
      // Línea informativa del pack base (tono neutro): menciona el pack base y la renovación del CIC
      // SIN afirmar que YA se renovó (#67 re-review: el copy es condicional, "se libera al renovar").
      expect(within(outcome).getByText(/pack base/i)).toBeInTheDocument();
      expect(within(outcome).getByText(/se libera al renovar el cic/i)).toBeInTheDocument();
    });

    it('#67 200 sin unremovable → NO se muestra la línea informativa del pack base', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: ['s1', 's2'], failed: [], unremovable: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      renderPanel();
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      expect(within(outcome).queryByText(/pack base/i)).not.toBeInTheDocument();
    });

    it('#64 207 → "Reintentar baja" re-POSTs cancel (idempotent) with the same contractId', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 207, data: {
          removed: [],
          failed: [{ id: 's2', detail: 'partner timeout' }],
          ottDisabled: false,
          local: 'failed',
          renew: null,
          unlinked: false,
        }},
      });
      renderPanel(); // contractId="ct-9"
      await openCancel(user);
      const confirm = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirm).getByRole('button', { name: /confirmar|dar de baja/i }));
      const retry = await screen.findByRole('button', { name: /reintentar baja/i });
      await user.click(retry);
      await waitFor(() =>
        expect(cancelMutate).toHaveBeenLastCalledWith({ contractId: 'ct-9' }),
      );
    });

    it('without tv.cancel the Dar de baja action is hidden', () => {
      denyTvWrite();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      expect(screen.queryByRole('button', { name: /dar de baja tv/i })).not.toBeInTheDocument();
    });

    // ── C1: outcome modal survives the linked→unlinked flip ──────────────────
    it('C1: outcome modal stays visible after account flips to unlinked (modal is in the parent)', async () => {
      const user = userEvent.setup();
      // Initial state: linked
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: ['s1'], failed: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      const { rerender } = renderPanel();

      // Open cancel, confirm → outcome modal appears
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      expect(within(outcome).getByText(/se estará deshabilitando en los próximos minutos/i)).toBeInTheDocument();

      // Now simulate the refetch: account flips to unlinked — LinkedView unmounts
      vi.mocked(useGigaredCustomerAccount).mockReturnValue({
        data: { linked: false, account: null },
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useGigaredCustomerAccount>);
      rerender(
        <MemoryRouter>
          <GigaredPanel customerId="cust-1" contractId="ct-9" onClose={onClose} />
        </MemoryRouter>,
      );

      // LinkedView is gone ("Suspender TV" button no longer present)
      expect(screen.queryByRole('button', { name: /suspender tv/i })).not.toBeInTheDocument();
      // But the outcome modal SURVIVED
      expect(screen.getByRole('dialog', { name: /baja de tv/i })).toBeInTheDocument();
      expect(screen.getByText(/se estará deshabilitando en los próximos minutos/i)).toBeInTheDocument();
    });

    // ── M2: status-driven partial detection ──────────────────────────────────
    it('M2: 207 status → partial modal (Reintentar) even when fields look fully ok', async () => {
      const user = userEvent.setup();
      // Fields look "clean" (no failed packs, OTT disabled, local synced, renew ok, unlinked true)
      // BUT the HTTP status is 207 → must show Reintentar
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 207, data: {
          removed: ['s1'], failed: [], ottDisabled: true, local: 'synced',
          renew: { oldCic: '0000000001', newCic: '0000000002' }, unlinked: true,
        }},
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      // 207 → partial → Reintentar present
      expect(within(outcome).getByRole('button', { name: /reintentar baja/i })).toBeInTheDocument();
    });

    it('M2: 200 status → success (no Reintentar) even when failed fields would be "partial"', async () => {
      const user = userEvent.setup();
      // Fields look partial (failed packs, ott still on) BUT status 200 → treat as done
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 200, data: {
          removed: [],
          failed: [{ id: 's2', detail: 'test' }],
          ottDisabled: false,
          local: 'failed',
          renew: null,
          unlinked: false,
        }},
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      const outcome = await screen.findByRole('dialog', { name: /baja de tv/i });
      // 200 → success → no Reintentar
      expect(within(outcome).queryByRole('button', { name: /reintentar baja/i })).not.toBeInTheDocument();
    });

    // ── M1: retry after unlink gives 404 TV_NOT_LINKED → treat as DONE ────────
    it('M1: retry 404 TV_NOT_LINKED → success modal, no red error', async () => {
      const user = userEvent.setup();
      // Initial cancel is 207 partial (unlinked: false → already unlinked but renew failed)
      mockQuery({
        account: { linked: true, account: linkedAccount },
        cancelResult: { status: 207, data: {
          removed: ['s1'], failed: [], ottDisabled: true, local: 'synced',
          renew: null, unlinked: false,
        }},
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      const retry = await screen.findByRole('button', { name: /reintentar baja/i });

      // Retry rejects with 404 TV_NOT_LINKED
      cancelMutate.mockRejectedValueOnce({
        response: { status: 404, data: { code: 'TV_NOT_LINKED' } },
      });
      await user.click(retry);

      // No red error visible
      await waitFor(() =>
        expect(screen.queryByText(/no se pudo dar de baja/i)).not.toBeInTheDocument(),
      );
      // Success/done copy appears — "la baja ya se completó" or outcome modal without Reintentar
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: /reintentar baja/i }),
        ).not.toBeInTheDocument(),
      );
      // The outcome modal is still open (success state)
      expect(screen.getByRole('dialog', { name: /baja de tv/i })).toBeInTheDocument();
      // Contains "completó" or success copy
      expect(
        screen.getByText(/la baja ya se completó en gigared/i),
      ).toBeInTheDocument();
    });

    // ── M1 (#64 re-review): el 404 amable SOLO aplica al retry ────────────────
    it('M1 re-review: PRIMER intento 404 TV_NOT_LINKED → error normal, NO "baja ya completada"', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: true, account: linkedAccount } });
      renderPanel();
      // El primer POST (sin intento previo) rechaza con 404 TV_NOT_LINKED.
      cancelMutate.mockReset().mockRejectedValueOnce({
        response: { status: 404, data: { code: 'TV_NOT_LINKED' } },
      });
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));

      // Sin intento previo (cancelOutcome === null) → NO se trata como "ya completada".
      await waitFor(() =>
        expect(screen.getByText(/no se pudo dar de baja/i)).toBeInTheDocument(),
      );
      // El mensaje engañoso NO aparece y NO se abre el modal de resultado.
      expect(screen.queryByText(/la baja ya se completó en gigared/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /baja de tv/i })).not.toBeInTheDocument();
    });

    // ── L3: snapshot contractId at confirm time ───────────────────────────────
    it('L3: Reintentar uses the SNAPSHOT contractId, not the recomputed effectiveContractId', async () => {
      const user = userEvent.setup();
      // Initial: owner is ct-A (linked, has TV item). cancelResult is 207 so Reintentar shows.
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-A', [tvService()]), contract('ct-9', [])],
        cancelResult: { status: 207, data: {
          removed: [],
          failed: [{ id: 's2', detail: 'partner timeout' }],
          ottDisabled: false, local: 'failed', renew: null, unlinked: false,
        }},
      });
      const { rerender } = renderPanel(); // contractId="ct-9"

      // Confirm cancel → snapshot ct-A
      await user.click(screen.getByRole('button', { name: /dar de baja tv/i }));
      const confirmDialog = screen.getByRole('dialog', { name: /dar de baja tv/i });
      await user.click(within(confirmDialog).getByRole('button', { name: /confirmar|dar de baja/i }));
      await waitFor(() => expect(cancelMutate).toHaveBeenCalledWith({ contractId: 'ct-A' }));

      // After the flip: account unlinked + contracts change so effectiveContractId would shift
      vi.mocked(useGigaredCustomerAccount).mockReturnValue({
        data: { linked: false, account: null },
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useGigaredCustomerAccount>);
      vi.mocked(useClientContracts).mockReturnValue({
        data: [contract('ct-X', [tvService()]), contract('ct-9', [])],
        isLoading: false,
      } as unknown as ReturnType<typeof useClientContracts>);
      rerender(
        <MemoryRouter>
          <GigaredPanel customerId="cust-1" contractId="ct-9" onClose={onClose} />
        </MemoryRouter>,
      );

      // Reintentar must still POST ct-A (the snapshot), not ct-X
      const retry = screen.getByRole('button', { name: /reintentar baja/i });
      await user.click(retry);
      await waitFor(() =>
        expect(cancelMutate).toHaveBeenLastCalledWith({ contractId: 'ct-A' }),
      );
    });
  });

  // ── #65 — deterministic register prefill + Gigared Play credentials ─────────
  describe('#65 deterministic register prefill', () => {
    it('prefills the ficticio email from grClienteId (la contraseña ya NO se prefillea — autogenerada)', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel({ name: 'HERNANDEZ RONALD', email: 'real@x.com', grClienteId: '2432' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      // email = {apellido}{idGR}@gmail.com (NOT the real email).
      expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe('hernandez2432@gmail.com');
      // #70 rework — ya NO hay campo de contraseña que prefillear.
      expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    });

    it('falls back to the real email without grClienteId (y sigue sin campo de contraseña)', async () => {
      const user = userEvent.setup();
      mockQuery({ account: { linked: false, account: null } });
      renderPanel({ name: 'HERNANDEZ RONALD', email: 'real@x.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      expect((screen.getByLabelText(/^email$/i) as HTMLInputElement).value).toBe('real@x.com');
      expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    });
  });

  describe('#65 Gigared Play credentials section (linked)', () => {
    it('H3 — shows login + reveals the password fetched from the dedicated endpoint (lazy)', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: { ...linkedAccount, gigaredId: '2432' } },
        contracts: [contract('ct-9', [tvService()])],
        tvCredentials: { login: 'GIGA2432', password: 'ip243200' },
      });
      renderPanel();
      // Login from the credentials endpoint (falls back to the account-derived value).
      expect(screen.getByText('GIGA2432')).toBeInTheDocument();
      // Password hidden by default (dots), revealed on toggle.
      expect(screen.queryByText('ip243200')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
      expect(screen.getByText('ip243200')).toBeInTheDocument();
    });

    it('H1 — opens the change-password modal prefilled and posts WITHOUT cic (contractId + password only)', async () => {
      const user = userEvent.setup();
      pwMutate.mockResolvedValue({ password: 'ip243200', persisted: true });
      mockQuery({
        account: { linked: true, account: { ...linkedAccount, cic: '0000001234', gigaredId: '2432' } },
        contracts: [contract('ct-9', [tvService()])],
      });
      renderPanel({ name: 'HERNANDEZ RONALD', email: 'x@x.com', grClienteId: '2432' });
      await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
      // Prefilled with the deterministic value from grClienteId.
      const input = screen.getByLabelText(/nueva contraseña/i) as HTMLInputElement;
      expect(input.value).toBe('ip243200');
      // Submit (the modal's confirm button).
      const buttons = screen.getAllByRole('button', { name: /cambiar contraseña/i });
      await user.click(buttons[buttons.length - 1]);
      await waitFor(() =>
        expect(pwMutate).toHaveBeenCalledWith({
          contractId: 'ct-9',
          password: 'ip243200',
        }),
      );
      // H1 — the cic is NEVER part of the payload (resolved server-side).
      expect(pwMutate.mock.calls[0][0]).not.toHaveProperty('cic');
    });

    it('M5 — persisted:false keeps the modal open with a warning (the partner password DID change)', async () => {
      const user = userEvent.setup();
      pwMutate.mockResolvedValue({ password: 'ip243200', persisted: false });
      mockQuery({
        account: { linked: true, account: { ...linkedAccount, cic: '0000001234', gigaredId: '2432' } },
        contracts: [contract('ct-9', [tvService()])],
      });
      renderPanel({ name: 'HERNANDEZ RONALD', email: 'x@x.com', grClienteId: '2432' });
      await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
      const buttons = screen.getAllByRole('button', { name: /cambiar contraseña/i });
      await user.click(buttons[buttons.length - 1]);
      await waitFor(() =>
        expect(screen.getByText(/no quedó guardada en el sistema/i)).toBeInTheDocument(),
      );
      // Modal stays open so the operator can read/note the password.
      expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    });

    it('blocks a non-CUA password in the modal', async () => {
      const user = userEvent.setup();
      mockQuery({
        account: { linked: true, account: { ...linkedAccount, gigaredId: '2432' } },
        contracts: [contract('ct-9', [tvService()])],
      });
      renderPanel({ name: 'H R', email: 'x@x.com', grClienteId: '2432' });
      await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }));
      const input = screen.getByLabelText(/nueva contraseña/i);
      await user.clear(input);
      await user.type(input, 'BAD-PASS');
      expect(screen.getByText(/solo minúsculas y números, 8 a 64/i)).toBeInTheDocument();
      expect(pwMutate).not.toHaveBeenCalled();
    });
  });
});
