/**
 * SegmentBuilder — composer del Bulk Messaging (F2 apply chunk 2, SEG-1).
 * Checkboxes de ClientStatus (active/late/blocked/inactive/baja) + inputs de
 * deuda min/max. Controlado 100% (`value`+`onChange`).
 *
 *  SB-1 renderiza los 5 checkboxes de estado, con label asociado
 *  SB-2 tildar un estado agrega el status al array (onChange)
 *  SB-3 destildar un estado lo saca del array
 *  SB-4 tipear en "Deuda mínima"/"Deuda máxima" llama a onChange con el número
 *  SB-5 vaciar un input numérico vuelve `undefined` (no NaN)
 *  SB-6 sin ningún criterio → nota visible (role=status)
 *  SB-7 con al menos un criterio → sin nota
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SegmentBuilder } from '@/pages/whatsapp/BulkMessagingPage/components/composer/SegmentBuilder';
import type { CampaignSegment } from '@/types/messagingBulk';

const EMPTY: CampaignSegment = { statuses: [] };

describe('SB-1: checkboxes de estado', () => {
  it('renderiza los 5 estados con label asociado', () => {
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /^activo$/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /bloqueado/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^inactivo$/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /bajas/i })).toBeInTheDocument();
  });
});

describe('SB-2/SB-3: tildar/destildar', () => {
  it('tildar "Atrasado" agrega "late" al array de statuses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentBuilder value={EMPTY} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));

    expect(onChange).toHaveBeenCalledWith({ statuses: ['late'] });
  });

  it('destildar un estado ya tildado lo saca del array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentBuilder value={{ statuses: ['late', 'blocked'] }} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));

    expect(onChange).toHaveBeenCalledWith({ statuses: ['blocked'] });
  });
});

describe('SB-4: inputs numéricos de deuda', () => {
  it('tipear en "Deuda mínima" llama a onChange con el número', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder value={EMPTY} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/deuda mínima/i), { target: { value: '1000' } });

    expect(onChange).toHaveBeenCalledWith({ statuses: [], balanceMin: 1000 });
  });

  it('tipear en "Deuda máxima" llama a onChange con el número', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder value={EMPTY} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/deuda máxima/i), { target: { value: '5000' } });

    expect(onChange).toHaveBeenCalledWith({ statuses: [], balanceMax: 5000 });
  });
});

describe('SB-5: vaciar un input numérico', () => {
  it('vaciar "Deuda mínima" vuelve `undefined` (no NaN)', () => {
    const onChange = vi.fn();
    render(<SegmentBuilder value={{ statuses: [], balanceMin: 1000 }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/deuda mínima/i), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ statuses: [], balanceMin: undefined });
  });
});

describe('SB-6/SB-7: nota de "al menos un criterio"', () => {
  it('sin ningún criterio muestra la nota', () => {
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/al menos un estado/i);
  });

  it('con un estado tildado, NO muestra la nota', () => {
    render(<SegmentBuilder value={{ statuses: ['late'] }} onChange={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con balanceMin > 0, NO muestra la nota', () => {
    render(<SegmentBuilder value={{ statuses: [], balanceMin: 1500 }} onChange={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // FIX-1: un floor de $0 (o negativo) NO cuenta como criterio (el BE lo
  // rechaza con UNFILTERED_SEGMENT). El builder debe avisar EXPLÍCITAMENTE que
  // $0 no filtra, en vez de dejar creer que sí hay criterio → dead-end 400.
  it('con balanceMin=0 muestra la nota avisando que $0 no cuenta como criterio', () => {
    render(<SegmentBuilder value={{ statuses: [], balanceMin: 0 }} onChange={vi.fn()} />);
    const note = screen.getByRole('status');
    expect(note).toBeInTheDocument();
    expect(note).toHaveTextContent(/0|mayor a 0/i);
  });

  it('con balanceMax negativo muestra la nota (no cuenta como criterio)', () => {
    render(<SegmentBuilder value={{ statuses: [], balanceMax: -50 }} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
