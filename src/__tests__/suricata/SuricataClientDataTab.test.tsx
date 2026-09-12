/**
 * SuricataClientDataTab (Fase H, task H.4, spec `suricata-tickets-ui` UI-5,
 * checklist "Análisis 360" de la skill `atencion-suricata-ipnext`).
 *
 *  CLD-1 sections    → all 5 checklist sections are present
 *  CLD-2 unmatched    → "sin cliente vinculado" when `clientId` is null
 *  CLD-3 matched      → matched-client indicator when `clientId` is set
 *  CLD-4 placeholders → sections without a BE data source show an honest placeholder, never invented data
 *  CLD-5 read-only    → the tab renders no write control of any kind
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SuricataClientDataTab } from '@/pages/suricata/SuricataTicketDetail/SuricataClientDataTab';
import type { SuricataTicketDetailDto } from '@/pages/suricata/api/suricataClient';

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

describe('CLD-1 sections', () => {
  it('renders all 5 checklist sections', () => {
    render(<SuricataClientDataTab ticket={makeTicket()} />);
    expect(screen.getByRole('region', { name: /historial de conversaciones previas/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /resumen del reclamo actual/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /misma casuística/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /equipo.*señal/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /administrativo.*deuda/i })).toBeInTheDocument();
  });
});

describe('CLD-2 unmatched', () => {
  it('shows "sin cliente vinculado" when clientId is null', () => {
    render(<SuricataClientDataTab ticket={makeTicket({ clientId: null })} />);
    expect(screen.getByText(/sin cliente vinculado/i)).toBeInTheDocument();
  });
});

describe('CLD-3 matched', () => {
  it('shows a matched-client indicator when clientId is set', () => {
    render(<SuricataClientDataTab ticket={makeTicket({ clientId: 'client-42' })} />);
    expect(screen.queryByText(/sin cliente vinculado/i)).not.toBeInTheDocument();
    expect(screen.getByText(/vinculado a un cliente/i)).toBeInTheDocument();
  });
});

describe('CLD-4 placeholders', () => {
  it('never invents data for sections with no BE source — honest placeholder text', () => {
    render(<SuricataClientDataTab ticket={makeTicket()} />);
    const equipmentSection = screen.getByRole('region', { name: /equipo.*señal/i });
    expect(equipmentSection.textContent).toMatch(/no disponible/i);
    const debtSection = screen.getByRole('region', { name: /administrativo.*deuda/i });
    expect(debtSection.textContent).toMatch(/no disponible/i);
  });

  it('shows the raw Suricata contact fields it does have', () => {
    render(<SuricataClientDataTab ticket={makeTicket()} />);
    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('+549232455511')).toBeInTheDocument();
  });
});

describe('CLD-5 read-only', () => {
  it('renders no button, link or form control anywhere in the tab', () => {
    render(<SuricataClientDataTab ticket={makeTicket({ clientId: 'client-42' })} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
