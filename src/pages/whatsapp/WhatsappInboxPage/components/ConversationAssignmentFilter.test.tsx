/**
 * ConversationAssignmentFilter — segmented radiogroup Todas/Mías/Sin asignar
 * (messaging-inbox-assignment F1.5-C2 — ASIGNACIÓN). Componente 100%
 * controlado (`value`+`onChange`), sin estado propio — MISMO patrón que
 * `ComposeModeToggle` (misma carpeta): radios NATIVOS (`<input type="radio">`),
 * NO `role="tab"` — lo que cambia es el FILTRO de la MISMA lista (no un panel
 * de contenido distinto por segmento), exactamente lo que modela un
 * radiogroup. Beneficio gratis: navegación por flechas nativa del browser.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationAssignmentFilter } from './ConversationAssignmentFilter';

describe('ConversationAssignmentFilter — a11y (radiogroup)', () => {
  it('expone role=radiogroup con un nombre accesible', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /asignaci[oó]n/i })).toBeInTheDocument();
  });

  it('renderiza 3 radios con nombre accesible "Todas" / "Mías" / "Sin asignar"', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mías' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sin asignar' })).toBeInTheDocument();
  });

  it('value="all" → el radio Todas está checked, los demás no', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mías' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sin asignar' })).not.toBeChecked();
  });

  it('value="mine" → el radio Mías está checked', () => {
    render(<ConversationAssignmentFilter value="mine" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Mías' })).toBeChecked();
  });

  it('value="unassigned" → el radio Sin asignar está checked', () => {
    render(<ConversationAssignmentFilter value="unassigned" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Sin asignar' })).toBeChecked();
  });

  it('los 3 radios comparten el mismo name (agrupamiento nativo → arrow-nav gratis del browser)', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    const all = screen.getByRole('radio', { name: 'Todas' }) as HTMLInputElement;
    const mine = screen.getByRole('radio', { name: 'Mías' }) as HTMLInputElement;
    const unassigned = screen.getByRole('radio', { name: 'Sin asignar' }) as HTMLInputElement;
    expect(all.name).toBe(mine.name);
    expect(mine.name).toBe(unassigned.name);
    expect(all.name).not.toBe('');
  });
});

describe('ConversationAssignmentFilter — interacción', () => {
  it('clickear "Mías" dispara onChange("mine")', async () => {
    const onChange = vi.fn();
    render(<ConversationAssignmentFilter value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Mías' }));

    expect(onChange).toHaveBeenCalledWith('mine');
  });

  it('clickear "Sin asignar" dispara onChange("unassigned")', async () => {
    const onChange = vi.fn();
    render(<ConversationAssignmentFilter value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Sin asignar' }));

    expect(onChange).toHaveBeenCalledWith('unassigned');
  });

  it('clickear "Todas" (volviendo de "mine") dispara onChange("all")', async () => {
    const onChange = vi.fn();
    render(<ConversationAssignmentFilter value="mine" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Todas' }));

    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('clickear el segmento YA activo no rompe nada (semántica nativa de radio: sin cambio de estado, no dispara onChange)', async () => {
    const onChange = vi.fn();
    render(<ConversationAssignmentFilter value="all" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Todas' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeChecked();
  });
});

describe('ConversationAssignmentFilter — A11Y-1 (touch target ≥44px)', () => {
  it('cada segmento clickeable aplica la clase de touch target', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    const label = screen.getByRole('radio', { name: 'Todas' }).closest('label');
    expect(label).toHaveClass('segment');
  });
});

describe('ConversationAssignmentFilter — motion (pill translateX, transition no keyframe)', () => {
  it('el indicador de pill expone data-assignment sincronizado con la prop value', () => {
    const { rerender } = render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    expect(screen.getByTestId('assignment-filter-pill')).toHaveAttribute('data-assignment', 'all');

    rerender(<ConversationAssignmentFilter value="unassigned" onChange={vi.fn()} />);
    expect(screen.getByTestId('assignment-filter-pill')).toHaveAttribute('data-assignment', 'unassigned');
  });

  it('el pill es aria-hidden (puramente decorativo, el estado real lo llevan los radios)', () => {
    render(<ConversationAssignmentFilter value="all" onChange={vi.fn()} />);
    expect(screen.getByTestId('assignment-filter-pill')).toHaveAttribute('aria-hidden', 'true');
  });
});
