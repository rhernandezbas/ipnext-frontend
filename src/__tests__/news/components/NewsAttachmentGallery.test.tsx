import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { NewsAttachment } from '@/types/news';
import { NewsAttachmentGallery } from '@/pages/news/components/NewsAttachmentGallery';

function att(over: Partial<NewsAttachment> = {}): NewsAttachment {
  return {
    id: 'att-1',
    kind: 'image',
    filename: 'foto.png',
    mimeType: 'image/png',
    sizeBytes: 2048,
    url: null,
    fileUrl: '/api/news/attachments/att-1/file',
    uploadedById: 'u1',
    createdAt: '2026-07-16T12:00:00.000Z',
    ...over,
  };
}

describe('NewsAttachmentGallery', () => {
  it('renders nothing when there are no attachments', () => {
    const { container } = render(<NewsAttachmentGallery attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders images as <img> pointing at the fileUrl', () => {
    render(<NewsAttachmentGallery attachments={[att({ id: 'i1', filename: 'plano.png' })]} />);
    const img = screen.getByRole('img', { name: /plano\.png/ });
    expect(img).toHaveAttribute('src', '/api/news/attachments/att-1/file');
  });

  it('renders a file (pdf/md) attachment as a link to its fileUrl', () => {
    render(
      <NewsAttachmentGallery
        attachments={[att({ id: 'f1', kind: 'file', filename: 'manual.pdf', mimeType: 'application/pdf', fileUrl: '/api/news/attachments/f1/file' })]}
      />,
    );
    const link = screen.getByRole('link', { name: /manual\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/news/attachments/f1/file');
  });

  it('renders a link attachment as an external anchor to its url', () => {
    render(
      <NewsAttachmentGallery
        attachments={[att({ id: 'l1', kind: 'link', filename: 'Panel NOC', mimeType: null, sizeBytes: null, url: 'https://noc.example/panel', fileUrl: null })]}
      />,
    );
    const link = screen.getByRole('link', { name: /Panel NOC/ });
    expect(link).toHaveAttribute('href', 'https://noc.example/panel');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('opens a lightbox when an image thumbnail is activated', async () => {
    const user = userEvent.setup();
    render(<NewsAttachmentGallery attachments={[att({ id: 'i2', filename: 'zoom.png' })]} />);
    await user.click(screen.getByRole('button', { name: /zoom\.png/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does NOT use a javascript: href even if a link url is hostile', () => {
    const { container } = render(
      <NewsAttachmentGallery
        attachments={[att({ id: 'l2', kind: 'link', filename: 'x', url: 'javascript:alert(1)', fileUrl: null })]}
      />,
    );
    for (const a of Array.from(container.querySelectorAll('a'))) {
      expect(a.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
    }
  });
});

// silence unused import when not needed
void vi;
