import { render, screen, waitFor } from '@testing-library/react';
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
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useRemoveContractService, useAddContractService } from '@/hooks/useContractServices';
import { useServiceCatalog } from '@/hooks/useServiceCatalog';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { GigaredPanel } from '@/pages/customers/tabs/contracts/GigaredPanel';
import type { Contract, ContractService } from '@/types/customer';

/** Override the globally-permissive useMyPermissions mock to DENY tv.write. */
function denyTvWrite() {
  vi.mocked(useMyPermissions).mockReturnValue({
    permissions: [],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every((x) => x !== 'tv.write');
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
  ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 1, registeredDevices: 0, status: 'active' },
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
  contracts?: Contract[];
  /** Picker accounts keyed by the status the hook is called with. */
  allAccounts?: Partial<Record<'registered' | 'unregistered', GigaredAccount[]>>;
  allAccountsLoading?: boolean;
  allAccountsError?: boolean;
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

function renderPanel(customer?: { name: string; email: string }) {
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

  it('state 2: submitting the link form calls linkCic with the CIC', async () => {
    const user = userEvent.setup();
    linkMutate.mockResolvedValue({ account: linkedAccount });
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
    await user.type(screen.getByLabelText(/^cic$/i), '0000000001');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    await waitFor(() => expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000001' }));
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
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
    await user.type(screen.getByLabelText(/^cic$/i), '0001');
    await user.click(screen.getByRole('button', { name: /^registrar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/el email ya está en uso en gigared/i)).toBeInTheDocument(),
    );
  });

  // ── State 3: linked ───────────────────────────────────────────────────────
  it('state 3: linked → shows account, services and OTT toggle', () => {
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('Gigared Play Full')).toBeInTheDocument();
    expect(screen.getByLabelText(/ott/i)).toBeInTheDocument();
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
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    const dialogs = screen.getAllByRole('dialog');
    const confirm = dialogs[dialogs.length - 1];
    const { within } = await import('@testing-library/react');
    await user.click(within(confirm).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's1', contractId: 'ct-9' }),
    );
  });

  it('state 3: OTT toggle calls setOtt', async () => {
    const user = userEvent.setup();
    ottMutate.mockResolvedValue({ ok: true });
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    await user.click(screen.getByLabelText(/ott/i));
    await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: false }));
  });

  // ── tv.write gating ───────────────────────────────────────────────────────
  it('without tv.write the Vincular control is hidden (read-only)', () => {
    denyTvWrite();
    mockQuery({ account: { linked: false, account: null } });
    renderPanel();
    expect(screen.queryByRole('button', { name: /vincular/i })).not.toBeInTheDocument();
  });

  it('without tv.write the add/remove/OTT controls are hidden (read-only)', () => {
    denyTvWrite();
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderPanel();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ott/i)).not.toBeInTheDocument();
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
        account: { linked: true, account: linkedAccount },
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
        expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's1', contractId: 'ct-A' }),
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
        account: { linked: true, account: linkedAccount },
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
      await user.click(screen.getByLabelText(/ott/i));
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

    it('register success → "se envió el email de activación"', async () => {
      const user = userEvent.setup();
      registerMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({ account: { linked: false, account: null } });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.type(screen.getByLabelText(/nombre/i), 'Ana');
      await user.type(screen.getByLabelText(/apellido/i), 'García');
      await user.type(screen.getByLabelText(/email/i), 'a@b.com');
      await user.click(screen.getByRole('button', { name: /ingresar otro cic manualmente/i }));
      await user.type(screen.getByLabelText(/^cic$/i), '0001');
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(screen.getByText(/se envió el email de activación/i)).toBeInTheDocument(),
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
  // clients.write (the chips' permission), NOT tv.write.
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

    it('linked + local item present → remove action visible with a "no toca Gigared" warning', () => {
      mockQuery({
        account: { linked: true, account: linkedAccount },
        contracts: [contract('ct-9', [tvService({ id: 'cs-tv' })])],
      });
      renderPanel();
      expect(
        screen.getByRole('button', { name: /quitar el ítem tv de este contrato/i }),
      ).toBeInTheDocument();
      // It must be clear this only removes the local item, not the Gigared pack.
      expect(screen.getByText(/no toca gigared/i)).toBeInTheDocument();
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

  // ── #47e A: CIC picker for VINCULAR ─────────────────────────────────────────
  // The "Vincular cuenta existente" form offers a SEARCHABLE list of registered
  // accounts that are not yet linked (internalId null/empty). Picking one fills
  // the CIC and the existing Vincular flow runs with that value. A manual escape
  // hatch toggles back to the free-text CIC input.
  describe('#47e A — link CIC picker', () => {
    it('lists only registered+unlinked accounts as options', () => {
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
      const picker = screen.getByLabelText(/elegí una cuenta/i);
      expect(picker).toBeInTheDocument();
      // The unlinked one is offered…
      expect(screen.getByText(/PEREZ JUAN/i)).toBeInTheDocument();
      // …the linked one is excluded.
      expect(screen.queryByText(/OTRO CLIENTE/i)).not.toBeInTheDocument();
    });

    it('option label shows "APELLIDO NOMBRE — CIC … (packs)"', () => {
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [pickAccount({ firstName: 'JUAN', lastName: 'PEREZ', cic: '0000000123' })],
        },
      });
      renderPanel();
      const opt = screen.getByText(/PEREZ JUAN/i);
      expect(opt.textContent).toMatch(/0000000123/);
      expect(opt.textContent).toMatch(/Gigared Play Full/i);
    });

    it('filters the list client-side by text (name or CIC)', async () => {
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
      await user.type(screen.getByLabelText(/buscar cuenta/i), 'gomez');
      expect(screen.getByText(/GOMEZ MARIA/i)).toBeInTheDocument();
      expect(screen.queryByText(/PEREZ JUAN/i)).not.toBeInTheDocument();
    });

    it('choosing an account → Vincular fires linkCic with that CIC', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [pickAccount({ cic: '0000000123', firstName: 'JUAN', lastName: 'PEREZ' })],
        },
      });
      renderPanel();
      await user.selectOptions(screen.getByLabelText(/elegí una cuenta/i), '0000000123');
      await user.click(screen.getByRole('button', { name: /^vincular$/i }));
      await waitFor(() => expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000123' }));
    });

    it('manual fallback toggle reveals the free-text CIC input and still links', async () => {
      const user = userEvent.setup();
      linkMutate.mockResolvedValue({ account: linkedAccount });
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: {
          registered: [pickAccount({ cic: '0000000123' })],
        },
      });
      renderPanel();
      await user.click(screen.getByRole('button', { name: /ingresar cic manualmente/i }));
      const input = screen.getByLabelText(/^cic$/i);
      await user.type(input, '0000000777');
      await user.click(screen.getByRole('button', { name: /^vincular$/i }));
      await waitFor(() => expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000777' }));
    });

    it('empty picker → shows a "no quedan cuentas" message', () => {
      mockQuery({
        account: { linked: false, account: null },
        allAccounts: { registered: [] },
      });
      renderPanel();
      expect(screen.getByText(/no quedan cuentas disponibles/i)).toBeInTheDocument();
    });

    it('picker loading → shows a loading hint', () => {
      mockQuery({ account: { linked: false, account: null }, allAccountsLoading: true });
      renderPanel();
      expect(screen.getByText(/cargando cuentas/i)).toBeInTheDocument();
    });

    it('picker error → shows an error with a retry control', () => {
      mockQuery({ account: { linked: false, account: null }, allAccountsError: true });
      renderPanel();
      expect(screen.getByText(/no se pudieron cargar las cuentas/i)).toBeInTheDocument();
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
      expect(screen.getByLabelText(/email/i)).toHaveValue('jimena@example.com');
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
      renderPanel({ name: 'DAMONTE JIMENA', email: 'jimena@example.com' });
      await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
      await user.selectOptions(screen.getByLabelText(/cic disponible/i), '0000000900');
      await user.click(screen.getByRole('button', { name: /^registrar$/i }));
      await waitFor(() =>
        expect(registerMutate).toHaveBeenCalledWith({
          firstName: 'JIMENA',
          lastName: 'DAMONTE',
          email: 'jimena@example.com',
          cic: '0000000900',
        }),
      );
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
  });
});
