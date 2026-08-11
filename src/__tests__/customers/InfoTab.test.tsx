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

  // FX8 (fix wave, R2 F1 / MUT-3): el test de arriba mira SÓLO el monto, así
  // que el badge "A favor" podía desaparecer entero y la suite seguía verde —
  // justo el scenario A11Y-1 "el estado se lee sin color" que el spec promete.
  // Los 4 estados quedan pineados por su TEXTO, explícitamente.
  it.each([
    ['unknown', null, /saldo no disponible/i],
    ['credit', -5000, /a favor/i],
    ['settled', 0, /sin deuda/i],
    ['debt', 65722.07, /deudor/i],
  ] as const)('A11Y-1 — el estado %s se identifica por su TEXTO, sin depender del color', (_kind, due, textRe) => {
    render(<InfoTab customer={{ ...mockCustomer, balanceDue: due }} active={true} />);
    expect(screen.getByText(textRe)).toBeInTheDocument();
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

  // FX4 (fix wave, R1 M4) — par CRUZADO: el chip de stale SÍ tenía el guard
  // `state.kind !== 'unknown'`, la marca "Actualizado hace …" de al lado NO.
  // Resultado en pantalla: "Saldo no disponible · Actualizado hace 2 h" —
  // ¿actualizado QUÉ, si no hay dato? El `lastBalanceAt` de un cliente sin
  // `grClienteId` es la marca del último INTENTO, no de un saldo real.
  it('balanceDue null + lastBalanceAt reciente → NO se afirma "Actualizado hace …" (mismo gate que el chip de stale)', () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const customer: Customer = { ...mockCustomer, balanceDue: null, lastBalanceAt: recentDate };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByTestId('balance-unknown')).toBeInTheDocument();
    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument();
  });

  it('balanceDue null + lastBalanceAt + balanceStale true → ni marca de frescura ni chip de viejo (los dos gates coinciden)', () => {
    const customer: Customer = {
      ...mockCustomer,
      balanceDue: null,
      lastBalanceAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
      balanceStale: true,
    };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('balance-stale')).not.toBeInTheDocument();
  });

  it('el gate NO se lleva puesta la marca cuando SÍ hay dato (no-regresión del cruzado)', () => {
    const customer: Customer = {
      ...mockCustomer,
      balanceDue: 0,
      lastBalanceAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    };
    render(<InfoTab customer={customer} active={true} />);

    expect(screen.getByText(/Actualizado hace/)).toBeInTheDocument();
  });
});

/**
 * FX7 (fix wave, R1 M7) — el título de la card era el literal "Saldo deudor",
 * fijo: coronaba un CRÉDITO ("Saldo deudor / A favor $ 5.000") y un cero
 * medido con la palabra "deudor". Pasa a un título NEUTRO por estado —
 * "Saldo de la cuenta", el mismo rótulo que ya usa el sub-header, así el
 * operador lee el mismo nombre para el mismo dato en los dos lugares.
 * Se eligió el título neutro (y no uno por estado) porque no rompe ningún
 * assert de CARD-1..4: ninguno matchea el título, y "Deudor" sigue siendo el
 * badge del estado de deuda — que ahora es la ÚNICA ocurrencia de esa palabra
 * cuando corresponde.
 */
describe('InfoTab — BalanceCard — FX7: el título de la card no presupone deuda', () => {
  it('con un CRÉDITO el título no dice "deudor"', () => {
    render(<InfoTab customer={{ ...mockCustomer, balanceDue: -5000 }} active={true} />);
    expect(screen.queryByText(/saldo deudor/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /saldo de la cuenta/i })).toBeInTheDocument();
  });

  it('con un CERO medido el título tampoco dice "deudor"', () => {
    render(<InfoTab customer={{ ...mockCustomer, balanceDue: 0 }} active={true} />);
    expect(screen.queryByText(/saldo deudor/i)).not.toBeInTheDocument();
  });

  it('con DEUDA, "Deudor" aparece UNA sola vez — el badge del estado, no el título', () => {
    render(<InfoTab customer={{ ...mockCustomer, balanceDue: 65722.07 }} active={true} />);
    expect(screen.getAllByText(/deudor/i)).toHaveLength(1);
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
