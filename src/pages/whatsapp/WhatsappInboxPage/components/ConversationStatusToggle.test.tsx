/**
 * ConversationStatusToggle — Resolver/Reabrir del thread abierto
 * (messaging-inbox-productivity F1.5-C v1). Presentacional puro: recibe
 * `status`/`onToggle`/`isPending` — `MessageThread` lo monta en el header,
 * `WhatsappInboxPage` orquesta la mutation (`useSetConversationStatus`),
 * mismo criterio que `onBack`/`Composer` (contract con la page). v1 SOLO
 * alterna open↔resolved (`pending` se trata como "no resuelta" — el próximo
 * paso siempre es 'resolved', ver `conversationStatus.ts`).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationStatusToggle } from './ConversationStatusToggle';

describe('ConversationStatusToggle — label según status', () => {
  it('status "open" → botón "Resolver", badge "Abierta"', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /resolver/i })).toBeInTheDocument();
    expect(screen.getByText('Abierta')).toBeInTheDocument();
  });

  it('status "resolved" → botón "Reabrir", badge "Resuelta"', () => {
    render(<ConversationStatusToggle status="resolved" onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reabrir/i })).toBeInTheDocument();
    expect(screen.getByText('Resuelta')).toBeInTheDocument();
  });

  it('status "pending" → se trata como "no resuelta": botón "Resolver" (v1 no expone un 3er estado en la UI)', () => {
    render(<ConversationStatusToggle status="pending" onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /resolver/i })).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('status null (detalle aún no cargó) → no renderiza nada', () => {
    const { container } = render(<ConversationStatusToggle status={null} onToggle={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('un status desconocido no rompe el render (fallback al texto crudo, mismo criterio que ConversationListItem)', () => {
    render(<ConversationStatusToggle status="weird_status" onToggle={vi.fn()} />);
    expect(screen.getByText('weird_status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolver/i })).toBeInTheDocument();
  });
});

describe('ConversationStatusToggle — interacción', () => {
  it('click en "Resolver" dispara onToggle("resolved")', async () => {
    const onToggle = vi.fn();
    render(<ConversationStatusToggle status="open" onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /resolver/i }));
    expect(onToggle).toHaveBeenCalledWith('resolved');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('click en "Reabrir" dispara onToggle("open")', async () => {
    const onToggle = vi.fn();
    render(<ConversationStatusToggle status="resolved" onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /reabrir/i }));
    expect(onToggle).toHaveBeenCalledWith('open');
  });
});

describe('ConversationStatusToggle — loading state (isPending)', () => {
  it('mientras isPending, el botón está deshabilitado y muestra el spinner de carga', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} isPending />);
    const button = screen.getByRole('button', { name: /resolver/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('sin isPending (default), el botón está habilitado y NO muestra spinner', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /resolver/i })).not.toBeDisabled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un click mientras isPending no dispara onToggle (el botón está disabled)', async () => {
    const onToggle = vi.fn();
    render(<ConversationStatusToggle status="open" onToggle={onToggle} isPending />);
    await userEvent.click(screen.getByRole('button', { name: /resolver/i }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('ConversationStatusToggle — A11Y', () => {
  it('el botón conserva un nombre accesible completo ("Resolver conversación") aunque el label visible cambie', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/resolver conversaci.n/i);
  });

  it('conserva el nombre accesible incluso en loading (el spinner reemplaza el children visible, no el aria-label)', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} isPending />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/resolver conversaci.n/i);
  });

  it('es alcanzable por teclado (Tab) sin ARIA extra', () => {
    render(<ConversationStatusToggle status="open" onToggle={vi.fn()} />);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });

  it('aclara (sutil, sr-only) que resolver/reabrir NO reabre la ventana de 24h de WhatsApp', () => {
    render(<ConversationStatusToggle status="resolved" onToggle={vi.fn()} />);
    expect(screen.getByText(/ventana de 24 horas/i)).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-describedby');
  });
});
