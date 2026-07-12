/**
 * MediaAttachment — router por `status` primero, `fileType` después
 * (messaging-inbox-v2-media F1.5 fase A, F3.6, design §2). `status`
 * pending/failed son transversales a todos los tipos; solo cuando está
 * `downloaded` se decide por `fileType`.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MediaAttachment } from './MediaAttachment';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

function attachment(over: Partial<WhatsappChatMessageAttachment> = {}): WhatsappChatMessageAttachment {
  return {
    id: 'att-1',
    fileType: 'image',
    contentType: 'image/jpeg',
    filename: 'foto.jpg',
    fileSize: 1000,
    width: 800,
    height: 600,
    status: 'downloaded',
    url: '/api/messaging/attachments/att-1/file',
    thumbUrl: '/api/messaging/attachments/att-1/file?variant=thumb',
    ...over,
  };
}

describe('MediaAttachment — router', () => {
  it('status="pending" → MediaPlaceholder, sin importar fileType', () => {
    render(<MediaAttachment attachment={attachment({ status: 'pending', fileType: 'file' })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/descargando adjunto/i);
  });

  it('status="failed" → MediaError, sin importar fileType', () => {
    render(<MediaAttachment attachment={attachment({ status: 'failed', fileType: 'video' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar el adjunto/i);
  });

  it('downloaded + fileType="image" → MediaImage', () => {
    render(<MediaAttachment attachment={attachment({ status: 'downloaded', fileType: 'image' })} />);
    expect(screen.getByRole('button', { name: /ver foto\.jpg en grande/i })).toBeInTheDocument();
  });

  it('downloaded + fileType="video" → MediaVideo (<video> nativo)', () => {
    render(<MediaAttachment attachment={attachment({ status: 'downloaded', fileType: 'video' })} />);
    expect(document.querySelector('video')).not.toBeNull();
  });

  it('downloaded + fileType="audio" → MediaAudio (<audio> nativo)', () => {
    render(<MediaAttachment attachment={attachment({ status: 'downloaded', fileType: 'audio' })} />);
    expect(document.querySelector('audio')).not.toBeNull();
  });

  it('downloaded + fileType="file" → MediaFile (card + link de descarga)', () => {
    render(<MediaAttachment attachment={attachment({ status: 'downloaded', fileType: 'file', contentType: 'application/pdf', filename: 'doc.pdf' })} />);
    expect(screen.getByRole('link', { name: /descargar doc\.pdf/i })).toBeInTheDocument();
  });

  it('status="failed" → onRetryAttachment se cablea como onRetry de MediaError (bug crítico #1)', () => {
    const onRetryAttachment = vi.fn();
    render(<MediaAttachment attachment={attachment({ status: 'failed' })} onRetryAttachment={onRetryAttachment} />);
    screen.getByRole('button', { name: /reintentar/i }).click();
    expect(onRetryAttachment).toHaveBeenCalledTimes(1);
  });
});

describe('MediaAttachment — bug LOW #6 (guard de status inesperado, sin confirmar "downloaded")', () => {
  it('status inesperado (ni pending/failed/downloaded) → MediaPlaceholder, NUNCA la hoja de media', () => {
    render(<MediaAttachment attachment={attachment({ status: 'unknown' as never, fileType: 'image' })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/descargando adjunto/i);
    expect(screen.queryByRole('button', { name: /ver foto\.jpg en grande/i })).toBeNull();
  });
});
