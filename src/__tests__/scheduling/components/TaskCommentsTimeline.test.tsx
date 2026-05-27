import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TaskComment } from '@/types/taskComments';

// ── Mock the hooks ────────────────────────────────────────────────────────────
const noopMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
});

vi.mock('@/hooks/useTaskComments', () => ({
  useTaskComments: vi.fn(),
  useAddTaskComment: vi.fn(),
  useDeleteTaskComment: vi.fn(),
}));

import {
  useTaskComments,
  useAddTaskComment,
  useDeleteTaskComment,
} from '@/hooks/useTaskComments';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockComments: TaskComment[] = [
  {
    id: 'c1',
    taskId: 'task-1',
    authorName: 'Ana García',
    body: 'Revisé el nodo principal.',
    createdAt: '2026-05-20T10:00:00.000Z',
    attachments: [
      {
        id: 'a1',
        commentId: 'c1',
        url: 'https://example.com/foto.jpg',
        filename: 'foto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 12345,
      },
    ],
  },
  {
    id: 'c2',
    taskId: 'task-1',
    authorName: 'Pedro López',
    body: 'Confirmado por mi parte.',
    createdAt: '2026-05-21T15:30:00.000Z',
    attachments: [],
  },
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function setupMocks(overrides?: { comments?: TaskComment[]; isLoading?: boolean }) {
  vi.mocked(useTaskComments).mockReturnValue({
    data: overrides?.comments ?? mockComments,
    isLoading: overrides?.isLoading ?? false,
    isError: false,
    error: null,
  } as ReturnType<typeof useTaskComments>);

  vi.mocked(useAddTaskComment).mockReturnValue(noopMutation() as ReturnType<typeof useAddTaskComment>);
  vi.mocked(useDeleteTaskComment).mockReturnValue(noopMutation() as ReturnType<typeof useDeleteTaskComment>);
}

// Import component AFTER mocks
const { TaskCommentsTimeline } = await import(
  '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline'
);

describe('TaskCommentsTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section heading', async () => {
    setupMocks();
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /comentarios/i })).toBeInTheDocument();
    });
  });

  it('renders all comments with author and body', async () => {
    setupMocks();
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Ana García')).toBeInTheDocument();
      expect(screen.getByText('Revisé el nodo principal.')).toBeInTheDocument();
      expect(screen.getByText('Pedro López')).toBeInTheDocument();
      expect(screen.getByText('Confirmado por mi parte.')).toBeInTheDocument();
    });
  });

  it('renders attachment as a link with filename', async () => {
    setupMocks();
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /foto\.jpg/i });
      expect(link).toHaveAttribute('href', 'https://example.com/foto.jpg');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('shows empty state when no comments', async () => {
    setupMocks({ comments: [] });
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/sin comentarios/i)).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching', async () => {
    setupMocks({ isLoading: true, comments: undefined as unknown as TaskComment[] });
    vi.mocked(useTaskComments).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as ReturnType<typeof useTaskComments>);

    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('calls addComment mutation on form submit', async () => {
    setupMocks();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAddTaskComment).mockReturnValue({
      ...noopMutation(),
      mutateAsync,
    } as ReturnType<typeof useAddTaskComment>);

    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });

    await waitFor(() => screen.getByPlaceholderText(/escribí un comentario/i));

    await user.type(screen.getByPlaceholderText(/escribí un comentario/i), 'Nuevo comentario');
    await user.type(screen.getByLabelText(/nombre del autor/i), 'Juan');
    await user.click(screen.getByRole('button', { name: /agregar comentario/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Nuevo comentario',
          authorName: 'Juan',
          attachments: [],
        })
      );
    });
  });

  it('calls deleteComment mutation when delete button is clicked', async () => {
    setupMocks();
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteTaskComment).mockReturnValue({
      ...noopMutation(),
      mutateAsync,
    } as ReturnType<typeof useDeleteTaskComment>);

    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />, { wrapper: createWrapper() });

    await waitFor(() => screen.getAllByRole('button', { name: /eliminar comentario/i }));

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar comentario/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('c1');
    });
  });
});
