/**
 * MediaVideo — adjunto tipo video ya `downloaded` (messaging-inbox-v2-media
 * F1.5 fase A, F3.4, design §3.2). `<video controls preload="metadata">`
 * nativo — teclado/lectores gratis, no se reinventa el player. Sin poster
 * (no hay ffmpeg en fase A) ni animación custom (Emil §"¿anima?": un player
 * se ve/opera seguido, sin motion decorativo).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaVideo } from './MediaVideo';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

function attachment(over: Partial<WhatsappChatMessageAttachment> = {}): WhatsappChatMessageAttachment {
  return {
    id: 'att-1',
    fileType: 'video',
    contentType: 'video/mp4',
    filename: 'clip.mp4',
    fileSize: 2_000_000,
    width: 1280,
    height: 720,
    status: 'downloaded',
    url: '/api/messaging/attachments/att-1/file',
    thumbUrl: null,
    ...over,
  };
}

describe('MediaVideo', () => {
  it('renderiza <video controls preload="metadata"> con el src del BE-proxy', () => {
    render(<MediaVideo attachment={attachment()} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', '/api/messaging/attachments/att-1/file');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'metadata');
  });

  it('reserva aspect-ratio de width/height cuando existen', () => {
    render(<MediaVideo attachment={attachment({ width: 1280, height: 720 })} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video.style.getPropertyValue('--media-ar')).toBe('1280 / 720');
  });

  it('fallback 16/9 sin width/height', () => {
    render(<MediaVideo attachment={attachment({ width: null, height: null })} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video.style.getPropertyValue('--media-ar')).toBe('16 / 9');
  });

  it('bug MEDIUM #5 (409-race): onError del <video> muestra un fallback tipo MediaError, no un player nativo roto sin mensaje', () => {
    render(<MediaVideo attachment={attachment()} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    fireEvent.error(video);
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByText(/no se pudo (cargar|mostrar) el (video|clip)/i)).toBeInTheDocument();
  });
});
