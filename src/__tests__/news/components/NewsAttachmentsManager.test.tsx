import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewsAttachment } from '@/types/news';

vi.mock('@/hooks/useNews', () => ({
  useUploadNewsAttachments: vi.fn(),
  useAddNewsLinkAttachment: vi.fn(),
  useDeleteNewsAttachment: vi.fn(),
}));

import {
  useUploadNewsAttachments,
  useAddNewsLinkAttachment,
  useDeleteNewsAttachment,
} from '@/hooks/useNews';
import { NewsAttachmentsManager } from '@/pages/news/components/NewsAttachmentsManager';

const mockUpload = useUploadNewsAttachments as unknown as ReturnType<typeof vi.fn>;
const mockAddLink = useAddNewsLinkAttachment as unknown as ReturnType<typeof vi.fn>;
const mockDelete = useDeleteNewsAttachment as unknown as ReturnType<typeof vi.fn>;

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

function pngFile(name = 'nueva.png'): File {
  return new File(['data'], name, { type: 'image/png' });
}

let uploadMutate: ReturnType<typeof vi.fn>;
let addLinkMutate: ReturnType<typeof vi.fn>;
let deleteMutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  uploadMutate = vi.fn().mockResolvedValue([att({ id: 'new-att', filename: 'nueva.png' })]);
  addLinkMutate = vi.fn().mockResolvedValue(att({ id: 'link-att', kind: 'link', filename: 'Panel', url: 'https://x.test', fileUrl: null }));
  deleteMutate = vi.fn().mockResolvedValue(undefined);
  mockUpload.mockReturnValue({ mutateAsync: uploadMutate, isPending: false });
  mockAddLink.mockReturnValue({ mutateAsync: addLinkMutate, isPending: false });
  mockDelete.mockReturnValue({ mutateAsync: deleteMutate, isPending: false });
});

function renderManager(initial: NewsAttachment[] = []) {
  return render(<NewsAttachmentsManager postId="post-9" initialAttachments={initial} />);
}

describe('NewsAttachmentsManager — existing attachments', () => {
  it('lists existing attachments with a delete control each', () => {
    renderManager([att({ id: 'a1', filename: 'plano.png' }), att({ id: 'a2', kind: 'file', filename: 'manual.pdf', fileUrl: '/api/news/attachments/a2/file' })]);
    expect(screen.getByText('plano.png')).toBeInTheDocument();
    expect(screen.getByText('manual.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /eliminar plano\.png/i })).toBeInTheDocument();
  });
});

describe('NewsAttachmentsManager — upload files (multipart)', () => {
  it('validates + uploads a chosen image and appends it to the list', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.upload(screen.getByTestId('news-file-input'), pngFile('nueva.png'));

    await waitFor(() => expect(uploadMutate).toHaveBeenCalledWith({ id: 'post-9', files: [expect.any(File)] }));
    expect(await screen.findByText('nueva.png')).toBeInTheDocument();
  });

  it('BLOCKS an unsupported file client-side and does NOT call upload', async () => {
    renderManager();
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' });
    // fireEvent.change drives the onChange directly (bypassing the picker's accept
    // filter, as drag&drop would) so the client-side validation layer is what must block it.
    fireEvent.change(screen.getByTestId('news-file-input'), { target: { files: [exe] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/no soportado/i);
    expect(uploadMutate).not.toHaveBeenCalled();
  });
});

describe('NewsAttachmentsManager — add link (json)', () => {
  it('adds a link and appends it', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.type(screen.getByLabelText(/enlace/i), 'https://x.test');
    await user.click(screen.getByRole('button', { name: /agregar enlace/i }));

    await waitFor(() =>
      expect(addLinkMutate).toHaveBeenCalledWith({ id: 'post-9', data: { url: 'https://x.test' } }),
    );
    expect(await screen.findByText('Panel')).toBeInTheDocument();
  });

  it('maps a 422 INVALID_LINK_ATTACHMENT to a legible message', async () => {
    const user = userEvent.setup();
    addLinkMutate.mockRejectedValue({ response: { status: 422, data: { code: 'INVALID_LINK_ATTACHMENT' } } });
    renderManager();
    await user.type(screen.getByLabelText(/enlace/i), 'ftp://nope');
    await user.click(screen.getByRole('button', { name: /agregar enlace/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/http/i);
  });
});

describe('NewsAttachmentsManager — delete', () => {
  it('confirms then deletes and removes the row', async () => {
    const user = userEvent.setup();
    renderManager([att({ id: 'a1', filename: 'borrame.png' })]);
    await user.click(screen.getByRole('button', { name: /eliminar borrame\.png/i }));

    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith('a1'));
    await waitFor(() => expect(screen.queryByText('borrame.png')).not.toBeInTheDocument());
  });
});
