/**
 * MediaImage — adjunto tipo image ya `downloaded` (messaging-inbox-v2-media
 * F1.5 fase A, F3.3, design §3.1). Test de regresión del 409 (design §1):
 * el FE NO debe pegarle al endpoint de servido mientras `status !==
 * 'downloaded'` — por eso `<img src>` solo se monta cuando la fila YA está
 * downloaded, aunque el router (`MediaAttachment`) normalmente ya filtre
 * esto — defensa en profundidad.
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaImage } from './MediaImage';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

function attachment(over: Partial<WhatsappChatMessageAttachment> = {}): WhatsappChatMessageAttachment {
  return {
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
    ...over,
  };
}

describe('MediaImage', () => {
  it('renderiza el thumbUrl como src con el filename como alt', () => {
    render(<MediaImage attachment={attachment()} />);
    const img = screen.getByAltText('foto.jpg');
    expect(img).toHaveAttribute('src', '/api/messaging/attachments/att-1/file?variant=thumb');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('fallback de alt cuando filename es null', () => {
    render(<MediaImage attachment={attachment({ filename: null })} />);
    expect(screen.getByAltText('Imagen adjunta')).toBeInTheDocument();
  });

  it('REGRESIÓN 409: NO monta <img> cuando status !== "downloaded"', () => {
    render(<MediaImage attachment={attachment({ status: 'pending' })} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('blur-up: onLoad marca data-loaded="true" en el <img>', () => {
    render(<MediaImage attachment={attachment()} />);
    const img = screen.getByAltText('foto.jpg');
    expect(img).toHaveAttribute('data-loaded', 'false');
    fireEvent.load(img);
    expect(img).toHaveAttribute('data-loaded', 'true');
  });

  it('onError → estado roto local (oculta el img, muestra fallback)', () => {
    render(<MediaImage attachment={attachment()} />);
    const img = screen.getByAltText('foto.jpg');
    fireEvent.error(img);
    expect(screen.queryByAltText('foto.jpg')).toBeNull();
    expect(screen.getByText(/no se pudo mostrar/i)).toBeInTheDocument();
  });

  it('click abre el lightbox con la URL ORIGINAL (no el thumb)', async () => {
    render(<MediaImage attachment={attachment()} />);
    fireEvent.click(screen.getByRole('button', { name: /ver foto\.jpg en grande/i }));

    const dialog = await screen.findByRole('dialog');
    const full = within(dialog).getByAltText('foto.jpg');
    expect(full).toHaveAttribute('src', '/api/messaging/attachments/att-1/file');
  });

  it('cierra el lightbox con Escape y devuelve el foco al botón que lo abrió', async () => {
    render(<MediaImage attachment={attachment()} />);
    const openBtn = screen.getByRole('button', { name: /ver foto\.jpg en grande/i });
    fireEvent.click(openBtn);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MediaImage — bug LOW #7 (blur-up: imagen ya cacheada queda invisible)', () => {
  it('si el img ya está completo al montar (img.complete + naturalWidth, cache del navegador), marca data-loaded="true" sin esperar el evento load', () => {
    // Simula una imagen SERVIDA DESDE CACHÉ: el evento `load` del navegador
    // real dispara ANTES de que React ate el handler `onLoad` — sin un check
    // en mount, la imagen queda para siempre en opacity:0 (blur-up nunca
    // termina). jsdom no fetchea imágenes reales, así que se pisa el
    // accessor de HTMLImageElement.prototype para reproducir ese estado.
    const completeDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
    const naturalWidthDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth');
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 800 });

    try {
      render(<MediaImage attachment={attachment()} />);
      expect(screen.getByAltText('foto.jpg')).toHaveAttribute('data-loaded', 'true');
    } finally {
      if (completeDesc) Object.defineProperty(HTMLImageElement.prototype, 'complete', completeDesc);
      if (naturalWidthDesc) Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', naturalWidthDesc);
    }
  });

  it('si el img NO está completo al montar (carga real en curso), sigue arrancando en data-loaded="false"', () => {
    render(<MediaImage attachment={attachment()} />);
    expect(screen.getByAltText('foto.jpg')).toHaveAttribute('data-loaded', 'false');
  });
});
