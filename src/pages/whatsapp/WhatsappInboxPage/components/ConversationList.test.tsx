/**
 * ConversationList — panel de la lista de conversaciones (messaging-inbox F1,
 * design §1/§2, tasks FB3 3.1/3.2). LIST-1 completo: skeleton / orden desc
 * `lastMessageAt` / empty / error / polling sin perder selección. Presentacional
 * (recibe `conversations`/`isLoading`/`isError`/`selectedId`/`onSelect` como
 * props — el fetch real vive en `WhatsappInboxPage`, FB4, vía
 * `useWhatsappConversations`); dueño SOLO del filtro de búsqueda local (UI
 * state, no hay `search` en el contrato del BE — design §3).
 */
import { render, screen, within, act, fireEvent } from '@testing-library/react';
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

describe('ConversationList — inbox-views Ola 1: los filtros viejos SE VAN de la barra (el sub-menú de vistas de la page es la única fuente)', () => {
  it('NO monta ningún radiogroup de estado/asignación (Abiertas/Resueltas + Todas/Mías/Sin asignar murieron con sus componentes)', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('la búsqueda y (con catálogo) el filtro de campaña SIGUEN arriba de la lista', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        campaigns={[{ id: 'camp-1', name: 'Recordatorio Julio' }]}
      />,
    );
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /campaña/i })).toBeInTheDocument();
  });
});

describe('ConversationList — filtro de etiqueta (Ola 5 labels)', () => {
  it('con catálogo de labels, monta el filtro de etiqueta (eje ortogonal a la campaña)', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        labels={[{ id: 'l1', name: 'Urgente', color: '#dc3545' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: /etiqueta/i })).toBeInTheDocument();
  });

  it('sin catálogo de labels, NO monta el filtro de etiqueta', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.queryByRole('combobox', { name: /etiqueta/i })).toBeNull();
  });

  it('campaña y etiqueta conviven (dos filtros ortogonales arriba de la lista)', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        campaigns={[{ id: 'camp-1', name: 'Recordatorio Julio' }]}
        labels={[{ id: 'l1', name: 'Urgente', color: '#dc3545' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: /campaña/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /etiqueta/i })).toBeInTheDocument();
  });

  it('elegir una etiqueta dispara onLabelChange con su id', async () => {
    const onLabelChange = vi.fn();
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        labels={[{ id: 'l1', name: 'Urgente', color: '#dc3545' }]}
        onLabelChange={onLabelChange}
      />,
    );
    await userEvent.click(screen.getByRole('combobox', { name: /etiqueta/i }));
    await userEvent.click(screen.getByRole('option', { name: /urgente/i }));
    expect(onLabelChange).toHaveBeenCalledWith('l1');
  });
});

describe('ConversationList — empty states por bucket (TAB-4) + emptyMessage por vista (inbox-views)', () => {
  it('bucket Abiertas sin conversaciones → "No hay conversaciones abiertas." (default por status)', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.getByText('No hay conversaciones abiertas.')).toBeInTheDocument();
  });

  it('bucket Resueltas sin conversaciones → "No hay conversaciones resueltas." (default por status)', () => {
    render(<ConversationList conversations={[]} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" />);
    expect(screen.getByText('No hay conversaciones resueltas.')).toBeInTheDocument();
  });

  it('emptyMessage (por vista) OVERRIDEA el default: "Mi bandeja" vacía no miente "no hay abiertas"', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        emptyMessage="No hay conversaciones en tu bandeja."
      />,
    );
    expect(screen.getByText('No hay conversaciones en tu bandeja.')).toBeInTheDocument();
    expect(screen.queryByText('No hay conversaciones abiertas.')).toBeNull();
  });

  it('escenario "todo resuelto": con conversaciones (todas resolved) y bucket Abiertas activo, muestra el empty del bucket (no el genérico ni el de búsqueda)', () => {
    const convs = [mk({ id: 'a', status: 'resolved' }), mk({ id: 'b', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    expect(screen.getByText('No hay conversaciones abiertas.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/no se encontraron conversaciones/i)).toBeNull();
  });
});

describe('ConversationList — filtro client-side de cinturón (TAB-2)', () => {
  it('en la tab Abiertas, una fila con status "resolved" (patch optimista) se excluye AL INSTANTE, sin esperar refetch', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Beto')).toBeNull();
  });

  it('en la tab Resueltas, solo se muestran las filas con status==="resolved"', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" />);

    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('con filterByStatus=false (vista Menciones), NO se filtra por bucket — se muestran abiertas Y resueltas tal como las trae el server', () => {
    // Ola 6: la vista "Menciones" muestra resueltas también; el cinturón
    // client-side (que asume "bucket abierto" con status='open') las borraría.
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    render(
      <ConversationList
        conversations={convs}
        isLoading={false}
        selectedId={null}
        onSelect={vi.fn()}
        status="open"
        filterByStatus={false}
      />,
    );

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('bucket Abiertas trata "pending" como NO resuelta (bucket, no match exacto — design.md D2)', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'pending' })];
    render(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('rollback (status vuelve a "open") re-entra la fila en Abiertas', () => {
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );
    expect(screen.queryByText('Beto')).toBeNull();

    const rolledBack = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    rerender(<ConversationList conversations={rolledBack} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

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
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    // sigue en el DOM, marcada como saliendo — todavía no removida.
    const row = screen.getByText('Beto').closest('li');
    expect(row).toHaveAttribute('data-exiting', 'true');
  });

  it('motion normal: tras la duración de la animación (~220ms), la fila se remueve del DOM', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
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
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(screen.queryByText('Beto')).toBeNull();
  });

  it('cambiar de TAB es un swap instantáneo — NO anima de salida las filas que quedan fuera del bucket nuevo', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'r', contactName: 'Carla', status: 'resolved' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();

    // cambia de tab (Abiertas → Resueltas) — Ana deja el bucket, pero por un
    // cambio de TAB, no por una acción del agente sobre Ana.
    rerender(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="resolved" />);

    // Ana desaparece AL INSTANTE, sin quedar montada como "ghost" animando.
    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText('Carla')).toBeInTheDocument();
  });

  it('rollback ANTES de que termine la animación cancela la salida (la fila deja de estar "exiting")', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.getByText('Beto').closest('li')).toHaveAttribute('data-exiting', 'true');

    // rollback dentro de la ventana de animación (100ms < 220ms de duración)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    expect(screen.getByText('Beto').closest('li')).not.toHaveAttribute('data-exiting');

    // y NO queda ningún timer colgado que la borre más tarde igual.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('Beto')).toBeInTheDocument();
  });

  it('LOW 1.1 (review adversarial, fix wave) — reentrada instantánea (sin avanzar ningún timer): la fila re-agregada nunca se renderiza con data-exiting stale ni duplicada', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.getByText('Beto').closest('li')).toHaveAttribute('data-exiting', 'true');

    // rollback/undo INMEDIATO — cero ms transcurridos entre el mark-exiting
    // y la reentrada (ni un solo `act(() => vi.advanceTimersByTime(...))`
    // de por medio): el caso más agresivo de "volver a visible dentro de
    // los 220ms" (LOW 1.1). La limpieza de exitingId/timer/ghost tiene que
    // quedar sincronizada con la reentrada en el bucket, no depender de que
    // el efecto de limpieza ya haya corrido.
    rerender(<ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);

    // La derivación de `exiting` ahora sale de la membresía real en
    // `visible` (recalculada del lado del RENDER, a partir de las props
    // actuales) en vez de depender de `exitingIds` (estado que puede quedar
    // stale un render) — la fila NUNCA debe cargar `data-exiting` mientras
    // genuinamente forma parte del bucket activo, y debe aparecer UNA sola
    // vez (no un duplicado real+ghost, que delataría que el mismo id quedó
    // registrado dos veces en `rows`).
    const rows = screen.getAllByText('Beto');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.closest('li')).not.toHaveAttribute('data-exiting');
  });
});

describe('ConversationList — LOW 4.2 (review adversarial, fix wave): empty-de-búsqueda no coexiste con un ghost animando', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('si la búsqueda filtra todo pero hay un ghost saliendo, se muestra el ghost SIN el empty-state de búsqueda', () => {
    vi.useFakeTimers();
    const convs = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'open' })];
    const { rerender } = render(
      <ConversationList conversations={convs} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />,
    );

    // Beto sale del bucket (resolver optimista) — queda "ghost" animando su
    // salida (todavía dentro de los 220ms de EXIT_DURATION_MS).
    const resolved = [mk({ id: 'a', contactName: 'Ana', status: 'open' }), mk({ id: 'b', contactName: 'Beto', status: 'resolved' })];
    rerender(<ConversationList conversations={resolved} isLoading={false} selectedId={null} onSelect={vi.fn()} status="open" />);
    expect(screen.getByText('Beto').closest('li')).toHaveAttribute('data-exiting', 'true');

    // el agente busca algo que NO matchea a Ana (la única fila REAL del
    // bucket activo) — el ghost de Beto (que ignora el filtro de búsqueda a
    // propósito, no se lo puede "buscar afuera" mid-animación) sigue
    // montado. Antes del fix, el empty-state de búsqueda ("No se
    // encontraron…") se mostraba IGUAL, superpuesto con la fila ghost.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-no-existe' } });

    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(screen.queryByText(/no se encontraron conversaciones/i)).toBeNull();
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
