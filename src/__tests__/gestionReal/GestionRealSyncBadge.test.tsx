import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GestionRealSyncBadge } from '@/components/gestionReal/GestionRealSyncBadge';
import type { GestionRealSyncStatus } from '@/api/gestionReal.api';

const base: GestionRealSyncStatus = {
  entity: 'gr-clients',
  cursor: '27-05-2026',
  lastRunAt: new Date().toISOString(),
  lastResult: 'ok',
  itemsSynced: 5090,
  hasRun: true,
};

describe('GestionRealSyncBadge', () => {
  it('shows a live badge with the total client count when provided', () => {
    render(<GestionRealSyncBadge status={{ ...base, itemsSynced: 0 }} isError={false} totalClients={5257} />);
    expect(screen.getByText(/réplica viva/i)).toBeInTheDocument();
    // total (5257) wins over the last-run delta count (0)
    expect(screen.getByText(/5257/)).toBeInTheDocument();
  });

  it('falls back to itemsSynced when no total is given', () => {
    render(<GestionRealSyncBadge status={base} isError={false} />);
    expect(screen.getByText(/5090/)).toBeInTheDocument();
  });

  it('prefers clientCount from status over totalClients prop', () => {
    render(<GestionRealSyncBadge status={{ ...base, clientCount: 6000, itemsSynced: 0 }} isError={false} totalClients={5257} />);
    // clientCount (6000) should win over both totalClients (5257) and itemsSynced (0)
    expect(screen.getByText(/6000/)).toBeInTheDocument();
    expect(screen.queryByText(/5257/)).not.toBeInTheDocument();
  });

  it('shows contract count when contractCount is present', () => {
    const { container } = render(<GestionRealSyncBadge status={{ ...base, clientCount: 6000, contractCount: 4200 }} isError={false} />);
    expect(container.textContent).toMatch(/6000 clientes/);
    expect(container.textContent).toMatch(/4200 contratos/);
  });

  it('omits contract count when contractCount is undefined', () => {
    const { container } = render(<GestionRealSyncBadge status={{ ...base, clientCount: 6000 }} isError={false} />);
    expect(container.textContent).not.toMatch(/contratos/);
  });

  it('shows "sin sincronizar" before the first run', () => {
    render(<GestionRealSyncBadge status={{ ...base, hasRun: false, lastRunAt: null, lastResult: null }} isError={false} />);
    expect(screen.getByText(/sin sincronizar/i)).toBeInTheDocument();
  });

  it('shows an error state when the last run failed', () => {
    render(<GestionRealSyncBadge status={{ ...base, lastResult: 'error: GR down' }} isError={false} />);
    expect(screen.getByText(/error de sincronización/i)).toBeInTheDocument();
  });

  it('renders nothing when the endpoint is unreachable (feature off)', () => {
    const { container } = render(<GestionRealSyncBadge status={undefined} isError={true} />);
    expect(container).toBeEmptyDOMElement();
  });
});
