import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MaybeValue } from './MaybeValue';

describe('MaybeValue', () => {
  it('renders the formatted value when value is a number, including a genuine zero', () => {
    render(<MaybeValue value={0} format={(v) => `${v}%`} label="churn de ingresos" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders an em-dash with an explanatory title, never "0", when value is null', () => {
    render(<MaybeValue value={null} format={(v) => `${v}%`} label="churn de ingresos" unknownReason="sin base para comparar" />);
    const el = screen.getByText('—');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('title', expect.stringContaining('sin base para comparar'));
    // Nunca debe existir un "0%" en el DOM cuando el valor real es null.
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('exposes the unknown reason to assistive tech via aria-label, not color alone', () => {
    render(<MaybeValue value={null} format={(v) => `${v}%`} label="tasa de cobranza" unknownReason="no hay MRR contratado" />);
    expect(screen.getByLabelText(/tasa de cobranza: dato no disponible \(no hay mrr contratado\)/i)).toBeInTheDocument();
  });
});
