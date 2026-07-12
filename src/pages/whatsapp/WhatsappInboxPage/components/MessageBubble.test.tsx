/**
 * MessageBubble — burbuja de un mensaje del thread (messaging-inbox F1,
 * design §1/§7, tasks FB2 2.3/2.4). THREAD-1 "burbujas por dirección":
 * inbound izquierda / outbound derecha. Motion: entrada solo cuando el
 * padre (MessageThread, FB3) marca `isNew` — nunca en la carga inicial del
 * historial (correspondería a "purpose & frequency": animar 50 burbujas
 * juntas en el open del thread no tiene propósito, ver
 * .agents/skills/improve-animations/AUDIT.md §1).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MessageBubble } from './MessageBubble';
import type { WhatsappMessage } from '@/types/whatsapp';

const msg = (over: Partial<WhatsappMessage> = {}): WhatsappMessage => ({
  id: 'msg-1',
  direction: 'inbound',
  content: 'Hola, tengo un problema',
  senderName: null,
  sentAt: '2026-07-11T18:30:00.000Z',
  ...over,
});

describe('MessageBubble — THREAD-1 (burbujas por dirección)', () => {
  it('inbound se alinea a la izquierda', () => {
    render(<MessageBubble message={msg({ direction: 'inbound' })} />);
    expect(screen.getByTestId('message-bubble-row')).toHaveClass('inbound');
    expect(screen.getByTestId('message-bubble-row')).not.toHaveClass('outbound');
  });

  it('outbound se alinea a la derecha', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} />);
    expect(screen.getByTestId('message-bubble-row')).toHaveClass('outbound');
    expect(screen.getByTestId('message-bubble-row')).not.toHaveClass('inbound');
  });

  it('renderiza el contenido del mensaje', () => {
    render(<MessageBubble message={msg({ content: 'Buenas tardes, ¿en qué te ayudo?' })} />);
    expect(screen.getByText('Buenas tardes, ¿en qué te ayudo?')).toBeInTheDocument();
  });

  it('renderiza la hora formateada (America/Argentina/Buenos_Aires)', () => {
    render(<MessageBubble message={msg({ sentAt: '2026-07-11T18:30:00.000Z' })} />);
    expect(screen.getByText('15:30')).toBeInTheDocument();
  });

  it('renderiza senderName cuando está presente (ej. mensajes outbound de un agente)', () => {
    render(<MessageBubble message={msg({ direction: 'outbound', senderName: 'Agente Rocío' })} />);
    expect(screen.getByText('Agente Rocío')).toBeInTheDocument();
  });

  it('NO renderiza un label de sender cuando senderName es null', () => {
    render(<MessageBubble message={msg({ senderName: null })} />);
    expect(screen.queryByTestId('message-bubble-sender')).toBeNull();
  });
});

describe('MessageBubble — motion (design §7: slide-up 8px + opacity, 220ms --wa-ease-out, stagger 40ms)', () => {
  it('sin isNew (default), NO aplica la animación de entrada', () => {
    render(<MessageBubble message={msg()} />);
    expect(screen.getByTestId('message-bubble-row')).not.toHaveClass('enter');
  });

  it('con isNew=true, aplica la clase de entrada', () => {
    render(<MessageBubble message={msg()} isNew />);
    expect(screen.getByTestId('message-bubble-row')).toHaveClass('enter');
  });

  it('con isNew=false explícito, tampoco anima (ej. historial inicial ya cargado)', () => {
    render(<MessageBubble message={msg()} isNew={false} />);
    expect(screen.getByTestId('message-bubble-row')).not.toHaveClass('enter');
  });

  it('aplica el stagger (40ms × staggerIndex) como animation-delay inline SOLO cuando isNew', () => {
    render(<MessageBubble message={msg()} isNew staggerIndex={2} />);
    expect(screen.getByTestId('message-bubble-row').style.animationDelay).toBe('80ms');
  });

  it('sin staggerIndex, el delay por defecto es 0ms', () => {
    render(<MessageBubble message={msg()} isNew />);
    expect(screen.getByTestId('message-bubble-row').style.animationDelay).toBe('0ms');
  });

  it('staggerIndex sin isNew no aplica delay (no hay animación que retrasar)', () => {
    render(<MessageBubble message={msg()} staggerIndex={3} />);
    expect(screen.getByTestId('message-bubble-row').style.animationDelay).toBe('');
  });

  it('reduced-motion: el contenido sigue rendereando sin romper (CSS-only, cubierto por @media en el módulo)', () => {
    render(<MessageBubble message={msg({ content: 'segue' })} isNew staggerIndex={1} />);
    expect(screen.getByText('segue')).toBeInTheDocument();
  });
});

describe('MessageBubble — bug #13 (reduced-motion NO debe aplicar animationDelay inline)', () => {
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
    // restaurar ese estado real para no filtrar el mock a otros tests.
    // @ts-expect-error -- borrar el stub
    delete window.matchMedia;
  });

  it('con isNew + reduced-motion, NO aplica animationDelay inline (evita burbujas invisibles ~800ms bajo fill-mode:both)', () => {
    setPrefersReducedMotion(true);
    render(<MessageBubble message={msg()} isNew staggerIndex={5} />);
    expect(screen.getByTestId('message-bubble-row').style.animationDelay).toBe('');
  });

  it('con isNew + SIN reduced-motion, sigue aplicando el stagger normalmente', () => {
    setPrefersReducedMotion(false);
    render(<MessageBubble message={msg()} isNew staggerIndex={5} />);
    expect(screen.getByTestId('message-bubble-row').style.animationDelay).toBe('200ms');
  });
});
