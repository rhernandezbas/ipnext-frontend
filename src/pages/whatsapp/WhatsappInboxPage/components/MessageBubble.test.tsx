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
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MessageBubble } from './MessageBubble';
import type { WhatsappChatMessageAttachment, WhatsappMessage } from '@/types/whatsapp';

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

describe('MessageBubble — media entrante (messaging-inbox-v2-media F1.5 fase A, F4, design §5)', () => {
  const imageAttachment: WhatsappChatMessageAttachment = {
    id: 'att-1',
    fileType: 'image',
    contentType: 'image/jpeg',
    filename: 'foto.jpg',
    fileSize: 102400,
    width: 800,
    height: 600,
    status: 'downloaded',
    url: '/api/messaging/attachments/att-1/file',
    thumbUrl: '/api/messaging/attachments/att-1/file?variant=thumb',
  };

  it('bug del span fantasma: content vacío NO pinta un <span> de texto', () => {
    render(<MessageBubble message={msg({ content: '' })} />);
    expect(screen.queryByTestId('message-bubble-content')).toBeNull();
  });

  it('content solo espacios tampoco pinta el <span> (mismo criterio que vacío)', () => {
    render(<MessageBubble message={msg({ content: '   ' })} />);
    expect(screen.queryByTestId('message-bubble-content')).toBeNull();
  });

  it('con contenido real, SÍ pinta el <span> de texto', () => {
    render(<MessageBubble message={msg({ content: 'hola' })} />);
    expect(screen.getByTestId('message-bubble-content')).toHaveTextContent('hola');
  });

  it('sin attachments (undefined), NO renderiza MessageAttachments', () => {
    render(<MessageBubble message={msg()} />);
    expect(screen.queryByTestId('message-attachments')).toBeNull();
  });

  it('con attachments.length, renderiza MessageAttachments (mensaje solo-media)', () => {
    render(<MessageBubble message={msg({ content: '', attachments: [imageAttachment] })} />);
    expect(screen.getByTestId('message-attachments')).toBeInTheDocument();
    // El mensaje solo-media persiste igual (content='') sin romper el render de ambos.
    expect(screen.queryByTestId('message-bubble-content')).toBeNull();
  });

  it('con texto Y attachments, renderiza AMBOS', () => {
    render(<MessageBubble message={msg({ content: 'mirá esto', attachments: [imageAttachment] })} />);
    expect(screen.getByTestId('message-bubble-content')).toHaveTextContent('mirá esto');
    expect(screen.getByTestId('message-attachments')).toBeInTheDocument();
  });

  it('attachments=[] (array vacío) NO renderiza MessageAttachments', () => {
    render(<MessageBubble message={msg({ attachments: [] })} />);
    expect(screen.queryByTestId('message-attachments')).toBeNull();
  });
});

describe('MessageBubble — deliveryStatus (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR, design §5.3)', () => {
  it('deliveryStatus undefined (default) — SIN overlay, regresión inbound/outbound intacta', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /reintentar/i })).toBeNull();
  });

  it('"sending" — muestra una progressbar con aria-valuenow derivado de uploadProgress', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" uploadProgress={0.42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('"sending" sin uploadProgress — progressbar en 0', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('"failed" — muestra "Reintentar" y "Descartar", y dispara onRetry/onDiscard', async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    render(
      <MessageBubble
        message={msg({ direction: 'outbound' })}
        deliveryStatus="failed"
        onRetry={onRetry}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo enviar/i);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('"failed" — NO muestra la progressbar de "sending"', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="failed" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('MessageBubble — bug BAJO #13b (deliveryFailed incluye IconAlert, consistencia con AttachmentPreviewItem)', () => {
  it('el banner "failed" incluye un ícono de alerta (svg), no solo texto', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="failed" />);
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('svg')).not.toBeNull();
  });
});

describe('MessageBubble — bug MEDIO #11 (aria-live narra hitos de progreso, no un aria-label estático)', () => {
  it('al cruzar el 25%, anuncia "25% enviado" en una región role=status separada', () => {
    const { rerender } = render(
      <MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" uploadProgress={0.1} />,
    );
    rerender(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" uploadProgress={0.3} />);

    expect(screen.getByRole('status')).toHaveTextContent('25% enviado');
  });

  it('al llegar a 100% (upload terminado, esperando confirmación del server), anuncia "Archivo enviado"', () => {
    const { rerender } = render(
      <MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" uploadProgress={0.8} />,
    );
    rerender(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="sending" uploadProgress={1} />);

    expect(screen.getByRole('status')).toHaveTextContent(/archivo enviado/i);
  });

  it('al fallar, anuncia el error en la región aria-live', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} deliveryStatus="failed" />);
    expect(screen.getByRole('status')).toHaveTextContent(/error al enviar/i);
  });

  it('sin deliveryStatus (bubble normal), no hay ninguna región de anuncio de progreso', () => {
    render(<MessageBubble message={msg({ direction: 'outbound' })} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
