import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { IdentityHeader } from './IdentityHeader';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';

const CLIENT: WhatsappInboxClientSummary = {
  id: '42',
  name: 'Juan Perez',
  email: 'juan@example.com',
  phone: '+5491100000000',
  status: 'active',
  fichaClientId: '42',
  balance: { due: 0, currency: 'ARS', isDebtor: false, stale: false, lastRefreshedAt: null },
  lastInvoice: null,
  nextDueDate: null,
  contracts: [],
  openTicketsCount: 0,
  recentTickets: [],
  recentTasks: [],
  recentLogs: [],
};

function renderHeader(client: WhatsappInboxClientSummary) {
  return render(
    <MemoryRouter>
      <IdentityHeader client={client} />
    </MemoryRouter>,
  );
}

describe('IdentityHeader (messaging-inbox-v2 F1.5, design §5.1)', () => {
  it('muestra nombre, status badge y link a la ficha completa', () => {
    renderHeader(CLIENT);

    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver perfil/i })).toHaveAttribute(
      'href',
      '/admin/customers/view/42',
    );
  });

  it('teléfono/email presentes se muestran como tel:/mailto: clickeables', () => {
    renderHeader(CLIENT);

    expect(screen.getByRole('link', { name: CLIENT.phone! })).toHaveAttribute(
      'href',
      `tel:${CLIENT.phone}`,
    );
    expect(screen.getByRole('link', { name: CLIENT.email! })).toHaveAttribute(
      'href',
      `mailto:${CLIENT.email}`,
    );
  });

  it('teléfono/email ausentes muestran "Sin dato" (patrón CustomerCard)', () => {
    renderHeader({ ...CLIENT, phone: null, email: null });

    expect(screen.getAllByText('Sin dato')).toHaveLength(2);
  });

  it('bug BAJO (review adversarial): status fuera del union conocido (BE degradado/mirror desalineado) usa toStatusBadgeVariant como fallback defensivo — mismo patrón que CandidatePicker, no propaga el string crudo', () => {
    const malformed: WhatsappInboxClientSummary = {
      ...CLIENT,
      status: 'unexpected_status' as unknown as WhatsappInboxClientSummary['status'],
    };
    renderHeader(malformed);

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.queryByText('unexpected_status')).not.toBeInTheDocument();
  });
});
