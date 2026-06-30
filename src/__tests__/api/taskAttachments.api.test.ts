import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axiosClient before importing the api module
vi.mock('@/api/axios-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import axiosClient from '@/api/axios-client';
import {
  listTaskAttachments,
  uploadTaskAttachments,
  deleteTaskAttachment,
} from '@/api/taskAttachments.api';
import type { TaskAttachment } from '@/types/taskAttachments';

const sample: TaskAttachment = {
  id: 'att-1',
  taskId: 'task-1',
  filename: 'foto.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1234,
  width: 800,
  height: 600,
  uploadedById: 'user-1',
  createdAt: '2026-06-01T00:00:00.000Z',
  fileUrl: '/api/scheduling/attachments/att-1/file',
  thumbUrl: '/api/scheduling/attachments/att-1/file?variant=thumb',
};

describe('taskAttachments.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listTaskAttachments GETs /scheduling/:taskId/attachments and returns the array', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: [sample] });

    const result = await listTaskAttachments('task-1');

    expect(axiosClient.get).toHaveBeenCalledWith('/scheduling/task-1/attachments');
    expect(result).toEqual([sample]);
  });

  it('uploadTaskAttachments POSTs multipart FormData with the field name "photos"', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: [sample] });

    const f1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const f2 = new File(['b'], 'b.png', { type: 'image/png' });

    const result = await uploadTaskAttachments('task-1', [f1, f2]);

    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(axiosClient.post).mock.calls[0];
    expect(url).toBe('/scheduling/task-1/attachments');
    expect(body).toBeInstanceOf(FormData);

    // The BE expects the files under the `photos` field — assert BOTH made it in
    // under that exact key (a wrong key would 400 NO_FILES at runtime).
    const photos = (body as FormData).getAll('photos');
    expect(photos).toHaveLength(2);
    expect((photos[0] as File).name).toBe('a.jpg');
    expect((photos[1] as File).name).toBe('b.png');

    // multipart content type so the BE's multer picks it up.
    expect((config as { headers?: Record<string, string> })?.headers?.['Content-Type'])
      .toBe('multipart/form-data');

    expect(result).toEqual([sample]);
  });

  it('deleteTaskAttachment DELETEs /scheduling/attachments/:id', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ status: 204 });

    await deleteTaskAttachment('att-1');

    expect(axiosClient.delete).toHaveBeenCalledWith('/scheduling/attachments/att-1');
  });
});
