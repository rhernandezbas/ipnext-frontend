/**
 * MediaAudio — adjunto tipo audio ya `downloaded` (messaging-inbox-v2-media
 * F1.5 fase A, F3.4, design §3.3). `<audio controls preload="metadata">`
 * nativo. Meta opcional: filename + tamaño (`formatFileSize`).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaAudio } from './MediaAudio';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

function attachment(over: Partial<WhatsappChatMessageAttachment> = {}): WhatsappChatMessageAttachment {
  return {
    id: 'att-1',
    fileType: 'audio',
    contentType: 'audio/ogg',
    filename: 'nota-voz.ogg',
    fileSize: 1_258_291, // 1.2 MB
    width: null,
    height: null,
    status: 'downloaded',
    url: '/api/messaging/attachments/att-1/file',
    thumbUrl: null,
    ...over,
  };
}

describe('MediaAudio', () => {
  it('renderiza <audio controls preload="metadata"> con el src del BE-proxy', () => {
    render(<MediaAudio attachment={attachment()} />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute('src', '/api/messaging/attachments/att-1/file');
    expect(audio).toHaveAttribute('controls');
    expect(audio).toHaveAttribute('preload', 'metadata');
  });

  it('muestra filename + tamaño formateado cuando ambos existen', () => {
    render(<MediaAudio attachment={attachment()} />);
    expect(screen.getByText('nota-voz.ogg · 1.2 MB')).toBeInTheDocument();
  });

  it('omite el tamaño cuando fileSize es null (nunca muestra "null")', () => {
    render(<MediaAudio attachment={attachment({ fileSize: null })} />);
    expect(screen.getByText('nota-voz.ogg')).toBeInTheDocument();
    expect(screen.queryByText(/null/i)).toBeNull();
  });

  it('sin filename ni fileSize, no renderiza línea de meta', () => {
    render(<MediaAudio attachment={attachment({ filename: null, fileSize: null })} />);
    expect(screen.queryByTestId('media-audio-meta')).toBeNull();
  });

  it('bug MEDIUM #5 (409-race): onError del <audio> muestra un fallback tipo MediaError, no un player nativo roto sin mensaje', () => {
    render(<MediaAudio attachment={attachment()} />);
    const audio = document.querySelector('audio') as HTMLAudioElement;
    fireEvent.error(audio);
    expect(document.querySelector('audio')).toBeNull();
    expect(screen.getByText(/no se pudo (cargar|mostrar) el audio/i)).toBeInTheDocument();
  });
});
