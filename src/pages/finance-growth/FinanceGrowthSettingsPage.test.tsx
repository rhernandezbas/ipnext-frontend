import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

vi.mock('./settings/TechnologyCostsBody', () => ({ TechnologyCostsBody: () => <div>BODY_TECH_COSTS</div> }));
vi.mock('./settings/PlanPricesBody', () => ({ PlanPricesBody: () => <div>BODY_PLAN_PRICES</div> }));
vi.mock('./settings/TargetsBody', () => ({ TargetsBody: () => <div>BODY_TARGETS</div> }));
vi.mock('./settings/InflationBody', () => ({ InflationBody: () => <div>BODY_INFLATION</div> }));
vi.mock('./settings/InvoiceTypesBody', () => ({ InvoiceTypesBody: () => <div>BODY_INVOICE_TYPES</div> }));

import FinanceGrowthSettingsPage from './FinanceGrowthSettingsPage';

afterEach(() => {
  window.location.hash = '';
});

describe('FinanceGrowthSettingsPage', () => {
  it('monta las 5 sub-secciones como tabs y arranca en costos por tecnología', () => {
    render(<FinanceGrowthSettingsPage />);
    expect(screen.getByText('BODY_TECH_COSTS')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /precios por plan/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /metas/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ipc/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /tipos de comprobante/i })).toBeInTheDocument();
  });

  it('cambia de tab al hacer click', () => {
    render(<FinanceGrowthSettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /precios por plan/i }));
    expect(screen.getByText('BODY_PLAN_PRICES')).toBeInTheDocument();
  });
});
