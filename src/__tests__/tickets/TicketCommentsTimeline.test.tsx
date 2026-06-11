import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuthUser } from '@/types/auth';
import type { TicketComment } from '@/types/ticketComments';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useTicketComments');
vi.mock('@/hooks/useMyPermissions');

import * as useAuthModule from '@/hooks/useAuth';
import * as useTicketCommentsModule from '@/hooks/useTicketComments';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';

import { TicketCommentsTimeline } from '@/pages/tickets/TicketDetailPage/components/TicketCommentsTimeline';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockAddMutateAsync = vi.fn();
const mockRefetch = vi.fn();
const MAX_IMAGES_FOR_TEST = 3;

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

function setComments(comments: TicketComment[]) {
  vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({
    data: comments,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
}

function setCommentsError() {
  vi.mocked(useTicketCommentsModule.useTicketComments).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useTicketComments>);
}

function setMutations(opts?: { addPending?: boolean }) {
  vi.mocked(useTicketCommentsModule.useAddTicketComment).mockReturnValue({
    mutateAsync: mockAddMutateAsync,
    isPending: opts?.addPending ?? false,
  } as unknown as ReturnType<typeof useTicketCommentsModule.useAddTicketComment>);
}

function setCanWrite(canWrite: boolean) {
  vi.mocked(useMyPermissionsModule.useCan).mockReturnValue(canWrite);
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

/** Build a fake image File of an approximate byte size. */
function makeImageFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

/**
 * Legacy/jsdom-friendly paste shape: `clipboardData.files` is populated and
 * `items` is empty. This is NOT what Chrome/Safari deliver for a screenshot.
 */
function pasteFiles(textarea: HTMLElement, files: File[]) {
  fireEvent.paste(textarea, {
    clipboardData: { files, items: [], getData: () => '' },
  });
}

/**
 * Real-browser paste shape: a screenshot arrives in `clipboardData.items` with
 * `kind: 'file'` and `getAsFile()`, while `clipboardData.files` is EMPTY.
 * `text` (optional) simulates plain text pasted alongside the image.
 */
function pasteItems(textarea: HTMLElement, files: File[], text = '') {
  const items = files.map((f) => ({
    kind: 'file' as const,
    type: f.type,
    getAsFile: () => f,
  }));
  if (text) {
    items.push({
      kind: 'string' as unknown as 'file',
      type: 'text/plain',
      getAsFile: () => null as unknown as File,
    });
  }
  fireEvent.paste(textarea, {
    clipboardData: {
      files: [] as unknown as FileList,
      items,
      getData: () => text,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddMutateAsync.mockReset();
  mockAddMutateAsync.mockResolvedValue(undefined);
  mockRefetch.mockReset();
  setComments([]);
  setMutations();
  setAuthUser(fullUser());
  setCanWrite(true);
});

// ── Paste → chip ────────────────────────────────────────────────────────────

describe('TicketCommentsTimeline — paste', () => {
  it('pasting an image file adds a preview chip', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    pasteFiles(textarea, [makeImageFile('shot.png', 'image/png', 1024)]);

    await waitFor(() =>
      expect(screen.getByText('shot.png')).toBeInTheDocument(),
    );
  });

  it('pasting a non-image (PDF) shows the type error and adds no chip', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    pasteFiles(textarea, [makeImageFile('doc.pdf', 'application/pdf', 1024)]);

    await waitFor(() =>
      expect(screen.getByText(/Solo se aceptan imágenes/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('doc.pdf')).not.toBeInTheDocument();
  });

  // Fix #1/#2: real browsers deliver pasted screenshots via clipboardData.items
  // (kind 'file'), with clipboardData.files EMPTY. This is the honest shape.
  it('pasting an image via clipboardData.items (files empty) adds a chip', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    pasteItems(textarea, [makeImageFile('clip.png', 'image/png', 1024)]);

    await waitFor(() =>
      expect(screen.getByText('clip.png')).toBeInTheDocument(),
    );
  });

  it('pasting plain text (no image) lets the text land — no preventDefault, no chip', () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    const evt = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'clipboardData', {
      value: { files: [], items: [], getData: () => 'hello' },
    });
    fireEvent(textarea, evt);
    expect(evt.defaultPrevented).toBe(false);
    expect(screen.queryByRole('list', { name: /Imágenes pendientes/i })).not.toBeInTheDocument();
  });

  it('pasting image + text via items attaches the image', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    pasteItems(textarea, [makeImageFile('mix.png', 'image/png', 1024)], 'some caption');

    await waitFor(() =>
      expect(screen.getByText('mix.png')).toBeInTheDocument(),
    );
  });
});

// ── Client-side validation ────────────────────────────────────────────────────

describe('TicketCommentsTimeline — client-side validation', () => {
  it('rejects an image > 2MB with the spec message', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    const big = makeImageFile('big.png', 'image/png', 3 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [big] } });

    await waitFor(() =>
      expect(screen.getByText(/La imagen supera el límite de 2MB/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('big.png')).not.toBeInTheDocument();
  });

  it('rejects a 4th image with the spec message', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeImageFile('a.png', 'image/png', 100),
          makeImageFile('b.png', 'image/png', 100),
          makeImageFile('c.png', 'image/png', 100),
        ],
      },
    });
    await waitFor(() => expect(screen.getByText('c.png')).toBeInTheDocument());

    fireEvent.change(input, {
      target: { files: [makeImageFile('d.png', 'image/png', 100)] },
    });
    await waitFor(() =>
      expect(screen.getByText(/Máximo 3 imágenes por comentario/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('d.png')).not.toBeInTheDocument();
  });

  it('rejects a non-image file selected via the file input', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeImageFile('notes.txt', 'text/plain', 100)] },
    });
    await waitFor(() =>
      expect(screen.getByText(/Solo se aceptan imágenes/i)).toBeInTheDocument(),
    );
  });
});

// ── Submit payload shape ──────────────────────────────────────────────────────

describe('TicketCommentsTimeline — submit', () => {
  it('submit button is disabled when body empty and no attachments', () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const submit = screen.getByRole('button', { name: /Comentar|Agregar comentario/i });
    expect(submit).toBeDisabled();
  });

  it('submits body-only with authorName from displayName and empty attachments', async () => {
    const user = userEvent.setup();
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    await user.type(screen.getByPlaceholderText(/Escribí un comentario/i), 'Hola');
    await user.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    expect(mockAddMutateAsync).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      body: 'Hola',
      authorName: 'Ana Pérez',
      attachments: [],
    });
  });

  it('submits a pasted image as a data-URI attachment with size + mime', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    pasteFiles(textarea, [makeImageFile('shot.png', 'image/png', 512)]);
    await waitFor(() => expect(screen.getByText('shot.png')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Comentar|Agregar comentario/i }));

    await waitFor(() => expect(mockAddMutateAsync).toHaveBeenCalledTimes(1));
    const payload = mockAddMutateAsync.mock.calls[0]![0];
    expect(payload.ticketId).toBe('ticket-1');
    expect(payload.authorName).toBe('Ana Pérez');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe('shot.png');
    expect(payload.attachments[0].mimeType).toBe('image/png');
    expect(payload.attachments[0].url).toMatch(/^data:image\/png;base64,/);
    expect(typeof payload.attachments[0].sizeBytes).toBe('number');
  });

  it('removing a pending preview drops it before submit', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeImageFile('keep.png', 'image/png', 100),
          makeImageFile('drop.png', 'image/png', 100),
        ],
      },
    });
    await waitFor(() => expect(screen.getByText('drop.png')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: /Quitar adjunto drop.png/i }));
    expect(screen.queryByText('drop.png')).not.toBeInTheDocument();
    expect(screen.getByText('keep.png')).toBeInTheDocument();
  });
});

// ── Permissions ───────────────────────────────────────────────────────────────

describe('TicketCommentsTimeline — permissions', () => {
  it('hides the composer when the user lacks tickets.write but shows the timeline', () => {
    setCanWrite(false);
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Bob',
        body: 'Comentario existente',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.getByText('Comentario existente')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Escribí un comentario/i)).not.toBeInTheDocument();
  });
});

// ── data-URI image rendering (D8) ─────────────────────────────────────────────

describe('TicketCommentsTimeline — data-URI attachments', () => {
  const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANS';

  it('renders a data-URI attachment as an <img> thumbnail (not a link)', () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [
          { id: 'a1', commentId: 'c1', url: dataUri, filename: 'pegada.png' },
        ],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const img = screen.getByAltText('pegada.png') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe(dataUri);
  });

  it('clicking a data-URI thumbnail opens the lightbox; Escape closes it', async () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [
          { id: 'a1', commentId: 'c1', url: dataUri, filename: 'pegada.png' },
        ],
      },
    ]);
    const user = userEvent.setup();
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    await user.click(screen.getByRole('button', { name: /Ver pegada\.png en grande/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText('pegada.png')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does NOT render a delete button on comments', () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: 'hola',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.queryByRole('button', { name: /Eliminar comentario/i })).not.toBeInTheDocument();
  });
});

// ── Error state + Reintentar (Fix #3) ─────────────────────────────────────────

describe('TicketCommentsTimeline — load error', () => {
  it('shows an error message and a Reintentar button when the query errored', () => {
    setCommentsError();
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.getByText(/No se pudieron cargar los comentarios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('clicking Reintentar calls refetch', async () => {
    setCommentsError();
    const user = userEvent.setup();
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    await user.click(screen.getByRole('button', { name: /Reintentar/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the composer usable while in error state', () => {
    setCommentsError();
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.getByPlaceholderText(/Escribí un comentario/i)).toBeInTheDocument();
  });
});

// ── Batch mixed errors (Fix #5) ───────────────────────────────────────────────

describe('TicketCommentsTimeline — batch mixed errors', () => {
  it('surfaces BOTH a PDF (type) and an oversized image error in one batch', async () => {
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const input = screen.getByLabelText(/Adjuntar imagen/i) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          makeImageFile('doc.pdf', 'application/pdf', 100),
          makeImageFile('big.png', 'image/png', 3 * 1024 * 1024),
          makeImageFile('ok.png', 'image/png', 100),
        ],
      },
    });
    await waitFor(() => expect(screen.getByText('ok.png')).toBeInTheDocument());
    expect(screen.getByText(/Solo se aceptan imágenes/i)).toBeInTheDocument();
    expect(screen.getByText(/La imagen supera el límite de 2MB/i)).toBeInTheDocument();
  });
});

// ── Race on the 3-image cap (Fix #4) ──────────────────────────────────────────

describe('TicketCommentsTimeline — cap race', () => {
  it('two rapid pastes of 2 images each never exceed the 3-image cap', async () => {
    // Control FileReader timing so both addFiles() calls run with the SAME stale
    // attachments.length (0) before any state has committed. A naive implementation
    // that reads attachments.length from the closure would let all 4 through.
    const pending: Array<() => void> = [];
    const RealFileReader = globalThis.FileReader;

    class ControlledFileReader {
      result: string | null = null;
      error: unknown = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(file: File) {
        pending.push(() => {
          this.result = `data:${file.type};base64,AAAA`;
          this.onload?.();
        });
      }
    }
    // @ts-expect-error test override
    globalThis.FileReader = ControlledFileReader;

    try {
      render(<TicketCommentsTimeline ticketId="ticket-1" />);
      const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);

      // Two overlapping pastes, 2 images each = 4 total → cap must hold at 3.
      pasteItems(textarea, [
        makeImageFile('p1a.png', 'image/png', 100),
        makeImageFile('p1b.png', 'image/png', 100),
      ]);
      pasteItems(textarea, [
        makeImageFile('p2a.png', 'image/png', 100),
        makeImageFile('p2b.png', 'image/png', 100),
      ]);

      // readAsDataURL suspends each addFiles loop until its read resolves, so
      // reads surface incrementally. Drain them until both batches finish.
      // The two calls share the same stale attachments.length (0); only a
      // race-safe reservation keeps the committed total at the 3-image cap.
      for (let guard = 0; guard < 20 && pending.length > 0; guard++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          const fn = pending.shift()!;
          fn();
          await Promise.resolve();
          await Promise.resolve();
        });
      }

      await waitFor(() => {
        const list = screen.queryByRole('list', { name: /Imágenes pendientes/i });
        expect(list).toBeInTheDocument();
      });
      const chips = screen.getAllByRole('listitem');
      expect(chips.length).toBeLessThanOrEqual(MAX_IMAGES_FOR_TEST);
      // And the cap message must have surfaced for the rejected image.
      expect(screen.getByText(/Máximo 3 imágenes por comentario/i)).toBeInTheDocument();
    } finally {
      globalThis.FileReader = RealFileReader;
    }
  });
});

// ── Anchor scheme allowlist (Fix #6) ──────────────────────────────────────────

describe('TicketCommentsTimeline — attachment scheme allowlist', () => {
  it('renders an https attachment URL as a link', () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [
          { id: 'a1', commentId: 'c1', url: 'https://cdn.example.com/file.pdf', filename: 'file.pdf' },
        ],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    const link = screen.getByRole('link', { name: /file\.pdf/i });
    expect(link).toHaveAttribute('href', 'https://cdn.example.com/file.pdf');
  });

  it('does NOT render a link for a javascript: URL — plain filename text only', () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [
          { id: 'a1', commentId: 'c1', url: 'javascript:alert(1)', filename: 'evil.pdf' },
        ],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.queryByRole('link', { name: /evil\.pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText('evil.pdf')).toBeInTheDocument();
  });

  it('does NOT render a link for a data:text/html URL — plain filename text only', () => {
    setComments([
      {
        id: 'c1',
        ticketId: 'ticket-1',
        authorName: 'Ana',
        body: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        attachments: [
          { id: 'a1', commentId: 'c1', url: 'data:text/html,<script>1</script>', filename: 'x.html' },
        ],
      },
    ]);
    render(<TicketCommentsTimeline ticketId="ticket-1" />);
    expect(screen.queryByRole('link', { name: /x\.html/i })).not.toBeInTheDocument();
    expect(screen.getByText('x.html')).toBeInTheDocument();
  });
});
