import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount, CustomerAccountResult, GigaredSummary } from '@/types/gigared';
import type { Contract } from '@/types/customer';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredCustomerAccount: vi.fn(),
  useGigaredSummary: vi.fn(),
  useLinkCic: vi.fn(),
  useRegisterAccount: vi.fn(),
  useAddTvService: vi.fn(),
  useRemoveTvService: vi.fn(),
  useSetOtt: vi.fn(),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(),
}));

import {
  useGigaredCustomerAccount,
  useGigaredSummary,
  useLinkCic,
  useRegisterAccount,
  useAddTvService,
  useRemoveTvService,
  useSetOtt,
} from '@/hooks/useGigared';
import { useClientContracts } from '@/hooks/useCustomers';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { TvTab } from '@/pages/customers/tabs/TvTab';

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

/** A contract carrying a TV service line — the DELETE must target THIS one. */
function tvContract(id: string, over: Partial<Contract> = {}): Contract {
  return {
    id,
    name: `Contrato ${id}`,
    type: 'internet',
    plan: 'Plan X',
    status: 'active',
    price: 0,
    startDate: '2026-01-01',
    endDate: null,
    description: '',
    services: [
      { id: `${id}-tv`, serviceCatalogId: 'cat-tv', name: 'TV', label: null, status: 'active', notes: null, createdAt: '2026-01-01' },
    ],
    ...over,
  };
}

function plainContract(id: string): Contract {
  return {
    id,
    name: `Contrato ${id}`,
    type: 'internet',
    plan: 'Plan X',
    status: 'active',
    price: 0,
    startDate: '2026-01-01',
    endDate: null,
    description: '',
    services: [
      { id: `${id}-net`, serviceCatalogId: 'cat-net', name: 'Internet', label: null, status: 'active', notes: null, createdAt: '2026-01-01' },
    ],
  };
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

function mockQuery(over: {
  account?: CustomerAccountResult;
  accountError?: unknown;
  addResult?: unknown;
  removeResult?: unknown;
  contracts?: Contract[];
} = {}) {
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

  vi.mocked(useClientContracts).mockReturnValue({
    data: over.contracts ?? [tvContract('ct-1'), plainContract('ct-2')],
    isLoading: false,
  } as unknown as ReturnType<typeof useClientContracts>);

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
}

function renderTab() {
  return render(
    <MemoryRouter>
      <TvTab customerId="cust-1" />
    </MemoryRouter>,
  );
}

describe('TvTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the permissive permissions default (clearAllMocks wipes the
    // global setup implementation). Tests that need denial call denyTvWrite().
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: ['*'],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: () => true,
    } as unknown as ReturnType<typeof useMyPermissions>);
  });

  it('state 1: NOT_CONFIGURED → renders the banner', () => {
    mockQuery({ accountError: { response: { status: 503, data: { code: 'GIGARED_NOT_CONFIGURED' } } } });
    renderTab();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  it('state 2: not linked → shows link form and collapsible register form', () => {
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    expect(screen.getByLabelText(/cic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vincular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar cuenta nueva/i })).toBeInTheDocument();
  });

  it('state 2: submitting the link form calls linkCic with the CIC', async () => {
    const user = userEvent.setup();
    linkMutate.mockResolvedValue({ account: linkedAccount });
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    await user.type(screen.getByLabelText(/cic/i), '0000000001');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    await waitFor(() => expect(linkMutate).toHaveBeenCalledWith({ cic: '0000000001' }));
  });

  it('state 3: linked → shows account, services, OTT toggle and add-service form', () => {
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderTab();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('Gigared Play Full')).toBeInTheDocument();
    expect(screen.getByLabelText(/ott/i)).toBeInTheDocument();
    // contract selector present
    expect(screen.getByLabelText(/contrato/i)).toBeInTheDocument();
  });

  it('state 3: add service requires choosing service + contract and calls addService', async () => {
    const user = userEvent.setup();
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderTab();
    await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
    await user.selectOptions(screen.getByLabelText(/contrato/i), 'ct-1');
    await user.click(screen.getByRole('button', { name: /agregar$/i }));
    await waitFor(() =>
      expect(addMutate).toHaveBeenCalledWith({ serviceId: 's2', contractId: 'ct-1' }),
    );
  });

  it('state 3: 207 TV_LOCAL_SYNC_FAILED → amber notice with retry', async () => {
    const user = userEvent.setup();
    mockQuery({
      account: { linked: true, account: linkedAccount },
      addResult: { gigared: 'ok', local: 'failed', localError: 'db down' },
    });
    renderTab();
    await user.selectOptions(screen.getByLabelText(/agregar servicio/i), 's2');
    await user.selectOptions(screen.getByLabelText(/contrato/i), 'ct-1');
    await user.click(screen.getByRole('button', { name: /agregar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/falló el registro local/i)).toBeInTheDocument(),
    );
  });

  it('state 3: OTT toggle calls setOtt', async () => {
    const user = userEvent.setup();
    ottMutate.mockResolvedValue({ ok: true });
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderTab();
    await user.click(screen.getByLabelText(/ott/i));
    await waitFor(() => expect(ottMutate).toHaveBeenCalledWith({ enabled: false }));
  });

  // ── C2: real partner error codes (link + register) ────────────────────────

  it('C2 link: CIC inexistente (404 CIC_NOT_FOUND) → "El CIC no existe en Gigared"', async () => {
    const user = userEvent.setup();
    linkMutate.mockRejectedValue({ response: { status: 404, data: { code: 'CIC_NOT_FOUND' } } });
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    await user.type(screen.getByLabelText(/cic/i), '999');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    await waitFor(() => expect(screen.getByText(/el cic no existe en gigared/i)).toBeInTheDocument());
  });

  it('C2 link: ya vinculado (409 CIC_ALREADY_LINKED) → "ya está vinculado a otro cliente"', async () => {
    const user = userEvent.setup();
    linkMutate.mockRejectedValue({ response: { status: 409, data: { code: 'CIC_ALREADY_LINKED' } } });
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    await user.type(screen.getByLabelText(/cic/i), '123');
    await user.click(screen.getByRole('button', { name: /vincular/i }));
    await waitFor(() =>
      expect(screen.getByText(/ese cic ya está vinculado a otro cliente/i)).toBeInTheDocument(),
    );
  });

  it('C2 register: 422 GIGARED_REJECTED shows the partner `detail` from the body', async () => {
    const user = userEvent.setup();
    registerMutate.mockRejectedValue({
      response: {
        status: 422,
        data: { code: 'GIGARED_REJECTED', title: 'Rechazado', detail: 'El email ya está en uso en Gigared' },
      },
    });
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/apellido/i), 'García');
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    const cics = screen.getAllByLabelText(/cic/i);
    await user.type(cics[cics.length - 1], '0001');
    await user.click(screen.getByRole('button', { name: /^registrar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/el email ya está en uso en gigared/i)).toBeInTheDocument(),
    );
  });

  // ── M3: register success feedback ─────────────────────────────────────────

  it('M3 register success → shows "se envió el email de activación"', async () => {
    const user = userEvent.setup();
    registerMutate.mockResolvedValue({ account: linkedAccount });
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    await user.click(screen.getByRole('button', { name: /registrar cuenta nueva/i }));
    await user.type(screen.getByLabelText(/nombre/i), 'Ana');
    await user.type(screen.getByLabelText(/apellido/i), 'García');
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    const cics = screen.getAllByLabelText(/cic/i);
    await user.type(cics[cics.length - 1], '0001');
    await user.click(screen.getByRole('button', { name: /^registrar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/se envió el email de activación/i)).toBeInTheDocument(),
    );
  });

  // ── C3 + H1: remove targets the contract that HAS the TV service ───────────

  it('C3 remove: DELETE uses the contractId of the contract whose services include TV', async () => {
    const user = userEvent.setup();
    mockQuery({
      account: { linked: true, account: linkedAccount },
      contracts: [plainContract('ct-1'), tvContract('ct-2')],
    });
    renderTab();
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      // s1 is the gigared service id; ct-2 is the contract carrying TV — NOT contracts[0]
      expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's1', contractId: 'ct-2' }),
    );
  });

  it('C3 remove: with multiple TV contracts, a selector defaults to the first match', async () => {
    const user = userEvent.setup();
    mockQuery({
      account: { linked: true, account: linkedAccount },
      contracts: [plainContract('ct-0'), tvContract('ct-1'), tvContract('ct-2')],
    });
    renderTab();
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    const dialog = await screen.findByRole('dialog');
    // selector visible (more than one TV contract)
    const selector = within(dialog).getByLabelText(/contrato/i);
    expect(selector).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      // default = first matching TV contract (ct-1)
      expect(removeMutate).toHaveBeenCalledWith({ serviceId: 's1', contractId: 'ct-1' }),
    );
  });

  it('C3 remove: 207 local failed → amber notice with retry', async () => {
    const user = userEvent.setup();
    mockQuery({
      account: { linked: true, account: linkedAccount },
      contracts: [tvContract('ct-1')],
      removeResult: { gigared: 'ok', local: 'failed', localError: 'db down' },
    });
    renderTab();
    await user.click(screen.getByRole('button', { name: /quitar/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^quitar$/i }));
    await waitFor(() =>
      expect(screen.getByText(/falló el registro local/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  // ── M2: OTT error + pending ───────────────────────────────────────────────

  it('M2 OTT: a failed toggle surfaces a visible error message', async () => {
    const user = userEvent.setup();
    ottMutate.mockRejectedValue({ response: { status: 500, data: {} } });
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderTab();
    await user.click(screen.getByLabelText(/ott/i));
    await waitFor(() =>
      expect(screen.getByText(/no se pudo cambiar (el )?ott/i)).toBeInTheDocument(),
    );
  });

  it('M2 OTT: pending shows an "Aplicando…" label/state while the mutation runs', () => {
    vi.mocked(useSetOtt).mockReturnValue({
      mutateAsync: ottMutate,
      isPending: true,
    } as unknown as ReturnType<typeof useSetOtt>);
    mockQuery({ account: { linked: true, account: linkedAccount } });
    // re-apply the pending override (mockQuery reset useSetOtt)
    vi.mocked(useSetOtt).mockReturnValue({
      mutateAsync: ottMutate,
      isPending: true,
    } as unknown as ReturnType<typeof useSetOtt>);
    renderTab();
    expect(screen.getByText(/aplicando…/i)).toBeInTheDocument();
  });

  // ── L1: tv.write gating ───────────────────────────────────────────────────

  it('L1: without tv.write the Vincular control is hidden (read-only)', () => {
    denyTvWrite();
    mockQuery({ account: { linked: false, account: null } });
    renderTab();
    expect(screen.queryByRole('button', { name: /vincular/i })).not.toBeInTheDocument();
  });

  it('L1: without tv.write the add/remove/OTT controls are hidden (read-only)', () => {
    denyTvWrite();
    mockQuery({ account: { linked: true, account: linkedAccount } });
    renderTab();
    expect(screen.queryByRole('button', { name: /^agregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ott/i)).not.toBeInTheDocument();
  });
});
