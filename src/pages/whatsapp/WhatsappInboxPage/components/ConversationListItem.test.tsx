/**
 * ConversationListItem — fila de la lista de conversaciones (messaging-inbox
 * F1, design §1/§7, tasks FB2 2.1/2.2/2.5). LIST-1 escenario "preview+contacto+
 * estado" (enmendado): el badge de fila usa `status` (`open`/`resolved`/
 * `pending`), NUNCA `unreadCount`/ventana 24h (esos campos no existen en
 * `ConversationListItemDto`).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ConversationListItem } from './ConversationListItem';
import type { WhatsappConversationListItem } from '@/types/whatsapp';

const conv = (over: Partial<WhatsappConversationListItem> = {}): WhatsappConversationListItem => ({
  id: 'conv-1',
  contactName: 'Juan Perez',
  contactPhone: '+5491122334455',
  lastMessageAt: '2026-07-11T18:30:00.000Z',
  preview: 'Hola, ¿cómo va el reclamo?',
  status: 'open',
  ...over,
});

describe('ConversationListItem — LIST-1 (preview+contacto+estado)', () => {
  it('muestra nombre de contacto, preview y hora del último mensaje', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('Hola, ¿cómo va el reclamo?')).toBeInTheDocument();
    // 18:30 UTC → 15:30 ART (America/Argentina/Buenos_Aires, UTC-3)
    expect(screen.getByText('15:30')).toBeInTheDocument();
  });

  it('muestra un badge de status "open" con label "Abierta" (NO ventana 24h)', () => {
    render(<ConversationListItem conversation={conv({ status: 'open' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Abierta')).toBeInTheDocument();
    expect(screen.queryByText(/24h|24 horas/i)).toBeNull();
  });

  it('mapea status "pending" a label "Pendiente"', () => {
    render(<ConversationListItem conversation={conv({ status: 'pending' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('mapea status "resolved" a label "Resuelta"', () => {
    render(<ConversationListItem conversation={conv({ status: 'resolved' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Resuelta')).toBeInTheDocument();
  });

  it('un status desconocido no rompe el render (fallback al texto crudo)', () => {
    render(<ConversationListItem conversation={conv({ status: 'weird_status' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('weird_status')).toBeInTheDocument();
  });

  it('sin contactName, usa contactPhone como nombre visible', () => {
    render(<ConversationListItem conversation={conv({ contactName: null })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('+5491122334455')).toBeInTheDocument();
  });

  it('sin preview, muestra un placeholder ("Sin mensajes")', () => {
    render(<ConversationListItem conversation={conv({ preview: null })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Sin mensajes')).toBeInTheDocument();
  });

  it('con preview vacío (string ""), muestra el placeholder ("Sin mensajes")', () => {
    render(<ConversationListItem conversation={conv({ preview: '' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Sin mensajes')).toBeInTheDocument();
  });

  // F1.5 polish (chat-media-download): el BE ahora manda un preview textual
  // ("📷 Imagen", "🎥 Video", etc.) para mensajes solo-media, en vez de vacío.
  // El FE debe mostrar ESE texto tal cual — "Sin mensajes" queda SOLO como
  // fallback cuando el preview de verdad está vacío/null.
  it('con preview de solo-media del BE ("📷 Imagen"), lo muestra tal cual (NO "Sin mensajes")', () => {
    render(<ConversationListItem conversation={conv({ preview: '📷 Imagen' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('📷 Imagen')).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
  });

  it('con preview de solo-media del BE ("🎥 Video"), lo muestra tal cual (NO "Sin mensajes")', () => {
    render(<ConversationListItem conversation={conv({ preview: '🎥 Video' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('🎥 Video')).toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
  });

  it('sin lastMessageAt, muestra "—" en vez de una hora inválida', () => {
    render(<ConversationListItem conversation={conv({ lastMessageAt: null })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renderiza el avatar con las iniciales del contacto', () => {
    render(<ConversationListItem conversation={conv({ contactName: 'Juan Perez' })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('JP')).toBeInTheDocument();
  });
});

describe('ConversationListItem — selección (design §7: background-color, sin transform)', () => {
  it('marca el item seleccionado con aria-current', () => {
    render(<ConversationListItem conversation={conv()} selected onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true');
  });

  it('NO setea aria-current cuando no está seleccionado', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current');
  });

  it('aplica la clase de estado seleccionado', () => {
    render(<ConversationListItem conversation={conv()} selected onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('selected');
  });
});

describe('ConversationListItem — interacción y A11Y-1', () => {
  it('dispara onClick al hacer click', async () => {
    const onClick = vi.fn();
    render(<ConversationListItem conversation={conv()} selected={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('expone un aria-label accesible con el nombre de contacto', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/Juan Perez/);
  });

  it('es un <button> real → alcanzable por teclado (Tab) sin ARIA extra', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });
});
