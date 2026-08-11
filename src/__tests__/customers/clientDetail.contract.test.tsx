/**
 * CONTRACT TEST: `GET /api/clients/:id` ↔ `Customer` (combo-balance-honesto,
 * TYPE-1). Fuente canónica BE: `PrismaCustomerRepository.toCustomer():29-91`
 * (emite `balanceDue: number | null`, `balanceCurrency: 'ARS' | null`,
 * `lastBalanceAt: string | null`, `balanceStale: boolean`; NUNCA
 * `balanceOverdue` ni `invoicesQty`) + `clients.routes.ts:165-182`
 * (`res.json(customer)` — entidad cruda, sin DTO intermedio).
 *
 * Lección `e2e-envelope-mock-mismatch`: un test que INVENTA las props no
 * caza un mismatch de shape. El fixture de acá se calca del payload real —
 * incluye `balanceCurrency`, que el tipo `Customer` NO declara a propósito
 * (design.md Decisión "balanceCurrency NO se agrega": sólo vale 'ARS'|null,
 * sintetizado por el parser del BE, sin valor para el usuario). Por eso el
 * fixture crudo se tipa ancho primero y se asigna a `Customer` vía
 * identificador (no como literal): así TypeScript NO dispara excess-property
 * check sobre `balanceCurrency` — igual que pasa en runtime real, donde el
 * BE manda más campos de los que el tipo declara.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InfoTab } from '@/pages/customers/tabs/InfoTab';
import type { Customer } from '@/types/customer';

const BASE_FIELDS = {
  id: 42,
  name: 'Alice García',
  email: 'alice@example.com',
  phone: '11-1111-1111',
  address: 'Av. Corrientes 1234, CABA',
  status: 'active' as const,
  category: 'residential',
  tariffPlan: 'Plan 50MB',
  createdAt: '2024-01-01',
  updatedAt: '2024-06-01',
  contracts: [],
  logs: [],
};

// Calco EXACTO de la respuesta real de un cliente deudor con saldo vinculado
// a Gestión Real (balanceCurrency incluido a propósito — ver header).
const rawDebtorResponse = {
  ...BASE_FIELDS,
  balanceDue: 65722.07,
  balanceCurrency: 'ARS' as const,
  balanceStale: false,
  lastBalanceAt: '2026-08-01T00:00:00.000Z',
};

// Calco EXACTO del cliente sin `grClienteId`: sin dato de saldo verificado.
const rawUnlinkedResponse = {
  ...BASE_FIELDS,
  balanceDue: null,
  balanceCurrency: null,
  balanceStale: true,
  lastBalanceAt: null,
};

// Calco EXACTO de un cliente con saldo a favor (el parser del BE preserva el
// signo — `parseGrDebtStrict` sólo rechaza no-finitos y formatos ambiguos).
const rawCreditResponse = {
  ...BASE_FIELDS,
  balanceDue: -5000,
  balanceCurrency: 'ARS' as const,
  balanceStale: false,
  lastBalanceAt: '2026-08-01T00:00:00.000Z',
};

describe('CONTRACT: GET /api/clients/:id ↔ Customer (TYPE-1)', () => {
  it('el shape real (deudor, con balanceCurrency incluido) typechequea como Customer y renderiza', () => {
    const typed: Customer = rawDebtorResponse;
    render(<InfoTab customer={typed} active={true} />);

    expect(screen.getByText('Deudor')).toBeInTheDocument();
    expect(screen.getByTestId('balance-amount').textContent).toMatch(/65[.,]722/);
  });

  it('balanceDue: null es parte del contrato (cliente sin grClienteId) y renderiza "no disponible"', () => {
    const typed: Customer = rawUnlinkedResponse;
    render(<InfoTab customer={typed} active={true} />);

    expect(screen.getByTestId('balance-unknown')).toBeInTheDocument();
    expect(screen.queryByText('Sin deuda')).not.toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('balanceDue negativo es parte del contrato (saldo a favor) y renderiza el estado credit', () => {
    const typed: Customer = rawCreditResponse;
    render(<InfoTab customer={typed} active={true} />);

    expect(screen.getByTestId('balance-credit')).toBeInTheDocument();
    expect(screen.getByTestId('balance-credit').textContent).toMatch(/5[.,]000/);
  });

  it('los campos muertos (balanceOverdue/invoicesQty) ya NO son asignables a Customer', () => {
    // @ts-expect-error — balanceOverdue fue ELIMINADO del tipo (el BE nunca
    // lo emite, ver domain/entities/customer.ts + toCustomer()). Si alguien
    // lo re-agrega al tipo, esta línea deja de errar y `tsc --noEmit` FALLA
    // por directiva sin usar — es la única forma de testear una AUSENCIA de
    // tipo (lección "probe de ausencia no discrimina": acá SÍ se assertea
    // primero la PRESENCIA de los campos vivos, arriba).
    const withDeadField: Customer = { ...BASE_FIELDS, balanceOverdue: 30000 };
    expect(withDeadField).toBeTruthy();
  });
});
