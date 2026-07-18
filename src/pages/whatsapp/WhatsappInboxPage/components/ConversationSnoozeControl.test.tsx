/**
 * ConversationSnoozeControl (Ola 6 — snooze) — acción "Posponer" con un
 * mini-selector de duración en el header del thread, junto a Resolver/Reabrir.
 * Cuando la conversación está pospuesta muestra "Pospuesta hasta {fecha}" +
 * "Reactivar". Presentacional: recibe `snoozedUntil`/`onSnooze`/`onReactivate`
 * — `WhatsappInboxPage` orquesta la mutation (`useSnoozeConversation`) y decide
 * qué hace "Reactivar" (reabrir: no hay endpoint de des-posponer).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationSnoozeControl } from './ConversationSnoozeControl';

const future = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
const past = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('ConversationSnoozeControl — no pospuesta', () => {
  it('muestra el botón "Posponer" (aria-haspopup menu) y no el estado pospuesto', () => {
    render(<ConversationSnoozeControl snoozedUntil={null} onSnooze={vi.fn()} onReactivate={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /posponer/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/pospuesta hasta/i)).toBeNull();
  });

  it('un snoozedUntil en el PASADO (snooze vencido) se trata como no pospuesta', () => {
    render(<ConversationSnoozeControl snoozedUntil={past()} onSnooze={vi.fn()} onReactivate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /posponer/i })).toBeInTheDocument();
    expect(screen.queryByText(/pospuesta hasta/i)).toBeNull();
  });

  it('abrir el selector muestra las 4 duraciones', async () => {
    render(<ConversationSnoozeControl snoozedUntil={null} onSnooze={vi.fn()} onReactivate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /posponer/i }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /posponer/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('elegir una duración dispara onSnooze con un ISO FUTURO y cierra el menú', async () => {
    const onSnooze = vi.fn();
    render(<ConversationSnoozeControl snoozedUntil={null} onSnooze={onSnooze} onReactivate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /posponer/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /1 hora/i }));

    expect(onSnooze).toHaveBeenCalledTimes(1);
    const iso = onSnooze.mock.calls[0][0] as string;
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape cierra el menú sin posponer', async () => {
    const onSnooze = vi.fn();
    render(<ConversationSnoozeControl snoozedUntil={null} onSnooze={onSnooze} onReactivate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /posponer/i }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(onSnooze).not.toHaveBeenCalled();
  });

  it('mientras isPending, "Posponer" está deshabilitado', () => {
    render(<ConversationSnoozeControl snoozedUntil={null} onSnooze={vi.fn()} onReactivate={vi.fn()} isPending />);
    expect(screen.getByRole('button', { name: /posponer/i })).toBeDisabled();
  });
});

describe('ConversationSnoozeControl — pospuesta', () => {
  it('muestra "Pospuesta hasta {fecha}" y el botón "Reactivar"', () => {
    render(<ConversationSnoozeControl snoozedUntil={future()} onSnooze={vi.fn()} onReactivate={vi.fn()} />);
    expect(screen.getByText(/pospuesta hasta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reactivar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /posponer/i })).toBeNull();
  });

  it('click en "Reactivar" dispara onReactivate', async () => {
    const onReactivate = vi.fn();
    render(<ConversationSnoozeControl snoozedUntil={future()} onSnooze={vi.fn()} onReactivate={onReactivate} />);
    await userEvent.click(screen.getByRole('button', { name: /reactivar/i }));
    expect(onReactivate).toHaveBeenCalledTimes(1);
  });
});
