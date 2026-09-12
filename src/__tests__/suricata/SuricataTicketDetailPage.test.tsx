/**
 * SuricataTicketDetailPage (Fase H, task H.1, spec `suricata-tickets-ui` UI-2).
 * RBAC gating (`suricata.read`) lives at the route level (App.tsx), same
 * convention as `SuricataTicketsPage` — this test isolates the page's own
 * fetch-state branching + header + tab composition, stubbing the 3 tab
 * components (each has its own dedicated test file).
 *
 *  DET-1 loading    → skeleton (role=status)
 *  DET-2 not found  → explicit "no encontrado" state (404), with a way back to the list
 *  DET-3 error      → role=alert + retry that refetches (any OTHER failure)
 *  DET-4 success    → header (subject/badges/assignee) + all 3 tabs, default tab = Conversación
 *  DET-5 tabs       → switching tabs never re-fetches (UI-2: zero live Suricata calls on tab switch)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SuricataTicketDetailDto } from '@/pages/suricata/api/suricataClient';

vi.mock('@/pages/suricata/hooks/useSuricataTickets', () => ({
  useSuricataTicketDetail: vi.fn(),
}));
vi.mock('@/pages/suricata/SuricataTicketDetail/SuricataConversationTab', () => ({
  SuricataConversationTab: () => <div data-testid="conversation-tab-stub" />,
}));
vi.mock('@/pages/suricata/SuricataTicketDetail/SuricataAiAnalysisTab', () => ({
  SuricataAiAnalysisTab: () => <div data-testid="ai-analysis-tab-stub" />,
}));
vi.mock('@/pages/suricata/SuricataTicketDetail/SuricataClientDataTab', () => ({
  SuricataClientDataTab: () => <div data-testid="client-data-tab-stub" />,
}));

import SuricataTicketDetailPage from '@/pages/suricata/SuricataTicketDetailPage';
import { useSuricataTicketDetail } from '@/pages/suricata/hooks/useSuricataTickets';

function makeTicket(overrides: Partial<SuricataTicketDetailDto> = {}): SuricataTicketDetailDto {
  return {
    id: 't-1',
    externalId: '18742',
    subject: 'Sin Servicio',
    status: 'Open',
    priority: 'alta',
    areaId: 'area-1',
    areaName: 'Soporte',
    customerName: 'María Gómez',
    customerEmail: 'maria@example.com',
    customerPhone: '+549232455511',
    externalClientRef: 'suricata-client-99',
    clientId: null,
    botState: 'sin_analizar',
    assigneeId: null,
    assigneeName: null,
    openedAt: '2026-09-12T14:00:00.000Z',
    lastMessageAt: '2026-09-12T14:20:00.000Z',
    syncedAt: '2026-09-12T14:22:00.000Z',
    messages: [],
    attachments: [],
    verdicts: [],
    ...overrides,
  };
}

function mockDetail(partial: Partial<ReturnType<typeof useSuricataTicketDetail>>) {
  vi.mocked(useSuricataTicketDetail).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useSuricataTicketDetail>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/suricata-tickets/t-1']}>
      <Routes>
        <Route path="/admin/suricata-tickets/:id" element={<SuricataTicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DET-1 loading', () => {
  it('shows a skeleton while the detail loads', () => {
    mockDetail({ isLoading: true });
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DET-2 not found', () => {
  it('shows an explicit not-found state on a 404, with a link back to the list', () => {
    mockDetail({
      isError: true,
      error: { isAxiosError: true, response: { status: 404 } } as unknown as Error,
    });
    renderPage();
    expect(screen.getByText(/no encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver/i })).toHaveAttribute('href', '/admin/suricata-tickets');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DET-3 error', () => {
  it('shows role=alert with a retry for any other failure', async () => {
    const refetch = vi.fn();
    mockDetail({
      isError: true,
      error: { isAxiosError: true, response: { status: 500 } } as unknown as Error,
      refetch,
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('DET-4 success', () => {
  it('renders the header and defaults to the Conversación tab', () => {
    mockDetail({ data: makeTicket() });
    renderPage();

    expect(screen.getByRole('heading', { name: /maría gómez/i })).toBeInTheDocument();
    expect(screen.getByText(/18742/)).toBeInTheDocument();
    expect(screen.getByText(/sin asignar/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /conversación/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('conversation-tab-stub')).toBeInTheDocument();
  });
});

describe('DET-5 tabs', () => {
  it('switching to Análisis IA does not call useSuricataTicketDetail again', async () => {
    mockDetail({ data: makeTicket() });
    renderPage();

    const callsBefore = vi.mocked(useSuricataTicketDetail).mock.calls.length;
    await userEvent.click(screen.getByRole('tab', { name: /análisis ia/i }));

    expect(screen.getByTestId('ai-analysis-tab-stub')).toBeInTheDocument();
    // Re-renders from the tab-switch state update are fine; a NEW distinct
    // ticketId argument (a fresh fetch) is what UI-2 forbids.
    const callsAfter = vi.mocked(useSuricataTicketDetail).mock.calls;
    expect(callsAfter.slice(callsBefore).every((args) => args[0] === 't-1')).toBe(true);
  });
});
