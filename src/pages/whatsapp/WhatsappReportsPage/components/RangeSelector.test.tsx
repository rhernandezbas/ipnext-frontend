import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RangeSelector } from './RangeSelector';
import { presetRange, customRange } from '../lib/range';

const NOW = new Date('2026-07-18T13:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

function renderSel(preset: '7d' | '30d' | 'custom' = '7d', onChange = vi.fn()) {
  render(<RangeSelector preset={preset} onChange={onChange} />);
  return onChange;
}

describe('RangeSelector', () => {
  it('renderiza los presets y marca el activo (7d por defecto)', () => {
    renderSel('7d');
    const btn7 = screen.getByRole('button', { name: /últimos 7 días/i });
    const btn30 = screen.getByRole('button', { name: /últimos 30 días/i });
    expect(btn7).toHaveAttribute('aria-pressed', 'true');
    expect(btn30).toHaveAttribute('aria-pressed', 'false');
  });

  it('clic en "Últimos 30 días" emite preset 30d con el rango correcto', () => {
    const onChange = renderSel('7d');
    fireEvent.click(screen.getByRole('button', { name: /últimos 30 días/i }));
    expect(onChange).toHaveBeenCalledWith('30d', presetRange('30d', NOW));
  });

  it('clic en "Últimos 7 días" emite preset 7d con el rango correcto', () => {
    const onChange = renderSel('30d');
    fireEvent.click(screen.getByRole('button', { name: /últimos 7 días/i }));
    expect(onChange).toHaveBeenCalledWith('7d', presetRange('7d', NOW));
  });

  it('modo Personalizado: al completar ambas fechas emite customRange', () => {
    const onChange = renderSel('7d');
    fireEvent.click(screen.getByRole('button', { name: /personalizado/i }));

    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-07-07' } });

    expect(onChange).toHaveBeenLastCalledWith('custom', customRange('2026-07-01', '2026-07-07'));
  });

  it('modo Personalizado: NO emite si el rango es inválido (desde > hasta)', () => {
    const onChange = renderSel('7d');
    fireEvent.click(screen.getByRole('button', { name: /personalizado/i }));
    onChange.mockClear();

    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '2026-07-10' } });
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '2026-07-01' } });

    // custom con from>to no debe emitir un rango inválido
    const customCalls = onChange.mock.calls.filter((c) => c[0] === 'custom');
    expect(customCalls).toHaveLength(0);
  });
});
