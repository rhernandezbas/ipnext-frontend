/**
 * Tests for ActivityBody — the Actividad tab backed by the AuditEvent log.
 * Mocks useAuditEvents.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuditEventPage } from '@/types/audit';

vi.mock('@/hooks/useAuditEvents', () => ({
  useAuditEvents: vi.fn(),
  AUDIT_EVENTS_QUERY_KEY: ['admin', 'audit-events'],
}));

import { useAuditEvents } from '@/hooks/useAuditEvents';
import { ActivityBody } from '@/pages/system/admin/ActivityBody';

function makePage(overrides: Partial<AuditEventPage> = {}): AuditEventPage {
  return {
    items: [
      {
        id: 'ae-1',
        actorId: 'u1',
        actorLogin: 'carlos',
        method: 'POST',
        path: '/api/clients',
        action: 'create_client',
        entityType: 'Client',
        entityId: '1001',
        beforeJson: null,
        afterJson: { name: 'Acme SA' },
        statusCode: 201,
        errorMessage: null,
        ip: '192.168.1.20',
        createdAt: '2026-05-01T10:00:00Z',
      },
      {
        id: 'ae-2',
        actorId: 'u2',
        actorLogin: 'maria',
        method: 'DELETE',
        path: '/api/clients/999',
        action: null,
        entityType: 'Client',
        entityId: '999',
        beforeJson: { name: 'Old Co' },
        afterJson: null,
        statusCode: 500,
        errorMessage: 'boom',
        ip: '10.0.0.5',
        createdAt: '2026-04-30T09:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

function mockHook(page: AuditEventPage, opts: { isLoading?: boolean } = {}) {
  vi.mocked(useAuditEvents).mockReturnValue({
    data: opts.isLoading ? undefined : page,
    isLoading: Boolean(opts.isLoading),
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useAuditEvents>);
}

describe('ActivityBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rows from the audit events', () => {
    mockHook(makePage());
    render(<ActivityBody />);

    expect(screen.getByText('carlos')).toBeInTheDocument();
    expect(screen.getByText('maria')).toBeInTheDocument();
    // action falls back to method when action is null
    expect(screen.getByText('create_client')).toBeInTheDocument();
  });

  it('shows column headers', () => {
    mockHook(makePage());
    render(<ActivityBody />);

    expect(screen.getByRole('columnheader', { name: /actor/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /acción/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /entidad/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /método/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /fecha/i })).toBeInTheDocument();
  });

  it('changing the método filter updates the query', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    const methodSelect = screen.getByLabelText(/método/i);
    await user.selectOptions(methodSelect, 'DELETE');

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('changing the entityType filter updates the query', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    const entityInput = screen.getByLabelText(/entidad/i);
    await user.type(entityInput, 'Client');

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: 'Client' })
    );
  });

  it('changing the Desde date updates the query', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    const fromInput = screen.getByLabelText(/desde/i);
    await user.type(fromInput, '2026-05-01');

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-05-01' })
    );
  });

  it('clicking a row opens the detail drawer showing before/after', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    await user.click(screen.getByText('carlos'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Antes')).toBeInTheDocument();
    expect(within(dialog).getByText('Después')).toBeInTheDocument();
    // afterJson content rendered
    expect(within(dialog).getByText(/Acme SA/)).toBeInTheDocument();
  });

  it('drawer closes on Escape', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    await user.click(screen.getByText('carlos'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows empty state when there are no events', () => {
    mockHook(makePage({ items: [], total: 0 }));
    render(<ActivityBody />);

    expect(screen.getByText(/no hay actividad/i)).toBeInTheDocument();
  });

  it('pagination next button advances the page query', async () => {
    const user = userEvent.setup();
    // total 60, pageSize 25 → 3 pages
    mockHook(makePage({ total: 60, pageSize: 25, page: 1 }));
    render(<ActivityBody />);

    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  // ── change `noc-alerts-config`, Fase F FE ──────────────────────────────────

  it('preseeds the entityType filter from the initialEntityType prop', () => {
    mockHook(makePage());
    render(<ActivityBody initialEntityType="NocAlert" />);

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: 'NocAlert' })
    );
    expect(screen.getByLabelText(/entidad/i)).toHaveValue('NocAlert');
  });

  it('clicking the "Alertas NOC" preset sets entityType=NocAlert and resets to page 1', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody />);

    await user.click(screen.getByRole('button', { name: 'Alertas NOC' }));

    expect(useAuditEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: 'NocAlert', page: 1 })
    );
    expect(screen.getByLabelText(/entidad/i)).toHaveValue('NocAlert');
  });

  it('clicking the "Todas" preset clears the entityType filter', async () => {
    const user = userEvent.setup();
    mockHook(makePage());
    render(<ActivityBody initialEntityType="NocAlert" />);

    await user.click(screen.getByRole('button', { name: 'Todas' }));

    const lastCallArgs = vi.mocked(useAuditEvents).mock.calls.at(-1)?.[0];
    expect(lastCallArgs?.entityType).toBeUndefined();
  });

  it('shows a "Canal" column with the ACK channel only when filtering entityType=NocAlert', () => {
    mockHook(
      makePage({
        items: [
          {
            id: 'ae-3',
            actorId: 'u3',
            actorLogin: 'diego',
            method: 'POST',
            path: '/api/alerts/a1/acknowledge',
            action: 'alert.acknowledge',
            entityType: 'NocAlert',
            entityId: 'a1',
            beforeJson: null,
            afterJson: { channel: 'panel' },
            statusCode: 200,
            errorMessage: null,
            ip: '10.0.0.9',
            createdAt: '2026-07-20T12:00:00Z',
          },
        ],
        total: 1,
      }),
    );
    render(<ActivityBody initialEntityType="NocAlert" />);

    expect(screen.getByRole('columnheader', { name: /canal/i })).toBeInTheDocument();
    expect(screen.getByText('panel')).toBeInTheDocument();
  });

  it('does NOT show the "Canal" column for other entity types', () => {
    mockHook(makePage());
    render(<ActivityBody />);
    expect(screen.queryByRole('columnheader', { name: /canal/i })).not.toBeInTheDocument();
  });
});
