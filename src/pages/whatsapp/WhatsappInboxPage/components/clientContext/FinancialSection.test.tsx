import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FinancialSection } from './FinancialSection';
import type { WhatsappInboxClientSummary } from '@/types/whatsapp';

const BASE: WhatsappInboxClientSummary = {
  id: '1',
  name: 'Juan Perez',
  email: null,
  phone: null,
  status: 'active',
  fichaClientId: '1',
  balance: { due: null, currency: null, isDebtor: false, stale: false, lastRefreshedAt: null },
  lastInvoice: null,
  nextDueDate: null,
  contracts: [],
  openTicketsCount: 0,
  recentTickets: [],
  recentTasks: [],
  recentLogs: [],
};

describe('FinancialSection — HERO deuda (messaging-inbox-v2 F1.5, design §5.2)', () => {
  it('isDebtor:true muestra badge "Debe" + monto formateado es-AR ARS', () => {
    render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 5000, currency: 'ARS', isDebtor: true, stale: false, lastRefreshedAt: null } }}
      />,
    );
    expect(screen.getByText(/debe/i)).toBeInTheDocument();
    expect(screen.getByText('$ 5.000,00')).toBeInTheDocument();
  });

  it('isDebtor:false con due!=null muestra pill "Al día" + monto', () => {
    render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 0, currency: 'ARS', isDebtor: false, stale: false, lastRefreshedAt: null } }}
      />,
    );
    expect(screen.getByText(/al día/i)).toBeInTheDocument();
    expect(screen.getByText('$ 0,00')).toBeInTheDocument();
  });

  it('due==null muestra "—" + "Saldo no disponible" (no pinta verde si no se sabe)', () => {
    render(<FinancialSection client={BASE} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/saldo no disponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/al día/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^debe$/i)).not.toBeInTheDocument();
  });

  it('isRefreshingBalance:true muestra el pill "actualizando…"', () => {
    render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 100, currency: 'ARS', isDebtor: true, stale: true, lastRefreshedAt: null } }}
        isRefreshingBalance
      />,
    );
    expect(screen.getByText(/actualizando/i)).toBeInTheDocument();
  });

  it('sin isRefreshingBalance NO muestra el pill', () => {
    render(<FinancialSection client={BASE} isRefreshingBalance={false} />);
    expect(screen.queryByText(/actualizando/i)).not.toBeInTheDocument();
  });

  it('bug IMPORTANTE animación (review adversarial): isRefreshingBalance:true togglea la clase fin-hero--refreshing (crossfade+blur real cableado, no CSS muerto)', () => {
    const { container } = render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 100, currency: 'ARS', isDebtor: true, stale: true, lastRefreshedAt: null } }}
        isRefreshingBalance
      />,
    );
    expect(container.querySelector('.fin-hero')).toHaveClass('fin-hero--refreshing');
  });

  it('sin isRefreshingBalance NO tiene la clase fin-hero--refreshing', () => {
    const { container } = render(<FinancialSection client={BASE} isRefreshingBalance={false} />);
    expect(container.querySelector('.fin-hero')).not.toHaveClass('fin-hero--refreshing');
  });

  it('lastInvoice presente muestra número + badge + importe', () => {
    render(
      <FinancialSection
        client={{
          ...BASE,
          lastInvoice: { id: 'inv-1', number: 'F-001', dueDate: '2026-08-01', amount: 1234, status: 'pendiente', balance: 1234 },
        }}
      />,
    );
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('$ 1.234,00')).toBeInTheDocument();
  });

  it('sin lastInvoice muestra el empty state', () => {
    render(<FinancialSection client={BASE} />);
    expect(screen.getByText(/sin facturas registradas/i)).toBeInTheDocument();
  });

  it('nextDueDate presente se formatea con formatDateShort', () => {
    render(<FinancialSection client={{ ...BASE, nextDueDate: '2026-08-15' }} />);
    expect(screen.getByText('15 ago 2026')).toBeInTheDocument();
  });

  it('sin nextDueDate muestra "Sin vencimientos"', () => {
    render(<FinancialSection client={BASE} />);
    expect(screen.getByText(/sin vencimientos/i)).toBeInTheDocument();
  });

  it('bug BAJO (review adversarial): currency="" (código no-ISO/vacío) NO rompe el HERO con un RangeError — cae a ARS', () => {
    render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 5000, currency: '', isDebtor: true, stale: false, lastRefreshedAt: null } }}
      />,
    );
    expect(screen.getByText(/debe/i)).toBeInTheDocument();
    expect(screen.getByText('$ 5.000,00')).toBeInTheDocument();
  });

  it('bug BAJO (review adversarial): currency con código no-ISO (ej. "PESOS") NO rompe el HERO — cae a ARS', () => {
    render(
      <FinancialSection
        client={{ ...BASE, balance: { due: 5000, currency: 'PESOS', isDebtor: true, stale: false, lastRefreshedAt: null } }}
      />,
    );
    expect(screen.getByText(/debe/i)).toBeInTheDocument();
    expect(screen.getByText('$ 5.000,00')).toBeInTheDocument();
  });
});

/**
 * FX1 (fix wave combo-balance-honesto, R1 CRITICAL) — el `?.` de
 * `useWhatsapp.ts:880` salvó al CUERPO del hook de un payload parcial del BE
 * (`client` presente, `balance` ausente) pero dejó a los CONSUMIDORES
 * explotando: este componente hacía `balance.due` sin guard y tiraba
 * `Cannot read properties of undefined (reading 'due')` con el fixture EXACTO
 * del test de aquel fix. Un panel que se cae entero es peor que un panel que
 * dice "no sé": el resto del contexto (facturas, vencimiento) sigue siendo
 * información útil para el agente.
 */
describe('FinancialSection — FX1: `client` SIN bloque `balance` (payload parcial del BE)', () => {
  /** El tipo declara `balance` requerido; el BE puede no emitirlo (deploy
   *  escalonado / proyección parcial). El cast reproduce ESE runtime. */
  const CLIENT_SIN_BALANCE = { ...BASE, balance: undefined } as unknown as WhatsappInboxClientSummary;

  it('no crashea: renderiza el estado "Saldo no disponible" en vez de tirar el panel entero', () => {
    expect(() => render(<FinancialSection client={CLIENT_SIN_BALANCE} />)).not.toThrow();
    expect(screen.getByText(/saldo no disponible/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('sin `balance` NO se afirma "Al día" ni "Debe" (no se inventa un estado financiero)', () => {
    render(<FinancialSection client={CLIENT_SIN_BALANCE} />);
    expect(screen.queryByText(/al día/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^debe$/i)).not.toBeInTheDocument();
  });

  it('el resto de la sección sigue viva: última factura y próximo vencimiento se renderizan igual', () => {
    render(
      <FinancialSection
        client={
          {
            ...BASE,
            balance: undefined,
            nextDueDate: '2026-08-15',
            lastInvoice: { id: 'inv-1', number: 'F-001', dueDate: '2026-08-01', amount: 1234, status: 'pendiente', balance: 1234 },
          } as unknown as WhatsappInboxClientSummary
        }
      />,
    );
    expect(screen.getByText('F-001')).toBeInTheDocument();
    expect(screen.getByText('$ 1.234,00')).toBeInTheDocument();
    expect(screen.getByText('15 ago 2026')).toBeInTheDocument();
    expect(screen.getByText(/sin actualizaciones/i)).toBeInTheDocument();
  });
});
