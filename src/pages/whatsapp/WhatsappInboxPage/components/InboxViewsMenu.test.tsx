/**
 * InboxViewsMenu — sub-menú lateral de vistas del inbox estilo Chatwoot
 * (inbox-views Ola 1): Mi bandeja / Sin atender / Todas / Sin asignar /
 * Resueltas, cada una con su contador (badge) del endpoint de counts.
 * Presentacional 100% controlado: `active` + `counts` + `onSelect` — la page
 * (`WhatsappInboxPage`) orquesta `useInboxViewCounts` y el preset de query.
 *
 * a11y: `<nav aria-label>`, `aria-current` en la vista activa, nombre
 * accesible legible con el contador ("Sin atender, 7 conversaciones") — el
 * badge visual es aria-hidden (el número ya vive en el accname del botón).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InboxViewsMenu } from './InboxViewsMenu';
import type { WhatsappInboxViewCounts } from '@/types/whatsapp';

const COUNTS: WhatsappInboxViewCounts = { mine: 4, unattended: 7, all: 23, unassigned: 0, resolved: 118 };

function renderMenu(over: Partial<Parameters<typeof InboxViewsMenu>[0]> = {}) {
  const onSelect = vi.fn();
  const utils = render(<InboxViewsMenu active="all" counts={COUNTS} onSelect={onSelect} {...over} />);
  return { ...utils, onSelect };
}

describe('InboxViewsMenu — estructura y a11y', () => {
  it('renderiza un nav con aria-label "Vistas del inbox"', () => {
    renderMenu();
    expect(screen.getByRole('navigation', { name: 'Vistas del inbox' })).toBeInTheDocument();
  });

  it('renderiza las 5 vistas en orden Chatwoot con su contador en el nombre accesible', () => {
    renderMenu();
    const nav = screen.getByRole('navigation', { name: 'Vistas del inbox' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Mi bandeja, 4 conversaciones',
      'Sin atender, 7 conversaciones',
      'Todas, 23 conversaciones',
      'Sin asignar, 0 conversaciones',
      'Resueltas, 118 conversaciones',
    ]);
  });

  it('marca aria-current="true" SOLO en la vista activa', () => {
    renderMenu({ active: 'unattended' });
    const activeButton = screen.getByRole('button', { name: /sin atender/i });
    expect(activeButton).toHaveAttribute('aria-current', 'true');

    const rest = screen.getAllByRole('button').filter((b) => b !== activeButton);
    expect(rest).toHaveLength(4);
    for (const button of rest) {
      expect(button).not.toHaveAttribute('aria-current');
    }
  });
});

describe('InboxViewsMenu — contadores (badge visual)', () => {
  it('muestra el número de cada vista, INCLUIDO el cero (el cero es información, no dato faltante)', () => {
    renderMenu();
    const unassigned = screen.getByRole('button', { name: 'Sin asignar, 0 conversaciones' });
    expect(within(unassigned).getByText('0')).toBeInTheDocument();
    const mine = screen.getByRole('button', { name: 'Mi bandeja, 4 conversaciones' });
    expect(within(mine).getByText('4')).toBeInTheDocument();
  });

  it('formatea >99 como "99+" en el badge visual, pero el aria-label conserva el número real', () => {
    renderMenu({ counts: { ...COUNTS, resolved: 1437 } });
    const resolved = screen.getByRole('button', { name: 'Resueltas, 1437 conversaciones' });
    expect(within(resolved).getByText('99+')).toBeInTheDocument();
    expect(within(resolved).queryByText('1437')).toBeNull();
  });

  it('sin counts (hook caído / cargando) NO pinta ningún número — el sub-menú degrada, no se rompe', () => {
    renderMenu({ counts: undefined });
    const nav = screen.getByRole('navigation', { name: 'Vistas del inbox' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Mi bandeja',
      'Sin atender',
      'Todas',
      'Sin asignar',
      'Resueltas',
    ]);
    expect(within(nav).queryByText(/^\d+\+?$/)).toBeNull();
  });

  it('el badge visual es aria-hidden (el número ya vive en el accname del botón — no se lee dos veces)', () => {
    renderMenu();
    const mine = screen.getByRole('button', { name: 'Mi bandeja, 4 conversaciones' });
    expect(within(mine).getByText('4')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('InboxViewsMenu — selección', () => {
  it('click en una vista llama a onSelect con su id', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderMenu();

    await user.click(screen.getByRole('button', { name: /sin atender/i }));
    expect(onSelect).toHaveBeenLastCalledWith('unattended');

    await user.click(screen.getByRole('button', { name: /resueltas/i }));
    expect(onSelect).toHaveBeenLastCalledWith('resolved');

    await user.click(screen.getByRole('button', { name: /mi bandeja/i }));
    expect(onSelect).toHaveBeenLastCalledWith('mine');
  });
});
