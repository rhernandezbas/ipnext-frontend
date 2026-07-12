/**
 * ConversationList — panel de la lista de conversaciones (messaging-inbox F1,
 * design §1/§2, tasks FB3 3.1/3.2). LIST-1 completo: skeleton / orden desc
 * `lastMessageAt` / empty / error / polling sin perder selección. Presentacional
 * (recibe `conversations`/`isLoading`/`isError`/`selectedId`/`onSelect` como
 * props — el fetch real vive en `WhatsappInboxPage`, FB4, vía
 * `useWhatsappConversations`); dueño SOLO del filtro de búsqueda local (UI
 * state, no hay `search` en el contrato del BE — design §3).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationList } from './ConversationList';
import type { WhatsappConversationListItem } from '@/types/whatsapp';

const mk = (over: Partial<WhatsappConversationListItem> = {}): WhatsappConversationListItem => ({
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491122334455',
  lastMessageAt: '2026-07-11T18:00:00.000Z',
  preview: 'Hola, ¿cómo va el reclamo?',
  status: 'open',
  ...over,
});

describe('ConversationList — LIST-1 (loading/empty/error)', () => {
  it('loading muestra skeleton, no lista ni error', () => {
    render(<ConversationList conversations={[]} isLoading selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('presentation').length).toBeGreaterThan(0);
  });

  it('empty state cuando la respuesta trae 0 conversaciones', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/no hay conversaciones/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('error state sin crashear la page', () => {
    render(<ConversationList conversations={[]} isLoading={false} isError selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });
});

describe('ConversationList — LIST-1 (orden + render)', () => {
  it('ordena por lastMessageAt desc sin importar el orden de entrada', () => {
    const convs = [
      mk({ id: 'a', contactName: 'Ana', lastMessageAt: '2026-07-11T10:00:00.000Z' }),
      mk({ id: 'b', contactName: 'Beto', lastMessageAt: '2026-07-11T12:00:00.000Z' }),
      mk({ id: 'c', contactName: 'Caro', lastMessageAt: '2026-07-11T11:00:00.000Z' }),
    ];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const names = buttons.map((b) => within(b).getByText(/^(Ana|Beto|Caro)$/).textContent);
    expect(names).toEqual(['Beto', 'Caro', 'Ana']);
  });

  it('conversaciones sin lastMessageAt quedan al final', () => {
    const convs = [
      mk({ id: 'a', contactName: 'Ana', lastMessageAt: null }),
      mk({ id: 'b', contactName: 'Beto', lastMessageAt: '2026-07-11T12:00:00.000Z' }),
    ];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    const names = screen.getAllByRole('button').map((b) => within(b).getByText(/^(Ana|Beto)$/).textContent);
    expect(names).toEqual(['Beto', 'Ana']);
  });

  it('dispara onSelect con el id de la conversación clickeada', async () => {
    const onSelect = vi.fn();
    render(<ConversationList conversations={[mk()]} isLoading={false} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Juan Perez/ }));
    expect(onSelect).toHaveBeenCalledWith('conv-1');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marca seleccionado el item cuyo id === selectedId', () => {
    render(
      <ConversationList
        conversations={[mk({ id: 'conv-1' }), mk({ id: 'conv-2', contactName: 'Otro Contacto' })]}
        isLoading={false}
        selectedId="conv-2"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Otro Contacto/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Juan Perez/ })).not.toHaveAttribute('aria-current');
  });
});

describe('ConversationList — LIST-1 (polling sin perder selección)', () => {
  it('re-render con conversaciones actualizadas mantiene la selección activa', () => {
    const { rerender } = render(
      <ConversationList conversations={[mk({ id: 'conv-1' })]} isLoading={false} selectedId="conv-1" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Juan Perez/ })).toHaveAttribute('aria-current', 'true');

    rerender(
      <ConversationList
        conversations={[mk({ id: 'conv-1', preview: 'Nuevo mensaje llegó' })]}
        isLoading={false}
        selectedId="conv-1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Juan Perez/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Nuevo mensaje llegó')).toBeInTheDocument();
  });
});

describe('ConversationList — búsqueda (client-side)', () => {
  it('filtra por nombre/teléfono/preview', async () => {
    const convs = [
      mk({ id: 'a', contactName: 'Ana Lopez', contactPhone: '+5491111111111', preview: 'Consulta de saldo' }),
      mk({ id: 'b', contactName: 'Beto Diaz', contactPhone: '+5493333333333', preview: 'Otro tema' }),
    ];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} />);

    await userEvent.type(screen.getByRole('searchbox'), 'Beto');
    expect(screen.queryByText('Ana Lopez')).toBeNull();
    expect(screen.getByText('Beto Diaz')).toBeInTheDocument();
  });

  it('sin resultados de búsqueda, muestra un mensaje (no una lista vacía muda)', async () => {
    render(<ConversationList conversations={[mk()]} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz-no-existe');
    expect(screen.queryByText('Juan Perez')).toBeNull();
    expect(screen.getByText(/no se encontraron conversaciones/i)).toBeInTheDocument();
  });
});
