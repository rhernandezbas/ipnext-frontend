/**
 * PreviousConversationsSection (Ola 6 — conversaciones previas) — sección
 * COLAPSABLE del panel de contexto que lista OTRAS conversaciones del mismo
 * contacto (`GET /conversations/:id/previous`). Fetch-on-expand: solo pide al
 * endpoint cuando el agente la despliega (gate `enabled` de
 * `usePreviousConversations`). 4 ramas: cargando / error / vacío / lista.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { PreviousConversationsSection } from './PreviousConversationsSection';
import type { WhatsappPreviousConversation } from '@/types/whatsapp';

const PREV: WhatsappPreviousConversation[] = [
  {
    id: 'conv-2',
    status: 'resolved',
    lastMessageAt: '2026-07-01T12:00:00.000Z',
    lastMessagePreview: 'gracias por la ayuda',
    assigneeName: 'Ana Gómez',
    unread: false,
    labels: [{ id: 'l-1', name: 'Soporte', color: '#3366cc' }],
  },
  {
    id: 'conv-3',
    status: 'open',
    lastMessageAt: '2026-06-20T09:00:00.000Z',
    lastMessagePreview: 'consulta de facturación',
    assigneeName: null,
    unread: true,
    labels: [],
  },
];

function setPrevious(over: Parameters<typeof mockQuery<WhatsappPreviousConversation[]>>[0] = {}) {
  vi.mocked(useWhatsappModule.usePreviousConversations).mockReturnValue(
    mockQuery<WhatsappPreviousConversation[]>(over) as ReturnType<typeof useWhatsappModule.usePreviousConversations>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setPrevious({ data: [], isLoading: false });
});

describe('PreviousConversationsSection — colapsable + fetch-on-expand', () => {
  it('arranca colapsada: header presente (aria-expanded=false), sin lista, y el hook NO habilitado', () => {
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={vi.fn()} />);
    const header = screen.getByRole('button', { name: /conversaciones previas/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).toBeNull();
    // Fetch-on-expand: se llama con enabled=false hasta desplegar.
    expect(useWhatsappModule.usePreviousConversations).toHaveBeenLastCalledWith('conv-1', false);
  });

  it('al expandir, habilita el hook (enabled=true)', async () => {
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /conversaciones previas/i }));
    expect(useWhatsappModule.usePreviousConversations).toHaveBeenLastCalledWith('conv-1', true);
    expect(screen.getByRole('button', { name: /conversaciones previas/i })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('PreviousConversationsSection — 4 ramas de estado (expandida)', () => {
  async function expand() {
    await userEvent.click(screen.getByRole('button', { name: /conversaciones previas/i }));
  }

  it('cargando → indicador de carga', async () => {
    setPrevious({ data: undefined, isLoading: true });
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={vi.fn()} />);
    await expand();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('error → mensaje + botón reintentar (dispara refetch)', async () => {
    const refetch = vi.fn();
    setPrevious({ data: undefined, isLoading: false, isError: true, refetch });
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={vi.fn()} />);
    await expand();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('vacío → mensaje "no hay otras conversaciones"', async () => {
    setPrevious({ data: [], isLoading: false });
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={vi.fn()} />);
    await expand();
    expect(screen.getByText(/no hay otras conversaciones/i)).toBeInTheDocument();
  });

  it('lista → cada previa con preview, estado y label; navegable', async () => {
    setPrevious({ data: PREV, isLoading: false });
    const onNavigate = vi.fn();
    render(<PreviousConversationsSection conversationId="conv-1" onNavigate={onNavigate} />);
    await expand();

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(2);

    expect(screen.getByText('gracias por la ayuda')).toBeInTheDocument();
    expect(screen.getByText('Resuelta')).toBeInTheDocument();
    expect(screen.getByText('Soporte')).toBeInTheDocument();

    await userEvent.click(screen.getByText('consulta de facturación'));
    expect(onNavigate).toHaveBeenCalledWith('conv-3');
  });
});
