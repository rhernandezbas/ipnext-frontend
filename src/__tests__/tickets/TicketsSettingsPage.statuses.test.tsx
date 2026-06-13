/**
 * Tests for TicketsSettingsPage — verifies that the 'statuses' tab renders
 * TicketStatusesBody when active.
 *
 * Mocks TicketAreasBody, TicketSlaBody, and TicketStatusesBody to keep the
 * test focused on tab rendering rather than body internals.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/pages/tickets/settings/TicketAreasBody', () => ({
  TicketAreasBody: () => <div data-testid="areas-body">TicketAreasBody</div>,
}));

vi.mock('@/pages/tickets/settings/TicketSlaBody', () => ({
  TicketSlaBody: () => <div data-testid="sla-body">TicketSlaBody</div>,
}));

vi.mock('@/pages/tickets/settings/TicketStatusesBody', () => ({
  TicketStatusesBody: () => <div data-testid="statuses-body">TicketStatusesBody</div>,
}));

import TicketsSettingsPage from '@/pages/tickets/TicketsSettingsPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketsSettingsPage />
    </MemoryRouter>
  );
}

describe('TicketsSettingsPage — statuses tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hash to avoid test bleed
    window.location.hash = '';
  });

  it('renders the page title "Configuracion"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /configuracion/i })).toBeInTheDocument();
  });

  it('shows the "Estados" tab button', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /estados/i })).toBeInTheDocument();
  });

  it('renders TicketStatusesBody when the "Estados" tab is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /estados/i }));
    expect(screen.getByTestId('statuses-body')).toBeInTheDocument();
  });

  it('renders TicketAreasBody by default (first tab)', () => {
    renderPage();
    expect(screen.getByTestId('areas-body')).toBeInTheDocument();
  });
});
