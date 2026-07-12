/**
 * MediaAttachments — layout de grupo (messaging-inbox-v2-media F1.5 fase A,
 * F3.6, design §6.3/§7.2). 1 adjunto → stack; ≥2 imágenes → grid 2-col;
 * mixto → stack. Stagger de 40ms/ítem (`--i`) para que los blur-ups no
 * disparen todos a la vez.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MediaAttachments } from './MediaAttachments';
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

describe('MediaAttachments', () => {
  it('lista vacía → no renderiza nada', () => {
    const { container } = render(<MediaAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('1 adjunto → renderiza esa sola hoja', () => {
    render(<MediaAttachments attachments={[attachment({ id: 'a1' })]} />);
    expect(screen.getByRole('button', { name: /ver foto\.jpg en grande/i })).toBeInTheDocument();
  });

  it('≥2 imágenes → layout grid', () => {
    render(<MediaAttachments attachments={[attachment({ id: 'a1' }), attachment({ id: 'a2', filename: 'foto2.jpg' })]} />);
    expect(screen.getByTestId('message-attachments')).toHaveClass('grid');
  });

  it('mixto (imagen + file) → layout stack, no grid', () => {
    render(
      <MediaAttachments
        attachments={[
          attachment({ id: 'a1' }),
          attachment({ id: 'a2', fileType: 'file', contentType: 'application/pdf', filename: 'doc.pdf', thumbUrl: null }),
        ]}
      />,
    );
    const el = screen.getByTestId('message-attachments');
    expect(el).toHaveClass('stack');
    expect(el).not.toHaveClass('grid');
  });

  it('asigna --i incremental por ítem (stagger de 40ms/ítem, design §7.2)', () => {
    render(
      <MediaAttachments
        attachments={[attachment({ id: 'a1' }), attachment({ id: 'a2', filename: 'foto2.jpg' }), attachment({ id: 'a3', filename: 'foto3.jpg' })]}
      />,
    );
    const items = screen.getByTestId('message-attachments').children;
    expect((items[0] as HTMLElement).style.getPropertyValue('--i')).toBe('0');
    expect((items[1] as HTMLElement).style.getPropertyValue('--i')).toBe('1');
    expect((items[2] as HTMLElement).style.getPropertyValue('--i')).toBe('2');
  });
});
