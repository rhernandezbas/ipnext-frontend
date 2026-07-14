/**
 * ConfirmModal — molécula COMPARTIDA (usada en ~10 flujos). Fix wave FIX-2:
 * focus-trap + restauración de foco (el modal dispara acciones irreversibles,
 * ej. el envío de una campaña). También cubre el contrato ya existente que NO
 * debe romperse (Esc → cancel, foco inicial).
 *
 *  CM-1 foco inicial en Confirmar (tono default)
 *  CM-2 focus TRAP: Tab desde el último focusable vuelve al primero
 *  CM-3 focus TRAP: Shift+Tab desde el primero salta al último
 *  CM-4 restauración: al cerrar, el foco vuelve al elemento que lo abrió
 *  CM-5 Esc sigue cancelando (regresión)
 */
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';

function OpenableModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir modal
      </button>
      <ConfirmModal
        open={open}
        title="Confirmar acción"
        message="¿Seguro?"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe('CM-1: foco inicial', () => {
  it('en tono default el foco inicial va al botón Confirmar', () => {
    render(<ConfirmModal open title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /confirmar/i })).toHaveFocus();
  });
});

describe('CM-2/CM-3: focus trap', () => {
  it('Tab desde el último focusable (Confirmar) vuelve al primero (Cancelar)', async () => {
    const user = userEvent.setup();
    render(<ConfirmModal open title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: /confirmar/i });
    const cancel = screen.getByRole('button', { name: /cancelar/i });
    confirm.focus();

    await user.tab();

    expect(cancel).toHaveFocus();
  });

  it('Shift+Tab desde el primer focusable (Cancelar) salta al último (Confirmar)', async () => {
    const user = userEvent.setup();
    render(<ConfirmModal open title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: /confirmar/i });
    const cancel = screen.getByRole('button', { name: /cancelar/i });
    cancel.focus();

    await user.tab({ shift: true });

    expect(confirm).toHaveFocus();
  });
});

describe('CM-4: restauración de foco', () => {
  it('al cerrar, el foco vuelve al elemento que abrió el modal', async () => {
    const user = userEvent.setup();
    render(<OpenableModal />);

    const trigger = screen.getByRole('button', { name: /abrir modal/i });
    await user.click(trigger);
    // el modal está abierto y el foco se movió adentro
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('CM-5: Esc cancela (regresión)', () => {
  it('Escape llama a onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmModal open title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalled();
  });
});
