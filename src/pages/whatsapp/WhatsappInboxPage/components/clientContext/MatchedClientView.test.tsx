import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { MatchedClientView } from './MatchedClientView';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';

const CLIENT: WhatsappInboxClientSummary = {
  id: '42',
  name: 'Juan Perez',
  email: 'juan@example.com',
  phone: '+5491100000000',
  status: 'active',
  fichaClientId: '42',
  balance: { due: 1000, currency: 'ARS', isDebtor: true, stale: false, lastRefreshedAt: null },
  lastInvoice: null,
  nextDueDate: null,
  contracts: [{ id: 'c1', plan: 'Fibra 100M', status: 'active', technology: 'FTTH', address: 'Calle Falsa 123', serviceStatus: 'active' }],
  openTicketsCount: 2,
  recentTickets: [],
  recentTasks: [],
  recentLogs: [],
};

function renderView(props: Partial<ComponentProps<typeof MatchedClientView>> = {}) {
  return render(
    <MemoryRouter>
      <MatchedClientView client={CLIENT} {...props} />
    </MemoryRouter>,
  );
}

describe('MatchedClientView (messaging-inbox-v2 F1.5, design §1 — composición de las 4 secciones)', () => {
  it('renderiza identidad + financiero + servicio + interacciones', () => {
    renderView();

    expect(screen.getByText('Juan Perez')).toBeInTheDocument(); // IdentityHeader
    expect(screen.getByText(/debe/i)).toBeInTheDocument(); // FinancialSection
    expect(screen.getByText('Fibra 100M')).toBeInTheDocument(); // ServiceSection
    expect(screen.getByText(/2 tickets abiertos/i)).toBeInTheDocument(); // InteractionsSection
  });

  it('hasStaleError:true muestra el chip "no se pudo actualizar"', () => {
    renderView({ hasStaleError: true });
    expect(screen.getByText(/no se pudo actualizar/i)).toBeInTheDocument();
  });

  it('sin hasStaleError NO muestra el chip', () => {
    renderView();
    expect(screen.queryByText(/no se pudo actualizar/i)).not.toBeInTheDocument();
  });

  it('reenvía `conversations` (TOP-LEVEL del contexto) a InteractionsSection', () => {
    renderView({ conversations: { total: 3, open: 1, resolved: 2 } });
    expect(screen.getByText('3 conversaciones · 1 abierta · 2 resueltas')).toBeInTheDocument();
  });

  it('sin `conversations` (backcompat) cae al empty state, no rompe', () => {
    renderView();
    expect(screen.getByText(/sin conversaciones previas/i)).toBeInTheDocument();
  });
});
