import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InfoTab } from '@/pages/customers/tabs/InfoTab';
import type { Customer } from '@/types/customer';

const mockCustomer: Customer = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active',
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  logs: [],
  contracts: [],
};

describe('InfoTab', () => {
  it('renders customer fields', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    // Fields are rendered as read-only inputs — assert via displayValue
    expect(screen.getByDisplayValue('Alice García')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('Av. Corrientes 1234, CABA')).toBeInTheDocument();
  });

  // M1: OpenStreetMap iframe was removed from this component — test removed

  it('renders "Bajas" for a baja customer status', () => {
    const customer: Customer = { ...mockCustomer, status: 'baja' };
    render(<InfoTab customer={customer} active={true} />);
    expect(screen.getByText('Bajas')).toBeInTheDocument();
  });

  it('renders "Incobrable" (GR label) for a blocked customer status', () => {
    const customer: Customer = { ...mockCustomer, status: 'blocked' };
    render(<InfoTab customer={customer} active={true} />);
    expect(screen.getByText('Incobrable')).toBeInTheDocument();
  });
});

describe('InfoTab — BalanceCard (combo-balance-honesto) — CARD-1: sin dato NO es "sin deuda"', () => {
  it('balanceDue: null → "Saldo no disponible"; NO "Sin deuda", NO "Deudor", NO monto', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: null };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-unknown')).toBeInTheDocument();
    expect(screen.getByText('Saldo no disponible')).toBeInTheDocument();
    expect(screen.queryByText('Sin deuda')).not.toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('balance-amount')).not.toBeInTheDocument();
  });

  it('balanceDue ausente se comporta EXACTAMENTE igual que null (mismo testid)', () => {
    render(<InfoTab customer={mockCustomer} active={true} />);
    expect(screen.getByTestId('balance-unknown')).toBeInTheDocument();
    expect(screen.getByText('Saldo no disponible')).toBeInTheDocument();
  });

  it('el estado "no disponible" expone un texto accesible con el porqué (no sólo el glifo)', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: null };
    render(<InfoTab customer={customer} active={true} />);

    const el = screen.getByTestId('balance-unknown');
    // El texto accesible (title/aria-label) explica la razón — no alcanza
    // con el "—"/"Saldo no disponible" visible para un lector de pantalla
    // que no tenga contexto adicional.
    const accessibleText = el.getAttribute('title') ?? el.getAttribute('aria-label') ?? '';
    expect(accessibleText.length).toBeGreaterThan(0);
    expect(accessibleText).toMatch(/gesti[oó]n real|sincroniz/i);
  });
});

describe('InfoTab — BalanceCard — CARD-2: cero medido, deuda y crédito son estados distintos', () => {
  it('balanceDue: 0 → "Sin deuda"; NO "no disponible", NO "Deudor"', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 0 };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-no-debt')).toBeInTheDocument();
    expect(screen.getByTestId('balance-no-debt').textContent).toContain('Sin deuda');
    expect(screen.queryByTestId('balance-unknown')).not.toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('balanceDue: 65722.07 → badge "Deudor" + monto formateado es-AR', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 65722.07 };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByText('Deudor')).toBeInTheDocument();
    const amountEl = screen.getByTestId('balance-amount');
    expect(amountEl.textContent).toMatch(/65[.,]722/);
    expect(amountEl.textContent).toMatch(/07/);
  });

  it('balanceDue: -5000 → "Saldo a favor" con 5.000 (valor absoluto), SIN "Deudor" ni "Sin deuda"', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: -5000 };
    render(<InfoTab customer={customer} active={true} />);

    const creditEl = screen.getByTestId('balance-credit');
    expect(creditEl.textContent).toMatch(/5[.,]000/);
    expect(creditEl.textContent).not.toMatch(/-5[.,]000/);
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin deuda')).not.toBeInTheDocument();
  });

  it('los cuatro estados son mutuamente excluyentes (exactamente UN testid por render)', () => {
    const testids = ['balance-unknown', 'balance-credit', 'balance-no-debt', 'balance-amount'];
    const cases: Array<number | null> = [null, -5000, 0, 65722.07];

    for (const due of cases) {
      const { unmount } = render(<InfoTab customer={{ ...mockCustomer, balanceDue: due }} active={true} />);
      const present = testids.filter((t) => screen.queryByTestId(t) !== null);
      expect(present).toHaveLength(1);
      unmount();
    }
  });
});

describe('InfoTab — BalanceCard — CARD-3: frescura del dato', () => {
  it('lastBalanceAt de hace 5 min → "Actualizado hace …"', () => {
    const recentDate = new Date(Date.now() - 5 * 60_000).toISOString();
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, lastBalanceAt: recentDate };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByText(/Actualizado hace/)).toBeInTheDocument();
  });

  it('lastBalanceAt inválido → CERO "NaN" en pantalla, la marca se omite, la card no crashea', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, lastBalanceAt: 'no-es-una-fecha' };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument();
    // La card sigue renderizando el resto del estado con normalidad.
    expect(screen.getByTestId('balance-amount')).toBeInTheDocument();
  });

  it('sin lastBalanceAt no hay marca "Actualizado …"', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, lastBalanceAt: null };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument();
  });
});

describe('InfoTab — BalanceCard — CARD-4: balanceStale visible, con texto, sin contradecir al estado', () => {
  it('balanceDue: 1000 + balanceStale: true → indicador con TEXTO (no sólo color/icono)', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, balanceStale: true };
    render(<InfoTab customer={customer} active={true} />);

    const chip = screen.getByTestId('balance-stale');
    expect(chip.textContent?.trim().length).toBeGreaterThan(0);
    expect(chip.textContent).toMatch(/desactualizad/i);
  });

  it('balanceStale: false → el indicador NO está presente', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 1000, balanceStale: false };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByTestId('balance-stale')).not.toBeInTheDocument();
  });

  it('balanceStale ausente ≡ fresco: sin indicador, sin crash', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: 1000 };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByTestId('balance-stale')).not.toBeInTheDocument();
  });

  it('balanceDue: null + balanceStale: true → NO se avisa de dato viejo (gana "no disponible")', () => {
    const customer: Customer = { ...mockCustomer, balanceDue: null, balanceStale: true };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-unknown')).toBeInTheDocument();
    expect(screen.queryByTestId('balance-stale')).not.toBeInTheDocument();
  });
});
