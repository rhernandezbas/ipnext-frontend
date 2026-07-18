/**
 * MentionPopover (Ola 6 — @menciones en la nota interna) — popover
 * PRESENTACIONAL con la lista de agentes mencionables, anclado sobre el
 * composer. El foco NUNCA sale del textarea (patrón "combobox con listbox y
 * aria-activedescendant"): el teclado (↑↓ Enter Esc) y el filtro se manejan en
 * `Composer`, este componente sólo pinta las opciones y resalta la activa.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MentionPopover } from './MentionPopover';
import type { WhatsappAssignee } from '@/types/whatsapp';

const USERS: WhatsappAssignee[] = [
  { id: 'u-1', name: 'Ana Gómez' },
  { id: 'u-2', name: 'Beto Ruiz' },
];

function renderPopover(over: Partial<Parameters<typeof MentionPopover>[0]> = {}) {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const utils = render(
    <MentionPopover
      users={USERS}
      activeIndex={0}
      listboxId="mention-listbox"
      optionId={(i) => `mention-option-${i}`}
      onSelect={onSelect}
      onHover={onHover}
      {...over}
    />,
  );
  return { ...utils, onSelect, onHover };
}

describe('MentionPopover — estructura y a11y', () => {
  it('renderiza un listbox con una opción por agente', () => {
    renderPopover();
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Ana Gómez', 'Beto Ruiz']);
  });

  it('marca aria-selected SOLO en la opción activa', () => {
    renderPopover({ activeIndex: 1 });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('cada opción lleva el id derivado (para el aria-activedescendant del textarea)', () => {
    renderPopover();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('id', 'mention-option-0');
    expect(options[1]).toHaveAttribute('id', 'mention-option-1');
  });

  it('catálogo filtrado vacío → mensaje "Sin coincidencias", sin opciones', () => {
    renderPopover({ users: [] });
    expect(screen.getByText(/sin coincidencias/i)).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});

describe('MentionPopover — interacción', () => {
  it('elegir una opción (mousedown) dispara onSelect con el agente', async () => {
    const { onSelect } = renderPopover();
    // mousedown (no click): así elige antes de que un click-afuera cierre el popover.
    await userEvent.pointer({ keys: '[MouseLeft>]', target: screen.getByText('Beto Ruiz') });
    expect(onSelect).toHaveBeenCalledWith(USERS[1]);
  });

  it('hover sobre una opción avisa el índice (para sincronizar el activo)', async () => {
    const { onHover } = renderPopover();
    await userEvent.hover(screen.getByText('Beto Ruiz'));
    expect(onHover).toHaveBeenCalledWith(1);
  });
});
