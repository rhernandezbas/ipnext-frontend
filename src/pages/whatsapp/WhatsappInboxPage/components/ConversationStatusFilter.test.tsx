/**
 * ConversationStatusFilter — segmented radiogroup Abiertas/Resueltas
 * (inbox-resolve, design.md D5, TAB-1). Clon estructural de
 * `ConversationAssignmentFilter` (misma carpeta): radios NATIVOS
 * (`<input type="radio">`), NO `role="tab"` — lo que cambia es el FILTRO
 * server-side de la MISMA lista (bucket abierto/resuelto), no un panel de
 * contenido distinto. 2 segmentos (vs. 3 de assignment) — mismo molde de
 * pill que `ComposeModeToggle` (50% de ancho, translateX(100%)).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationStatusFilter } from './ConversationStatusFilter';

describe('ConversationStatusFilter — a11y (radiogroup)', () => {
  it('expone role=radiogroup con un nombre accesible', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /estado/i })).toBeInTheDocument();
  });

  it('renderiza 2 radios con nombre accesible "Abiertas" / "Resueltas"', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Abiertas' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Resueltas' })).toBeInTheDocument();
  });

  it('value="open" → el radio Abiertas está checked, Resueltas no', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Abiertas' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Resueltas' })).not.toBeChecked();
  });

  it('value="resolved" → el radio Resueltas está checked', () => {
    render(<ConversationStatusFilter value="resolved" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Resueltas' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Abiertas' })).not.toBeChecked();
  });

  it('los 2 radios comparten el mismo name (agrupamiento nativo → arrow-nav gratis del browser)', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    const open = screen.getByRole('radio', { name: 'Abiertas' }) as HTMLInputElement;
    const resolved = screen.getByRole('radio', { name: 'Resueltas' }) as HTMLInputElement;
    expect(open.name).toBe(resolved.name);
    expect(open.name).not.toBe('');
  });
});

describe('ConversationStatusFilter — interacción', () => {
  it('clickear "Resueltas" dispara onChange("resolved")', async () => {
    const onChange = vi.fn();
    render(<ConversationStatusFilter value="open" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Resueltas' }));

    expect(onChange).toHaveBeenCalledWith('resolved');
  });

  it('clickear "Abiertas" (volviendo de "resolved") dispara onChange("open")', async () => {
    const onChange = vi.fn();
    render(<ConversationStatusFilter value="resolved" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Abiertas' }));

    expect(onChange).toHaveBeenCalledWith('open');
  });

  it('clickear el segmento YA activo no dispara onChange (semántica nativa de radio)', async () => {
    const onChange = vi.fn();
    render(<ConversationStatusFilter value="open" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Abiertas' }));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ConversationStatusFilter — A11Y-1 (touch target ≥44px)', () => {
  it('cada segmento clickeable aplica la clase de touch target', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    const label = screen.getByRole('radio', { name: 'Abiertas' }).closest('label');
    expect(label).toHaveClass('segment');
  });
});

describe('ConversationStatusFilter — motion (pill translateX, transition no keyframe)', () => {
  it('el indicador de pill expone data-status sincronizado con la prop value', () => {
    const { rerender } = render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    expect(screen.getByTestId('status-filter-pill')).toHaveAttribute('data-status', 'open');

    rerender(<ConversationStatusFilter value="resolved" onChange={vi.fn()} />);
    expect(screen.getByTestId('status-filter-pill')).toHaveAttribute('data-status', 'resolved');
  });

  it('el pill es aria-hidden (puramente decorativo, el estado real lo llevan los radios)', () => {
    render(<ConversationStatusFilter value="open" onChange={vi.fn()} />);
    expect(screen.getByTestId('status-filter-pill')).toHaveAttribute('aria-hidden', 'true');
  });
});
