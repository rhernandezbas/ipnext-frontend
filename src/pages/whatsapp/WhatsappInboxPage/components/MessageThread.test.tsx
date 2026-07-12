/**
 * MessageThread — panel central del thread (messaging-inbox F1, design §1/§7,
 * tasks FB3 3.3/3.4). THREAD-1 completo + A11Y-1 (aria-live). Presentacional:
 * recibe `messages`/`isLoading`/`isError`/`contactName` como props —
 * `WhatsappInboxPage` (FB4) orquesta `useWhatsappConversation`/
 * `useWhatsappMessages` (design §1/§4) y el "fetch on open" (`enabled:!!id`)
 * ya lo resuelven esos hooks; acá solo se consume el resultado.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageThread } from './MessageThread';
import type { WhatsappMessage } from '@/types/whatsapp';

const msg = (over: Partial<WhatsappMessage> = {}): WhatsappMessage => ({
  id: 'm1',
  direction: 'inbound',
  content: 'Hola, tengo un problema',
  senderName: null,
  sentAt: '2026-07-11T18:00:00.000Z',
  ...over,
});

describe('MessageThread — sin conversación seleccionada', () => {
  it('muestra un estado neutro, sin pegar el thread ni la lista', () => {
    render(<MessageThread conversationId={null} contactName={null} messages={[]} isLoading={false} />);
    expect(screen.getByText(/seleccion.*una conversaci.n/i)).toBeInTheDocument();
  });
});

describe('MessageThread — THREAD-1 (loading/empty/error)', () => {
  it('loading muestra un estado de carga, no un thread vacío', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin mensajes/i)).toBeNull();
  });

  it('empty thread: conversación sin mensajes', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading={false} />);
    expect(screen.getByText(/sin mensajes a.n/i)).toBeInTheDocument();
  });

  it('error state sin crashear', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading={false} isError />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('MessageThread — THREAD-1 (burbujas + header)', () => {
  it('renderiza burbujas por dirección (inbound izq / outbound der)', () => {
    render(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1', direction: 'inbound' }), msg({ id: 'm2', direction: 'outbound', content: 'Hola de vuelta' })]}
        isLoading={false}
      />,
    );
    const rows = screen.getAllByTestId('message-bubble-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('inbound');
    expect(rows[1]).toHaveClass('outbound');
  });

  it('muestra el nombre de contacto en el header', () => {
    render(<MessageThread conversationId="c1" contactName="Juan Perez" messages={[]} isLoading={false} />);
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
  });
});

describe('MessageThread — A11Y-1 (aria-live)', () => {
  it('el contenedor de mensajes expone aria-live="polite"', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[msg()]} isLoading={false} />);
    expect(screen.getByTestId('message-thread-list')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('MessageThread — motion (design §7: burbuja nueva vs historial inicial)', () => {
  it('el historial inicial NO se marca como "nuevo" (sin animar 50 burbujas al abrir)', () => {
    render(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2' })]}
        isLoading={false}
      />,
    );
    for (const row of screen.getAllByTestId('message-bubble-row')) {
      expect(row).not.toHaveClass('enter');
    }
  });

  it('un mensaje agregado tras el mount (misma conversación) se marca como nuevo', () => {
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    expect(screen.getAllByTestId('message-bubble-row')[0]).not.toHaveClass('enter');

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2', direction: 'outbound' })]}
        isLoading={false}
      />,
    );
    const rows = screen.getAllByTestId('message-bubble-row');
    expect(rows[0]).not.toHaveClass('enter');
    expect(rows[1]).toHaveClass('enter');
  });

  it('al cambiar de conversationId, el nuevo historial NO se marca como nuevo', () => {
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    rerender(
      <MessageThread conversationId="c2" contactName="Ana" messages={[msg({ id: 'm9' })]} isLoading={false} />,
    );
    expect(screen.getAllByTestId('message-bubble-row')[0]).not.toHaveClass('enter');
  });

  it('el swap de conversación aplica la clase de crossfade', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading={false} />);
    expect(screen.getByTestId('message-thread-swap')).toHaveClass('swap');
  });
});

describe('MessageThread — bug #2 (stagger BATCH-relative, no índice absoluto del array)', () => {
  it('en un thread largo, un único mensaje nuevo tiene delay 0ms (no el índice absoluto × 40ms)', () => {
    const initial = Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}` }));
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={initial} isLoading={false} />,
    );

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[...initial, msg({ id: 'm20', direction: 'outbound' })]}
        isLoading={false}
      />,
    );

    const rows = screen.getAllByTestId('message-bubble-row');
    const newRow = rows[rows.length - 1]!;
    expect(newRow).toHaveClass('enter');
    // Bug: el código viejo pasaba staggerIndex=20 (índice absoluto) → 800ms.
    // Fix: batch-relative → es el único mensaje nuevo del batch → 0ms.
    expect(newRow.style.animationDelay).toBe('0ms');
  });

  it('dos mensajes nuevos que llegan juntos en un thread largo cascadean 0ms/40ms (batch-relative), no 800ms/840ms', () => {
    const initial = Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}` }));
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={initial} isLoading={false} />,
    );

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[...initial, msg({ id: 'm20', direction: 'inbound' }), msg({ id: 'm21', direction: 'inbound' })]}
        isLoading={false}
      />,
    );

    const rows = screen.getAllByTestId('message-bubble-row');
    const [secondToLast, last] = [rows[rows.length - 2]!, rows[rows.length - 1]!];
    expect(secondToLast.style.animationDelay).toBe('0ms');
    expect(last.style.animationDelay).toBe('40ms');
  });
});

describe('MessageThread — bug #7 (auto-scroll guard: no patear al fondo en cada poll)', () => {
  function setScrollPosition(
    el: HTMLElement,
    { scrollHeight, scrollTop, clientHeight }: { scrollHeight: number; scrollTop: number; clientHeight: number },
  ) {
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    // jsdom no implementa scrollIntoView de fábrica — restaurar ese estado
    // real para no filtrar el mock a otros describe blocks del archivo.
    // @ts-expect-error -- borrar el stub, no dejar `undefined` explícito
    delete Element.prototype.scrollIntoView;
  });

  it('con el usuario scrolleado arriba (lejos del fondo), un mensaje inbound nuevo (poll) NO patea el scroll', () => {
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    setScrollPosition(screen.getByTestId('message-thread-list'), { scrollHeight: 2000, scrollTop: 0, clientHeight: 400 });
    scrollSpy.mockClear();

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2', direction: 'inbound' })]}
        isLoading={false}
      />,
    );

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('con el usuario cerca del fondo, un mensaje nuevo SÍ hace scroll', () => {
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    setScrollPosition(screen.getByTestId('message-thread-list'), { scrollHeight: 500, scrollTop: 460, clientHeight: 400 });
    scrollSpy.mockClear();

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2', direction: 'inbound' })]}
        isLoading={false}
      />,
    );

    expect(scrollSpy).toHaveBeenCalled();
  });

  it('el propio envío (último mensaje outbound) hace scroll aunque el usuario esté lejos del fondo', () => {
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    setScrollPosition(screen.getByTestId('message-thread-list'), { scrollHeight: 2000, scrollTop: 0, clientHeight: 400 });
    scrollSpy.mockClear();

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2', direction: 'outbound' })]}
        isLoading={false}
      />,
    );

    expect(scrollSpy).toHaveBeenCalled();
  });

  it('abrir una conversación (nueva) siempre scrollea al fondo, aunque el thread previo estuviera scrolleado arriba', () => {
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('edge (re-review fase 2, mitigación de umbral): un mensaje inbound "alto" que hace crecer scrollHeight igual auto-scrollea si el usuario estaba pegado al fondo', () => {
    // El bug real: `scrollHeight` ya creció (el mensaje nuevo, alto, ya está
    // en el DOM cuando corre el efecto) pero `scrollTop` NO se ajustó solo
    // (el navegador no re-ancla el scroll por vos) — la distancia post-
    // crecimiento queda en una zona intermedia (100px: por encima del
    // umbral viejo de 80px, típica de un mensaje largo/con salto de línea),
    // aunque el usuario estuviera efectivamente pegado al fondo antes de que
    // ese mensaje llegara. Mitigación: subir el umbral a 120px.
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    const { rerender } = render(
      <MessageThread conversationId="c1" contactName="Juan" messages={[msg({ id: 'm1' })]} isLoading={false} />,
    );
    setScrollPosition(screen.getByTestId('message-thread-list'), { scrollHeight: 960, scrollTop: 460, clientHeight: 400 });
    scrollSpy.mockClear();

    rerender(
      <MessageThread
        conversationId="c1"
        contactName="Juan"
        messages={[msg({ id: 'm1' }), msg({ id: 'm2', direction: 'inbound', content: 'Un mensaje bastante más alto que el resto' })]}
        isLoading={false}
      />,
    );

    expect(scrollSpy).toHaveBeenCalled();
  });
});

describe('MessageThread — bug #8 (mobile trap: botón para volver a la lista)', () => {
  it('sin onBack, no se renderiza ningún botón de volver', () => {
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading={false} />);
    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull();
  });

  it('con onBack, se renderiza el botón y dispara el callback al click', async () => {
    const onBack = vi.fn();
    render(<MessageThread conversationId="c1" contactName="Juan" messages={[]} isLoading={false} onBack={onBack} />);

    await userEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sin conversación seleccionada, el placeholder NO muestra el botón de volver (nada que abandonar)', () => {
    const onBack = vi.fn();
    render(<MessageThread conversationId={null} contactName={null} messages={[]} isLoading={false} onBack={onBack} />);
    expect(screen.queryByRole('button', { name: /volver/i })).toBeNull();
  });
});
