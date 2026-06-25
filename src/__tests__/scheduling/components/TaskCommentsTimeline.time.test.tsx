/**
 * Fase 2a — TaskCommentsTimeline renders each comment's createdAt in Argentina
 * time via the canonical formatDateTimeShort, deterministically across host TZ.
 *
 * Bug: the local formatDate() used Intl.DateTimeFormat('es-AR', …) WITHOUT a
 * timeZone, so a UTC environment showed the raw UTC time. Now it delegates to the
 * canonical formatter ("DD mmm YYYY - HH:MM", AR time).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { TaskCommentsTimeline } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline';
import * as useTaskCommentsModule from '@/hooks/useTaskComments';
import * as useAuthModule from '@/hooks/useAuth';
import type { TaskComment } from '@/types/taskComments';

vi.mock('@/hooks/useTaskComments');
vi.mock('@/hooks/useAuth');

const COMMENT: TaskComment = {
  id: 'c1',
  taskId: 't1',
  authorName: 'María González',
  body: 'Listo, revisado.',
  // 02:07Z Jun 25 → 23:07 AR Jun 24 (the exact "Errores de auth" bug shape).
  createdAt: '2026-06-25T02:07:00.000Z',
  attachments: [],
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(useTaskCommentsModule.useTaskComments).mockReturnValue({
    data: [COMMENT],
    isLoading: false,
  } as ReturnType<typeof useTaskCommentsModule.useTaskComments>);

  const noopMutation = {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useTaskCommentsModule.useAddTaskComment>;

  vi.mocked(useTaskCommentsModule.useAddTaskComment).mockReturnValue(noopMutation);
  vi.mocked(useTaskCommentsModule.useDeleteTaskComment).mockReturnValue(noopMutation);

  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: 'u1', displayName: 'Admin', username: 'admin', email: 'a@b.c' },
  } as ReturnType<typeof useAuthModule.useAuth>);
});

describe('TaskCommentsTimeline — comment date in Argentina time (REQ-TZ-DISPLAY)', () => {
  it('renders the comment timestamp in AR time, crossing back to the prior day', () => {
    render(React.createElement(TaskCommentsTimeline, { taskId: 't1' }));
    // 02:07Z Jun 25 → 23:07 AR Jun 24.
    expect(screen.getByText('24 jun 2026 - 23:07')).toBeInTheDocument();
  });

  it('the <time> element keeps the raw ISO in dateTime but shows AR wall-clock', () => {
    render(React.createElement(TaskCommentsTimeline, { taskId: 't1' }));
    const timeEl = screen.getByText('24 jun 2026 - 23:07');
    expect(timeEl.tagName.toLowerCase()).toBe('time');
    expect(timeEl.getAttribute('datetime')).toBe('2026-06-25T02:07:00.000Z');
  });
});
