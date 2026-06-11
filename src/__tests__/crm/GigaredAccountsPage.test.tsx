import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { GigaredAccount, GigaredSummary, ListAccountsResult } from '@/types/gigared';

vi.mock('@/hooks/useGigared', () => ({
  useGigaredSummary: vi.fn(),
  useGigaredAccounts: vi.fn(),
}));

import { useGigaredSummary, useGigaredAccounts } from '@/hooks/useGigared';
import GigaredAccountsPage from '@/pages/crm/GigaredAccountsPage';

const accounts: GigaredAccount[] = [
  {
    cic: '0000000001', gigaredId: 'g1', email: 'a@b.com', firstName: 'Ana', lastName: 'García',
    registrationDate: '2026-01-01T00:00:00Z', services: [{ id: 's1', name: 'Play Full' }],
    internalId: 'c1', ott: { id: 'o1', stationaryLicenses: 1, mobileLicenses: 0, registeredDevices: 1, status: 'active' },
  },
  {
    cic: '0000000002', gigaredId: 'g2', email: 'b@b.com', firstName: 'Beto', lastName: 'López',
    registrationDate: null, services: [], internalId: null, ott: null,
  },
];

const summary: GigaredSummary = {
  accounts: { registered: 5, unregistered: 2, total: 7 },
  services: [{ id: 's1', name: 'Play Full', qtyAvailable: 3, qtyUsed: 2, qtyPurchased: 5 }],
};

function mockHooks(over: {
  accountsData?: ListAccountsResult;
  accountsError?: unknown;
  accountsLoading?: boolean;
  summaryData?: GigaredSummary;
} = {}) {
  vi.mocked(useGigaredSummary).mockReturnValue({
    data: over.summaryData ?? summary,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useGigaredSummary>);

  vi.mocked(useGigaredAccounts).mockReturnValue({
    data: over.accountsData ?? { accounts },
    isLoading: over.accountsLoading ?? false,
    isError: !!over.accountsError,
    error: over.accountsError,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGigaredAccounts>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <GigaredAccountsPage />
    </MemoryRouter>,
  );
}

describe('GigaredAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the summary counts', () => {
    mockHooks();
    renderPage();
    expect(screen.getByText('7')).toBeInTheDocument();
    // "Play Full" shows in both the summary service table and the row chips.
    expect(screen.getAllByText(/Play Full/).length).toBeGreaterThan(0);
  });

  it('renders account rows', () => {
    mockHooks();
    renderPage();
    expect(screen.getByText('0000000001')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByText('0000000002')).toBeInTheDocument();
  });

  it('passes the email filter to the accounts hook (debounced)', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByPlaceholderText(/email/i), 'a@b.com');
    await waitFor(
      () =>
        expect(useGigaredAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'a@b.com' }),
        ),
      { timeout: 1000 },
    );
  });

  it('H2: passes the CIC filter to the accounts hook as accountId (debounced)', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.type(screen.getByLabelText(/cic o id interno/i), 'CIC123');
    await waitFor(
      () =>
        expect(useGigaredAccounts).toHaveBeenCalledWith(
          expect.objectContaining({ accountId: 'CIC123' }),
        ),
      { timeout: 1000 },
    );
  });

  it('passes the status filter to the accounts hook', async () => {
    const user = userEvent.setup();
    mockHooks();
    renderPage();
    await user.selectOptions(screen.getByLabelText(/estado/i), 'registered');
    await waitFor(() =>
      expect(useGigaredAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'registered' }),
      ),
    );
  });

  it('shows the not-configured banner on 503 GIGARED_NOT_CONFIGURED', () => {
    mockHooks({ accountsError: { response: { status: 503, data: { code: 'GIGARED_NOT_CONFIGURED' } } } });
    renderPage();
    expect(screen.getByText(/no está configurada/i)).toBeInTheDocument();
  });

  it('shows a retry notice on 503 GIGARED_UNAVAILABLE', () => {
    mockHooks({ accountsError: { response: { status: 503, data: { code: 'GIGARED_UNAVAILABLE' } } } });
    renderPage();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  // #47g-3 — the BE now sends `detail` on the upstream errors too. The page must
  // surface it on the unavailable banner instead of the bare generic message.
  it('shows the partner detail on 502 GIGARED_UNAVAILABLE when present', () => {
    mockHooks({
      accountsError: {
        response: { status: 502, data: { code: 'GIGARED_UNAVAILABLE', detail: 'Gigared devolvió 502' } },
      },
    });
    renderPage();
    expect(screen.getByText(/gigared devolvió 502/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no accounts', () => {
    mockHooks({ accountsData: { accounts: [] } });
    renderPage();
    expect(screen.getByText(/sin cuentas/i)).toBeInTheDocument();
  });

  // Fix #47c-1 — the partner API caps pagination_limit at 20 (verified live
  // 2026-06-11: >20 returns 400 "La paginación tiene un límite de 20 cuentas").
  // The page MUST request at most 20 per page or the list errors out always.
  it('requests the accounts hook with paginationLimit capped at 20', () => {
    mockHooks();
    renderPage();
    expect(useGigaredAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ paginationLimit: 20 }),
    );
  });

  it('a full page (20 rows) under a text filter implies a next page', async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: 20 }, (_, i) => ({
      ...accounts[0],
      cic: `cic-${i}`,
    }));
    // The default fixture summary has total=7 (→ 1 real page), so to exercise the
    // hasNext heuristic we need a text filter active (summary no longer applies).
    mockHooks({ accountsData: { accounts: full } });
    renderPage();
    await user.type(screen.getByPlaceholderText(/email/i), 'x@y.com');
    // With a full page + a text filter the Pagination must expose a "next" affordance.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /siguiente|next|›|»/i })).toBeInTheDocument(),
    );
  });

  // Bug #47g-1 — totalPages REAL from the summary the page already has, instead
  // of the hasNext heuristic. The partner list endpoint gives no total, but the
  // summary does: registered/unregistered/total. Without a status filter the
  // pager spans ceil(total/20); with a status it spans ceil(thatCount/20). Only
  // when an email/account_id filter is active (the summary no longer applies)
  // does it fall back to the hasNext heuristic.
  describe('#47g-1 — real totalPages from summary', () => {
    const bigSummary: GigaredSummary = {
      accounts: { registered: 45, unregistered: 25, total: 70 },
      services: [],
    };
    // A full page of rows so the hasNext heuristic alone would say "page + 1" (2).
    const fullPage = Array.from({ length: 20 }, (_, i) => ({ ...accounts[0], cic: `cic-${i}` }));

    it('no status filter → pager spans ceil(total/20) = 4 pages', () => {
      mockHooks({ summaryData: bigSummary, accountsData: { accounts: fullPage } });
      renderPage();
      // ceil(70/20) = 4. The last page button (4) must be reachable.
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
      // The heuristic would have capped at 2 — make sure we exceed it.
      expect(screen.queryByRole('button', { name: '3' })).toBeInTheDocument();
    });

    it('status=registered → pager spans ceil(registered/20) = 3 pages', async () => {
      const user = userEvent.setup();
      mockHooks({ summaryData: bigSummary, accountsData: { accounts: fullPage } });
      renderPage();
      await user.selectOptions(screen.getByLabelText(/estado/i), 'registered');
      // ceil(45/20) = 3.
      await waitFor(() => expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument();
    });

    it('status=unregistered → pager spans ceil(unregistered/20) = 2 pages', async () => {
      const user = userEvent.setup();
      mockHooks({ summaryData: bigSummary, accountsData: { accounts: fullPage } });
      renderPage();
      await user.selectOptions(screen.getByLabelText(/estado/i), 'unregistered');
      // ceil(25/20) = 2.
      await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
    });

    it('with an email filter active → falls back to the hasNext heuristic', async () => {
      const user = userEvent.setup();
      mockHooks({ summaryData: bigSummary, accountsData: { accounts: fullPage } });
      renderPage();
      await user.type(screen.getByPlaceholderText(/email/i), 'x@y.com');
      // On page 1 with a full page the heuristic says totalPages = 2, NOT 4.
      // Wait for the debounce to collapse the pager from 4 (summary) down to 2.
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });
  });
});
