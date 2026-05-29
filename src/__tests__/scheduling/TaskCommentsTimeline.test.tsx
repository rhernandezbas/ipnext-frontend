import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuthUser } from '@/types/auth';
import type { TaskComment } from '@/types/taskComments';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTaskComments');

import * as useAuthModule from '@/hooks/useAuth';
import * as useTaskCommentsModule from '@/hooks/useTaskComments';

import { TaskCommentsTimeline } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskCommentsTimeline';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockAddMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

interface UseAuthShape {
  user: AuthUser | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

function setAuthUser(user: AuthUser | null) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  } as UseAuthShape);
}

function setComments(comments: TaskComment[]) {
  vi.mocked(useTaskCommentsModule.useTaskComments).mockReturnValue({
    data: comments,
    isLoading: false,
  } as ReturnType<typeof useTaskCommentsModule.useTaskComments>);
}

function setMutations(opts?: { addPending?: boolean; deletePending?: boolean }) {
  vi.mocked(useTaskCommentsModule.useAddTaskComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync,
    isPending: opts?.addPending ?? false,
  } as unknown as ReturnType<typeof useTaskCommentsModule.useAddTaskComment>);

  vi.mocked(useTaskCommentsModule.useDeleteTaskComment).mockReturnValue({
    mutateAsync: mockDeleteMutateAsync,
    isPending: opts?.deletePending ?? false,
  } as unknown as ReturnType<typeof useTaskCommentsModule.useDeleteTaskComment>);
}

function fullUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    username: 'anap',
    email: 'ana@example.com',
    displayName: 'Ana Pérez',
    role: 'admin',
    permissions: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddMutateAsync.mockReset();
  mockAddMutateAsync.mockResolvedValue(undefined);
  mockDeleteMutateAsync.mockReset();
  mockDeleteMutateAsync.mockResolvedValue(undefined);
  setComments([]);
  setMutations();
  setAuthUser(fullUser());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskCommentsTimeline — composer', () => {
  it('does NOT render an Autor input field', () => {
    render(<TaskCommentsTimeline taskId="task-1" />);
    expect(screen.queryByLabelText(/Nombre del autor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Autor$/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Tu nombre/i)).not.toBeInTheDocument();
  });

  it('submit button is disabled when body is empty and no attachments', () => {
    render(<TaskCommentsTimeline taskId="task-1" />);
    const submit = screen.getByRole('button', { name: /Comentar|Agregar comentario/i });
    expect(submit).toBeDisabled();
  });

  it('submit calls mutateAsync with authorName derived from user.displayName', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'Llegó el equipo.');
    await user.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    expect(mockAddMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockAddMutateAsync).toHaveBeenCalledWith({
      taskId: 'task-1',
      body: 'Llegó el equipo.',
      authorName: 'Ana Pérez',
      attachments: [],
    });
  });

  it('falls back to username when displayName is empty', async () => {
    setAuthUser(fullUser({ displayName: '' }));
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'OK');
    await user.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: 'anap' }),
    );
  });

  it('falls back to email when displayName and username are empty', async () => {
    setAuthUser(fullUser({ displayName: '', username: '' }));
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'hi');
    await user.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: 'ana@example.com' }),
    );
  });

  it('when user is null shows login prompt and does NOT render submit button', () => {
    setAuthUser(null);
    render(<TaskCommentsTimeline taskId="task-1" />);
    expect(screen.getByText(/Iniciá sesión para comentar/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Comentar|Agregar comentario/i }),
    ).not.toBeInTheDocument();
  });
});

describe('TaskCommentsTimeline — attachments composer', () => {
  it('clicking "Adjuntar URL" reveals the URL row', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    expect(screen.queryByLabelText(/URL del adjunto/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Adjuntar URL/i }));
    expect(screen.getByLabelText(/URL del adjunto/i)).toBeInTheDocument();
  });

  it('submitting with one attachment sends it in the payload', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'Mirá la foto.');
    await user.click(screen.getByRole('button', { name: /Adjuntar URL/i }));

    await user.type(
      screen.getByLabelText(/URL del adjunto/i),
      'https://cdn.example.com/cable-roto.jpg',
    );
    await user.click(screen.getByRole('button', { name: /Agregar adjunto al borrador/i }));

    await user.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith({
      taskId: 'task-1',
      body: 'Mirá la foto.',
      authorName: 'Ana Pérez',
      attachments: [
        { url: 'https://cdn.example.com/cable-roto.jpg', filename: 'cable-roto.jpg' },
      ],
    });
  });

  it('body-only is allowed and body OR attachment enables submit', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    const submit = screen.getByRole('button', { name: /Comentar|Agregar comentario/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'Sin foto');
    expect(submit).toBeEnabled();
  });

  it('attachment-only (no body) is allowed', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.click(screen.getByRole('button', { name: /Adjuntar URL/i }));
    await user.type(
      screen.getByLabelText(/URL del adjunto/i),
      'https://cdn.example.com/foto.png',
    );
    await user.click(screen.getByRole('button', { name: /Agregar adjunto al borrador/i }));

    const submit = screen.getByRole('button', { name: /Comentar|Agregar comentario/i });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(mockAddMutateAsync).toHaveBeenCalledWith({
      taskId: 'task-1',
      body: '',
      authorName: 'Ana Pérez',
      attachments: [{ url: 'https://cdn.example.com/foto.png', filename: 'foto.png' }],
    });
  });

  it('shows pending attachment chip after adding a URL', async () => {
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.click(screen.getByRole('button', { name: /Adjuntar URL/i }));
    await user.type(
      screen.getByLabelText(/URL del adjunto/i),
      'https://cdn.example.com/foto.png',
    );
    await user.click(screen.getByRole('button', { name: /Agregar adjunto al borrador/i }));

    expect(screen.getByText('foto.png')).toBeInTheDocument();
  });
});

describe('TaskCommentsTimeline — rendering existing comments', () => {
  const baseComment = {
    id: 'c1',
    taskId: 'task-1',
    authorName: 'Ana Pérez',
    body: 'Llegó el equipo.',
    createdAt: '2026-05-28T12:00:00.000Z',
  };

  it('renders comment author, body and time', () => {
    setComments([{ ...baseComment, attachments: [] }]);
    render(<TaskCommentsTimeline taskId="task-1" />);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Llegó el equipo.')).toBeInTheDocument();
  });

  it('image URL attachment renders as <img> thumbnail', () => {
    setComments([
      {
        ...baseComment,
        attachments: [
          {
            id: 'a1',
            commentId: 'c1',
            url: 'https://cdn.example.com/photo.JPG',
            filename: 'photo.JPG',
          },
        ],
      },
    ]);
    render(<TaskCommentsTimeline taskId="task-1" />);
    const img = screen.getByAltText('photo.JPG') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/photo.JPG');
  });

  it('non-image URL attachment renders as a link chip, not an <img>', () => {
    setComments([
      {
        ...baseComment,
        attachments: [
          {
            id: 'a1',
            commentId: 'c1',
            url: 'https://docs.example.com/manual.pdf',
            filename: 'manual.pdf',
          },
        ],
      },
    ]);
    render(<TaskCommentsTimeline taskId="task-1" />);
    expect(screen.queryByAltText('manual.pdf')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /manual.pdf/i });
    expect(link).toHaveAttribute('href', 'https://docs.example.com/manual.pdf');
  });

  it('image URL with query suffix is detected as image', () => {
    setComments([
      {
        ...baseComment,
        attachments: [
          {
            id: 'a1',
            commentId: 'c1',
            url: 'https://cdn.example.com/photo.webp?v=2',
            filename: 'photo.webp',
          },
        ],
      },
    ]);
    render(<TaskCommentsTimeline taskId="task-1" />);
    expect(screen.getByAltText('photo.webp')).toBeInTheDocument();
  });

  it('broken image (onError) falls back to a link chip', () => {
    setComments([
      {
        ...baseComment,
        attachments: [
          {
            id: 'a1',
            commentId: 'c1',
            url: 'https://broken.example.com/x.png',
            filename: 'x.png',
          },
        ],
      },
    ]);
    render(<TaskCommentsTimeline taskId="task-1" />);

    const img = screen.getByAltText('x.png') as HTMLImageElement;
    fireEvent.error(img);

    // After onError the img should be gone, replaced by a link chip.
    expect(screen.queryByAltText('x.png')).not.toBeInTheDocument();
    const link = screen.getByRole('link', { name: /x\.png/ });
    expect(link).toHaveAttribute('href', 'https://broken.example.com/x.png');
  });

  it('clicking image thumbnail opens lightbox dialog; Escape closes it', async () => {
    setComments([
      {
        ...baseComment,
        attachments: [
          {
            id: 'a1',
            commentId: 'c1',
            url: 'https://cdn.example.com/photo.jpg',
            filename: 'photo.jpg',
          },
        ],
      },
    ]);

    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);

    await user.click(screen.getByRole('button', { name: /Ver photo\.jpg en grande/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const lightboxImg = within(dialog).getByAltText('photo.jpg');
    expect(lightboxImg).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('delete button calls mutateAsync(commentId)', async () => {
    setComments([{ ...baseComment, attachments: [] }]);
    const user = userEvent.setup();
    render(<TaskCommentsTimeline taskId="task-1" />);
    await user.click(screen.getByRole('button', { name: /Eliminar comentario de Ana Pérez/i }));
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('c1');
  });
});
