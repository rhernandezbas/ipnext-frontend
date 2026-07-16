/**
 * ConversationList — panel de la lista de conversaciones (messaging-inbox F1,
 * design §1/§2, tasks FB3 3.1/3.2). LIST-1 completo: skeleton / orden desc
 * `lastMessageAt` / empty / error / polling sin perder selección. Presentacional
 * (recibe `conversations`/`isLoading`/`isError`/`selectedId`/`onSelect` como
 * props — el fetch real vive en `WhatsappInboxPage`, FB4, vía
 * `useWhatsappConversations`); dueño SOLO del filtro de búsqueda local (UI
 * state, no hay `search` en el contrato del BE — design §3).
 */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('ConversationList — filtro de asignación (messaging-inbox-assignment F1.5-C2, server-side)', () => {
  it('renderiza el ConversationAssignmentFilter con el value recibido', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} assignment="mine" onAssignmentChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Mías' })).toBeChecked();
  });

  it('sin assignment (default), el filtro arranca en "Todas"', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Todas' })).toBeChecked();
  });

  it('cambiar de tab dispara onAssignmentChange con el valor elegido', async () => {
    const onAssignmentChange = vi.fn();
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} assignment="all" onAssignmentChange={onAssignmentChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Sin asignar' }));

    expect(onAssignmentChange).toHaveBeenCalledWith('unassigned');
  });
});

describe('ConversationList — tabs de ciclo de vida (inbox-resolve, TAB-1)', () => {
  it('renderiza el ConversationStatusFilter con el value recibido', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" onStatusChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Resueltas' })).toBeChecked();
  });

  it('sin status (default), el filtro arranca en "Abiertas"', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Abiertas' })).toBeChecked();
  });

  it('cambiar de tab dispara onStatusChange con el valor elegido', async () => {
    const onStatusChange = vi.fn();
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={onStatusChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Resueltas' }));

    expect(onStatusChange).toHaveBeenCalledWith('resolved');
  });

  it('el filtro de estado se monta ANTES (arriba) del filtro de asignación', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    // Abiertas/Resueltas primero, Todas/Mías/Sin asignar después.
    expect(radios.map((r) => r.value)).toEqual(['open', 'resolved', 'all', 'mine', 'unassigned']);
  });
});

describe('ConversationList — empty states por tab (TAB-4)', () => {
  it('tab Abiertas sin conversaciones → "No hay conversaciones abiertas."', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);
    expect(screen.getByText('No hay conversaciones abiertas.')).toBeInTheDocument();
  });

  it('tab Resueltas sin conversaciones → "No hay conversaciones resueltas."', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" onStatusChange={vi.fn()} />);
    expect(screen.getByText('No hay conversaciones resueltas.')).toBeInTheDocument();
  });

  it('escenario "todo resuelto": con conversaciones (todas resolved) y tab Abiertas activa, muestra el empty de Abiertas (no el genérico ni el de búsqueda)', () => {
    const convs = [mk({ id: 'a', status: 'resolved' }), mk({ id: 'b', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    expect(screen.getByText('No hay conversaciones abiertas.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/no se encontraron conversaciones/i)).toBeNull();
  });
});

describe('ConversationList — filtro client-side de cinturón (TAB-2)', () => {
  it('en la tab Abiertas, una fila con status "resolved" (patch optimista) se excluye AL INSTANTE, sin esperar refetch', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Beto')).toBeNull();
  });

  it('en la tab Resueltas, solo se muestran las filas con status==="resolved"', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" onStatusChange={vi.fn()} />);

    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('bucket Abiertas trata "pending" como NO resuelta (bucket, no match exacto — design.md D2)', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'pending' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('rollback (status vuelve a "open") re-entra la fila en Abiertas', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );
    expect(screen.queryByText('Beto')).toBeNull();

    const rolledBack = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    rerender(<ConversationList conversations={rolledBack} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    expect(screen.getByText('Beto')).toBeInTheDocument();
  });
});

describe('ConversationList — MOTION-1 (transición de salida)', () => {
  function setPrefersReducedMotion(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    // jsdom no implementa matchMedia de fábrica (queda `undefined`) —
    // restaurar ese estado real para no filtrar el mock a otros tests (mismo
    // patrón que MessageBubble.test.tsx, bug #13).
    // @ts-expect-error -- borrar el stub
    delete window.matchMedia;
    vi.useRealTimers();
  });

  it('motion normal: una fila que sale del bucket queda montada (data-exiting) en vez de desaparecer al instante', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    // sigue en el DOM, marcada como saliendo — todavía no removida.
    const row = screen.getByText('Beto').closest('li');
    expect(row).toHaveAttribute('data-exiting', 'true');
  });

  it('motion normal: tras la duración de la animación (~220ms), la fila se remueve del DOM', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);
    expect(screen.getByText('Beto')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Beto')).toBeNull();
  });

  it('reduced-motion: la fila se remueve SIN animación (instantáneo, no queda data-exiting montado)', () => {
    setPrefersReducedMotion(true);
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.queryByText('Beto')).toBeNull();
  });

  it('cambiar de TAB es un swap instantáneo — NO anima de salida las filas que quedan fuera del bucket nuevo', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'r', contactName: 'Carla', status: 'resolved' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();

    // cambia de tab (Abiertas → Resueltas) — Ana deja el bucket, pero por un
    // cambio de TAB, no por una acción del agente sobre Ana.
    rerender(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" onStatusChange={vi.fn()} />);

    // Ana desaparece AL INSTANTE, sin quedar montada como "ghost" animando.
    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText('Carla')).toBeInTheDocument();
  });

  it('rollback ANTES de que termine la animación cancela la salida (la fila deja de estar "exiting")', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);
    expect(screen.getByText('Beto').closest('li')).toHaveAttribute('data-exiting', 'true');

    // rollback dentro de la ventana de animación (100ms < 220ms de duración)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" onStatusChange={vi.fn()} />);

    expect(screen.getByText('Beto').closest('li')).not.toHaveAttribute('data-exiting');

    // y NO queda ningún timer colgado que la borre más tarde igual.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('Beto')).toBeInTheDocument();
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
