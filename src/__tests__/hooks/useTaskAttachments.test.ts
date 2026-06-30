/**
 * useTaskAttachments hooks — query + mutations.
 * Strict TDD: written BEFORE the implementation.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/taskAttachments.api', () => ({
  listTaskAttachments: vi.fn(),
  uploadTaskAttachments: vi.fn(),
  deleteTaskAttachment: vi.fn(),
}));

import * as api from '@/api/taskAttachments.api';
import {
  useTaskAttachments,
  useUploadTaskAttachments,
  useDeleteTaskAttachment,
} from '@/hooks/useTaskAttachments';
import type { TaskAttachment } from '@/types/taskAttachments';

const mockApi = api as unknown as {
  listTaskAttachments: ReturnType<typeof vi.fn>;
  uploadTaskAttachments: ReturnType<typeof vi.fn>;
  deleteTaskAttachment: ReturnType<typeof vi.fn>;
};

function att(id: string): TaskAttachment {
  return {
    id,
    taskId: 'task-1',
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1,
    width: null,
    height: null,
    uploadedById: 'u1',
    createdAt: '2026-06-01T00:00:00.000Z',
    fileUrl: `/api/scheduling/attachments/${id}/file`,
    thumbUrl: `/api/scheduling/attachments/${id}/file?variant=thumb`,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  };
}

describe('useTaskAttachments hooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useTaskAttachments queries the api with the taskId', async () => {
    const { wrapper } = makeWrapper();
    mockApi.listTaskAttachments.mockResolvedValue([att('a1')]);

    const { result } = renderHook(() => useTaskAttachments('task-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.listTaskAttachments).toHaveBeenCalledWith('task-1');
    expect(result.current.data).toEqual([att('a1')]);
  });

  it('useTaskAttachments is disabled (no fetch) when taskId is empty', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useTaskAttachments(''), { wrapper });
    expect(mockApi.listTaskAttachments).not.toHaveBeenCalled();
  });

  it('useUploadTaskAttachments calls the api and invalidates the attachments query', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    mockApi.uploadTaskAttachments.mockResolvedValue([att('a2')]);

    const { result } = renderHook(() => useUploadTaskAttachments(), { wrapper });

    const files = [new File(['x'], 'x.jpg', { type: 'image/jpeg' })];
    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', files });
    });

    expect(mockApi.uploadTaskAttachments).toHaveBeenCalledWith('task-1', files);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['task-attachments', 'task-1'] }),
      );
    });
  });

  it('useDeleteTaskAttachment calls the api and invalidates the attachments query', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    mockApi.deleteTaskAttachment.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteTaskAttachment('task-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('att-9');
    });

    expect(mockApi.deleteTaskAttachment).toHaveBeenCalledWith('att-9');
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['task-attachments', 'task-1'] }),
      );
    });
  });
});
