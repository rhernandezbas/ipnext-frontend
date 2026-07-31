import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TicketMessageAttachmentView } from '@/pages/tickets/TicketDetailPage/components/messaging/TicketMessageAttachmentView';

describe('TicketMessageAttachmentView', () => {
  it('renders an image (kind="image") as a thumbnail button and opens the shared lightbox on click', async () => {
    const user = userEvent.setup();
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a1', url: '/api/tickets/messages/attachments/a1/file', filename: 'foto.jpg', mimeType: 'image/jpeg', sizeBytes: 100, kind: 'image' }}
      />,
    );
    const btn = screen.getByRole('button', { name: /ver foto\.jpg en grande/i });
    const img = within(btn).getByAltText('foto.jpg') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/tickets/messages/attachments/a1/file');

    await user.click(btn);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText('foto.jpg')).toBeInTheDocument();
  });

  it('renders a legacy data-URI image (kind absent) as a thumbnail too', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS';
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a1', url: dataUri, filename: 'pegada.png' }}
      />,
    );
    const img = screen.getByAltText('pegada.png') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(dataUri);
  });

  it('renders an audio attachment (kind="audio") with a native player + accessible caption', () => {
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a2', url: '/api/tickets/messages/attachments/a2/file', filename: 'nota.mp3', mimeType: 'audio/mpeg', sizeBytes: 2000, kind: 'audio' }}
      />,
    );
    const audio = screen.getByTestId('ticket-attachment-audio') as HTMLAudioElement;
    expect(audio.tagName).toBe('AUDIO');
    expect(audio).toHaveAttribute('controls');
    expect(audio.getAttribute('src')).toBe('/api/tickets/messages/attachments/a2/file');
    expect(screen.getByText('nota.mp3')).toBeInTheDocument();
  });

  it('renders a video attachment (kind="video") with a native player + accessible caption', () => {
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a3', url: '/api/tickets/messages/attachments/a3/file', filename: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 3000, kind: 'video' }}
      />,
    );
    const video = screen.getByTestId('ticket-attachment-video') as HTMLVideoElement;
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('controls');
    expect(video.getAttribute('src')).toBe('/api/tickets/messages/attachments/a3/file');
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });

  it('renders an https URL of unknown kind as a safe link', () => {
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a4', url: 'https://cdn.example.com/file.pdf', filename: 'file.pdf' }}
      />,
    );
    const link = screen.getByRole('link', { name: /file\.pdf/i });
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/file.pdf');
  });

  it('does NOT render a link for a javascript: URL — plain filename text only', () => {
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a5', url: 'javascript:alert(1)', filename: 'evil.pdf' }}
      />,
    );
    expect(screen.queryByRole('link', { name: /evil\.pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText('evil.pdf')).toBeInTheDocument();
  });

  it('renders a "not available" fallback when url is null (corrupted legacy attachment)', () => {
    render(
      <TicketMessageAttachmentView
        attachment={{ id: 'a6', url: null, filename: 'roto.png' }}
      />,
    );
    expect(screen.getByText(/no disponible/i)).toBeInTheDocument();
    expect(screen.getByTitle('roto.png')).toHaveTextContent('roto.png — no disponible');
  });
});
