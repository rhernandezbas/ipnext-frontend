/**
 * MediaFile — adjunto tipo file/documento ya `downloaded`
 * (messaging-inbox-v2-media F1.5 fase A, F3.5, design §3.4). Card
 * "documento" con ícono por `contentType`, filename (fallback "Archivo
 * adjunto"), meta (extensión + `formatFileSize`) y botón de descarga nativo
 * (`<a download>`, el BE ya manda `Content-Disposition`).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaFile } from './MediaFile';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';

function attachment(over: Partial<WhatsappChatMessageAttachment> = {}): WhatsappChatMessageAttachment {
  return {
    id: 'att-1',
    fileType: 'file',
    contentType: 'application/pdf',
    filename: 'factura-julio.pdf',
    fileSize: 12595, // 12.3 KB
    width: null,
    height: null,
    status: 'downloaded',
    url: '/api/messaging/attachments/att-1/file',
    thumbUrl: null,
    ...over,
  };
}

describe('MediaFile', () => {
  it('renderiza el filename y un ícono (SVG, no emoji)', () => {
    render(<MediaFile attachment={attachment()} />);
    expect(screen.getByText('factura-julio.pdf')).toBeInTheDocument();
    expect(document.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('fallback "Archivo adjunto" cuando filename es null', () => {
    render(<MediaFile attachment={attachment({ filename: null })} />);
    expect(screen.getByText('Archivo adjunto')).toBeInTheDocument();
  });

  it('meta muestra extensión + tamaño formateado', () => {
    render(<MediaFile attachment={attachment()} />);
    expect(screen.getByText('PDF · 12.3 KB')).toBeInTheDocument();
  });

  it('meta omite el tamaño cuando fileSize es null (nunca "null bytes")', () => {
    render(<MediaFile attachment={attachment({ fileSize: null })} />);
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.queryByText(/null/i)).toBeNull();
  });

  it('el link de descarga usa <a href download> con aria-label descriptivo', () => {
    render(<MediaFile attachment={attachment()} />);
    const link = screen.getByRole('link', { name: /descargar factura-julio\.pdf/i });
    expect(link).toHaveAttribute('href', '/api/messaging/attachments/att-1/file');
    expect(link).toHaveAttribute('download');
  });
});
