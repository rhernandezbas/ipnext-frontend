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

describe('ConversationListItem — assignee/area (messaging-inbox-assignment F1.5-C2)', () => {
  it('con assignee, muestra el nombre del agente asignado', () => {
    render(<ConversationListItem conversation={conv({ assignee: { id: 'u1', name: 'Ana Torres' } })} selected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
  });

  it('sin assignee (null), no muestra ningún texto de agente', () => {
    render(<ConversationListItem conversation={conv({ assignee: null })} selected={false} onClick={vi.fn()} />);
    expect(screen.queryByText(/ana torres/i)).toBeNull();
  });

  it('sin el campo assignee (undefined — fixture previo a esta tanda), no crashea ni muestra nada', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  // hallazgo MEDIUM #3 (review adversarial F1.5-C2): el chip usaba el hex del
  // área como FONDO del texto (+ `readableTextColor` encima) — para hexes muy
  // SATURADOS (ej. rojo puro) ninguna opción de texto (blanco/casi-negro)
  // llega a 4.5:1 de contraste real (el umbral de luminancia de
  // `readableTextColor` no captura eso). Fix: el hex es SOLO un acento (un
  // dot), el nombre va en un color de texto SEGURO del theme — así CUALQUIER
  // hex del catálogo es legal, sin depender de heurísticas de contraste.
  it('con area, el nombre usa la clase de texto del theme (NO backgroundColor/color inline calculados del hex)', () => {
    render(<ConversationListItem conversation={conv({ area: { id: 'a1', name: 'Soporte', color: '#2563eb' } })} selected={false} onClick={vi.fn()} />);
    const name = screen.getByText('Soporte');
    expect(name).toBeInTheDocument();
    expect(name).toHaveClass('areaName');
    expect(name).not.toHaveStyle({ backgroundColor: '#2563eb' });
    expect(name.style.color).toBe('');
  });

  it('el hex del área aparece SOLO como acento (un dot), nunca como fondo del texto — ni siquiera para hexes muy saturados (rojo puro)', () => {
    render(<ConversationListItem conversation={conv({ area: { id: 'a4', name: 'Alertas', color: '#ff0000' } })} selected={false} onClick={vi.fn()} />);
    const name = screen.getByText('Alertas');
    expect(name).not.toHaveStyle({ backgroundColor: '#ff0000' });

    const dot = screen.getByTestId('area-dot');
    expect(dot).toHaveStyle({ backgroundColor: '#ff0000' });
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('el mismo criterio vale sobre un fondo claro (amber) — el nombre sigue en el color de texto del theme, no en negro calculado', () => {
    render(<ConversationListItem conversation={conv({ area: { id: 'a2', name: 'Ventas', color: '#fde68a' } })} selected={false} onClick={vi.fn()} />);
    const name = screen.getByText('Ventas');
    expect(name).toHaveClass('areaName');
    expect(name).not.toHaveStyle({ backgroundColor: '#fde68a' });
  });

  it('sin area (null), no muestra ningún chip ni dot', () => {
    render(<ConversationListItem conversation={conv({ area: null })} selected={false} onClick={vi.fn()} />);
    expect(screen.queryByText('Soporte')).toBeNull();
    expect(screen.queryByTestId('area-dot')).toBeNull();
  });
});

describe('ConversationListItem — chip de campaña (messaging-bulk-inbox Change 2)', () => {
  it('con campaigns no vacío, muestra el chip "Campaña: {name}"', () => {
    render(
      <ConversationListItem
        conversation={conv({ campaigns: [{ id: 'c1', name: 'Recordatorio Julio' }] })}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Campaña: Recordatorio Julio')).toBeInTheDocument();
  });

  it('el nombre textual está presente (indicador NO-solo-color: la etiqueta lleva el texto de la campaña)', () => {
    render(
      <ConversationListItem
        conversation={conv({ campaigns: [{ id: 'c1', name: 'Black Friday' }] })}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('campaign-chip');
    expect(chip).toHaveTextContent(/campaña:\s*black friday/i);
  });

  it('con campaigns vacío ([]), no muestra ningún chip de campaña', () => {
    render(<ConversationListItem conversation={conv({ campaigns: [] })} selected={false} onClick={vi.fn()} />);
    expect(screen.queryByTestId('campaign-chip')).toBeNull();
    expect(screen.queryByText(/campaña:/i)).toBeNull();
  });

  it('sin el campo campaigns (undefined — fixture previo a esta tanda), no crashea ni muestra chip', () => {
    render(<ConversationListItem conversation={conv()} selected={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-chip')).toBeNull();
  });

  it('con >1 campaña, muestra la primera + "+N" (N = resto), sin listar todas', () => {
    render(
      <ConversationListItem
        conversation={conv({
          campaigns: [
            { id: 'c1', name: 'Campaña Uno' },
            { id: 'c2', name: 'Campaña Dos' },
            { id: 'c3', name: 'Campaña Tres' },
          ],
        })}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Campaña: Campaña Uno')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-more')).toHaveTextContent('+2');
    // no lista las otras por nombre completo
    expect(screen.queryByText('Campaña: Campaña Dos')).toBeNull();
  });

  it('con exactamente 1 campaña, NO muestra el "+N"', () => {
    render(
      <ConversationListItem
        conversation={conv({ campaigns: [{ id: 'c1', name: 'Única' }] })}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('campaign-more')).toBeNull();
  });

  it('el "+N" expone un nombre accesible (no un "+2" críptico solo visual)', () => {
    render(
      <ConversationListItem
        conversation={conv({
          campaigns: [
            { id: 'c1', name: 'Campaña Uno' },
            { id: 'c2', name: 'Campaña Dos' },
          ],
        })}
        selected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId('campaign-more')).toHaveAccessibleName(/1 campaña más/i);
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
