import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ServiceSection } from './ServiceSection';
import type { WhatsappInboxContract } from '@/types/whatsapp';

describe('ServiceSection (messaging-inbox-v2 F1.5, design §5.3)', () => {
  it('sin contratos muestra "Sin contratos activos"', () => {
    render(<ServiceSection contracts={[]} />);
    expect(screen.getByText(/sin contratos activos/i)).toBeInTheDocument();
  });

  it('renderiza plan + tecnología + dirección por contrato', () => {
    const contracts: WhatsappInboxContract[] = [
      { id: 'c1', plan: 'Fibra 100M', status: 'active', technology: 'FTTH', address: 'Av. Siempre Viva 742', serviceStatus: 'active' },
    ];
    render(<ServiceSection contracts={contracts} />);

    expect(screen.getByText('Fibra 100M')).toBeInTheDocument();
    expect(screen.getByText('FTTH')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('serviceStatus "reduced" reusa la variante naranja "blocked" con label "Reducido"', () => {
    const contracts: WhatsappInboxContract[] = [
      { id: 'c1', plan: 'Fibra 50M', status: 'active', technology: null, address: null, serviceStatus: 'reduced' },
    ];
    render(<ServiceSection contracts={contracts} />);
    expect(screen.getByText('Reducido')).toBeInTheDocument();
  });

  it('serviceStatus null NO renderiza ningún pill de estado', () => {
    const contracts: WhatsappInboxContract[] = [
      { id: 'c1', plan: 'Fibra 50M', status: 'active', technology: null, address: null, serviceStatus: null },
    ];
    render(<ServiceSection contracts={contracts} />);
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByText('Cortado')).not.toBeInTheDocument();
  });

  it('múltiples contratos renderizan cada uno', () => {
    const contracts: WhatsappInboxContract[] = [
      { id: 'c1', plan: 'Fibra 100M', status: 'active', technology: null, address: null, serviceStatus: 'active' },
      { id: 'c2', plan: 'Fibra 50M', status: 'baja', technology: null, address: null, serviceStatus: 'baja' },
    ];
    render(<ServiceSection contracts={contracts} />);
    expect(screen.getByText('Fibra 100M')).toBeInTheDocument();
    expect(screen.getByText('Fibra 50M')).toBeInTheDocument();
  });

  it('bug BAJO (review adversarial): contracts undefined (BE degradado) NO rompe — guard defensivo, cae al empty state', () => {
    render(<ServiceSection contracts={undefined as unknown as WhatsappInboxContract[]} />);
    expect(screen.getByText(/sin contratos activos/i)).toBeInTheDocument();
  });
});
