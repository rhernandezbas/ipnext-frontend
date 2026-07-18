import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NewsAttachment, NewsBroadcastResult } from '@/types/news';

// Mock axiosClient before importing the api module.
vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { newsApi } from '@/api/news.api';

const attachment: NewsAttachment = {
  id: 'att-1',
  kind: 'image',
  filename: 'foto.png',
  mimeType: 'image/png',
  sizeBytes: 1234,
  url: null,
  fileUrl: '/api/news/attachments/att-1/file',
  uploadedById: 'user-1',
  createdAt: '2026-07-16T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('newsApi.uploadAttachments', () => {
  it('POSTs multipart to /news/:id/attachments with field name "files" and returns the DTO array', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: [attachment] });
    const f1 = new File(['a'], 'foto.png', { type: 'image/png' });
    const f2 = new File(['b'], 'doc.pdf', { type: 'application/pdf' });

    const result = await newsApi.uploadAttachments('post-9', [f1, f2]);

    expect(result).toEqual([attachment]);
    const [url, body, config] = vi.mocked(axiosClient.post).mock.calls[0];
    expect(url).toBe('/news/post-9/attachments');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    const files = form.getAll('files');
    expect(files).toHaveLength(2);
    expect((files[0] as File).name).toBe('foto.png');
    expect((config as { headers: Record<string, string> }).headers['Content-Type']).toBe('multipart/form-data');
  });
});

describe('newsApi.addLinkAttachment', () => {
  it('POSTs JSON {kind:"link", url, filename} to /news/:id/attachments and returns the DTO', async () => {
    const link: NewsAttachment = { ...attachment, id: 'att-2', kind: 'link', url: 'https://x.test', fileUrl: null, mimeType: null, sizeBytes: null };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: link });

    const result = await newsApi.addLinkAttachment('post-9', { url: 'https://x.test', filename: 'Panel' });

    expect(result).toEqual(link);
    expect(axiosClient.post).toHaveBeenCalledWith('/news/post-9/attachments', {
      kind: 'link',
      url: 'https://x.test',
      filename: 'Panel',
    });
  });

  it('omits filename from the body when not provided', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: attachment });
    await newsApi.addLinkAttachment('post-9', { url: 'https://x.test' });
    expect(axiosClient.post).toHaveBeenCalledWith('/news/post-9/attachments', {
      kind: 'link',
      url: 'https://x.test',
    });
  });
});

describe('newsApi.deleteAttachment', () => {
  it('DELETEs /news/attachments/:id', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ status: 204 });
    await newsApi.deleteAttachment('att-1');
    expect(axiosClient.delete).toHaveBeenCalledWith('/news/attachments/att-1');
  });
});

describe('newsApi.broadcast', () => {
  it('POSTs /news/:id/broadcast and returns { sent, link }', async () => {
    const res: NewsBroadcastResult = { sent: true, link: 'http://noc.test/admin/news?post=post-9' };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: res });

    const result = await newsApi.broadcast('post-9');

    expect(axiosClient.post).toHaveBeenCalledWith('/news/post-9/broadcast');
    expect(result).toEqual(res);
  });
});
