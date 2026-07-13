/**
 * ComposeModeToggle — segmented radiogroup Reply/Nota (messaging-inbox-notes
 * F1.5 fase D — NOTA PRIVADA, design §3.1). Componente 100% controlado
 * (`mode`+`onChange`), sin estado propio — extraído de `Composer` para ser
 * testeable aislado. Radios NATIVOS (`<input type="radio">`), NO
 * `role="tab"`: un solo textarea compartido, lo que cambia es el MODO de una
 * misma superficie de escritura (design §3.1) — beneficio gratis: navegación
 * por flechas ←/→ nativa del browser, NO se simula acá (jsdom/user-event no
 * emulan de forma confiable el arrow-nav nativo de un radiogroup) — se
 * verifica ESTRUCTURALMENTE que ambos radios comparten `name`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ComposeModeToggle } from './ComposeModeToggle';

describe('ComposeModeToggle — a11y (radiogroup, design §3.1/§10)', () => {
  it('expone role=radiogroup con aria-label "Modo de redacción"', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /modo de redacci[oó]n/i })).toBeInTheDocument();
  });

  it('renderiza 2 radios con nombre accesible "Respuesta" / "Nota interna"', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Respuesta' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Nota interna' })).toBeInTheDocument();
  });

  it('mode="reply" → el radio Respuesta está checked, Nota interna no', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Respuesta' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Nota interna' })).not.toBeChecked();
  });

  it('mode="note" → el radio Nota interna está checked, Respuesta no', () => {
    render(<ComposeModeToggle mode="note" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Nota interna' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Respuesta' })).not.toBeChecked();
  });

  it('ambos radios comparten el mismo name (agrupamiento nativo → arrow-nav gratis del browser)', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    const reply = screen.getByRole('radio', { name: 'Respuesta' }) as HTMLInputElement;
    const note = screen.getByRole('radio', { name: 'Nota interna' }) as HTMLInputElement;
    expect(reply.name).toBe(note.name);
    expect(reply.name).not.toBe('');
  });
});

describe('ComposeModeToggle — interacción (design §3.1)', () => {
  it('clickear el segmento "Nota interna" dispara onChange("note")', async () => {
    const onChange = vi.fn();
    render(<ComposeModeToggle mode="reply" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Nota interna' }));

    expect(onChange).toHaveBeenCalledWith('note');
  });

  it('clickear el segmento "Respuesta" (ya en modo nota) dispara onChange("reply")', async () => {
    const onChange = vi.fn();
    render(<ComposeModeToggle mode="note" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Respuesta' }));

    expect(onChange).toHaveBeenCalledWith('reply');
  });

  it('clickear el segmento YA activo no rompe nada (semántica nativa de <input type=radio>: sin cambio de estado, no dispara change/onChange)', async () => {
    const onChange = vi.fn();
    render(<ComposeModeToggle mode="reply" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Respuesta' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Respuesta' })).toBeChecked();
  });
});

describe('ComposeModeToggle — A11Y-1 (touch target ≥44px, design §3.1)', () => {
  it('cada segmento clickeable aplica la clase de touch target', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    // El <label> es el segmento clickeable real (el radio nativo está sr-only).
    const replyLabel = screen.getByRole('radio', { name: 'Respuesta' }).closest('label');
    const noteLabel = screen.getByRole('radio', { name: 'Nota interna' }).closest('label');
    expect(replyLabel).toHaveClass('segment');
    expect(noteLabel).toHaveClass('segment');
  });
});

describe('ComposeModeToggle — motion (design §7: pill translateX, transition no keyframe)', () => {
  it('el indicador de pill expone data-mode sincronizado con la prop mode', () => {
    const { rerender } = render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    expect(screen.getByTestId('compose-mode-pill')).toHaveAttribute('data-mode', 'reply');

    rerender(<ComposeModeToggle mode="note" onChange={vi.fn()} />);
    expect(screen.getByTestId('compose-mode-pill')).toHaveAttribute('data-mode', 'note');
  });

  it('el pill es aria-hidden (puramente decorativo, el estado real lo llevan los radios)', () => {
    render(<ComposeModeToggle mode="reply" onChange={vi.fn()} />);
    expect(screen.getByTestId('compose-mode-pill')).toHaveAttribute('aria-hidden', 'true');
  });
});
