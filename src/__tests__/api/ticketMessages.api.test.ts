import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import { sendStaffTicketReply, getTicketUnreadCount } from '@/api/ticketMessages.api';
import type { TicketMessage } from '@/types/ticketMessages';

const sample: TicketMessage = {
  id: 'msg-1',
  ticketId: 'ticket-1',
  authorId: 'user-1',
  authorKind: 'staff',
  visibility: 'public',
  authorName: 'Ana Pérez',
  body: 'Ya reviso tu conexión.',
  createdAt: '2026-06-01T00:00:00.000Z',
  attachments: [],
};

describe('ticketMessages.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sendStaffTicketReply POSTs multipart FormData with the field name "files" under /tickets/:ticketId/messages', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: sample });

    const f1 = new File(['a'], 'foto.jpg', { type: 'image/jpeg' });
    const f2 = new File(['b'], 'nota.mp3', { type: 'audio/mpeg' });

    const result = await sendStaffTicketReply({
      ticketId: 'ticket-1',
      body: 'Ya reviso tu conexión.',
      authorName: 'Ana Pérez',
      files: [f1, f2],
    });

    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(axiosClient.post).mock.calls[0]!;
    expect(url).toBe('/tickets/ticket-1/messages');
    expect(body).toBeInstanceOf(FormData);

    const form = body as FormData;
    expect(form.get('body')).toBe('Ya reviso tu conexión.');
    expect(form.get('authorName')).toBe('Ana Pérez');
    const files = form.getAll('files');
    expect(files).toHaveLength(2);
    expect((files[0] as File).name).toBe('foto.jpg');
    expect((files[1] as File).name).toBe('nota.mp3');

    expect((config as { headers?: Record<string, string> })?.headers?.['Content-Type'])
      .toBe('multipart/form-data');

    expect(result).toEqual(sample);
  });

  it('sendStaffTicketReply omits authorName from the FormData when not provided', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: sample });

    await sendStaffTicketReply({ ticketId: 'ticket-1', body: 'hola', files: [] });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0]!;
    expect((body as FormData).has('authorName')).toBe(false);
  });

  it('sendStaffTicketReply sends body even when empty (attachments-only reply)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: sample });
    const f1 = new File(['a'], 'foto.jpg', { type: 'image/jpeg' });

    await sendStaffTicketReply({ ticketId: 'ticket-1', body: '', files: [f1] });

    const [, body] = vi.mocked(axiosClient.post).mock.calls[0]!;
    expect((body as FormData).get('body')).toBe('');
  });

  it('getTicketUnreadCount GETs /tickets/:ticketId/messages/unread-count and returns the number', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { unreadCount: 3 } });

    const result = await getTicketUnreadCount('ticket-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/tickets/ticket-1/messages/unread-count');
    expect(result).toBe(3);
  });
});
