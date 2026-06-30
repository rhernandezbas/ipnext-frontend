/**
 * TaskPhotosGallery — gallery + lightbox + upload + delete, permission-gated.
 * Strict TDD: written BEFORE the implementation.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/taskAttachments.api', () => ({
  listTaskAttachments: vi.fn(),
  uploadTaskAttachments: vi.fn(),
  deleteTaskAttachment: vi.fn(),
}));

import * as api from '@/api/taskAttachments.api';
import { useCan } from '@/hooks/useMyPermissions';
import { TaskPhotosGallery } from '@/pages/scheduling/SchedulingTaskDetailPage/components/TaskPhotosGallery';
import type { TaskAttachment } from '@/types/taskAttachments';

const mockApi = api as unknown as {
  listTaskAttachments: ReturnType<typeof vi.fn>;
  uploadTaskAttachments: ReturnType<typeof vi.fn>;
  deleteTaskAttachment: ReturnType<typeof vi.fn>;
};

function att(id: string, filename = `${id}.jpg`): TaskAttachment {
  return {
    id,
    taskId: 'task-1',
    filename,
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    width: 800,
    height: 600,
    uploadedById: 'u1',
    createdAt: '2026-06-01T00:00:00.000Z',
    fileUrl: `/api/scheduling/attachments/${id}/file`,
    thumbUrl: `/api/scheduling/attachments/${id}/file?variant=thumb`,
  };
}

function renderGallery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(TaskPhotosGallery, { taskId: 'task-1' }),
    ),
  );
}

describe('TaskPhotosGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCan).mockReturnValue(true); // default: scheduling.write granted
  });

  it('renders a thumbnail per attachment, with thumbUrl src and filename alt', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg'), att('a2', 'medidor.jpg')]);
    renderGallery();

    const img1 = await screen.findByAltText('frente.jpg');
    const img2 = await screen.findByAltText('medidor.jpg');
    expect(img1).toHaveAttribute('src', '/api/scheduling/attachments/a1/file?variant=thumb');
    expect(img2).toHaveAttribute('src', '/api/scheduling/attachments/a2/file?variant=thumb');
    // lazy loading per the design-system checklist
    expect(img1).toHaveAttribute('loading', 'lazy');
  });

  it('shows an empty state when there are no photos', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([]);
    renderGallery();
    expect(await screen.findByText(/sin fotos/i)).toBeInTheDocument();
  });

  it('opens a lightbox with the ORIGINAL fileUrl on thumbnail click and closes on Escape', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg')]);
    renderGallery();

    const openBtn = await screen.findByRole('button', { name: /ver frente\.jpg/i });
    fireEvent.click(openBtn);

    const dialog = await screen.findByRole('dialog');
    const full = within(dialog).getByAltText('frente.jpg');
    expect(full).toHaveAttribute('src', '/api/scheduling/attachments/a1/file'); // original, no thumb

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('traps Tab inside the lightbox so focus cannot escape to the page behind', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg')]);
    renderGallery();

    fireEvent.click(await screen.findByRole('button', { name: /ver frente\.jpg/i }));
    const dialog = await screen.findByRole('dialog');
    const closeBtn = within(dialog).getByRole('button', { name: /cerrar vista ampliada/i });
    expect(closeBtn).toHaveFocus();

    // fireEvent returns false when the handler called preventDefault → the trap fired.
    const tabCancelled = fireEvent.keyDown(document, { key: 'Tab' }) === false;
    expect(tabCancelled).toBe(true);
    expect(closeBtn).toHaveFocus(); // focus stayed on the only focusable

    const shiftTabCancelled = fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }) === false;
    expect(shiftTabCancelled).toBe(true);
    expect(closeBtn).toHaveFocus();
  });

  it('shows a fallback when the lightbox image fails to load', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg')]);
    renderGallery();

    fireEvent.click(await screen.findByRole('button', { name: /ver frente\.jpg/i }));
    const dialog = await screen.findByRole('dialog');
    const full = within(dialog).getByAltText('frente.jpg');

    fireEvent.error(full);

    expect(within(dialog).getByText(/no se pudo cargar la imagen/i)).toBeInTheDocument();
  });

  it('uploads selected files to the task via the photos field', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([]);
    mockApi.uploadTaskAttachments.mockResolvedValue([att('a3')]);
    renderGallery();
    await screen.findByText(/sin fotos/i);

    const input = screen.getByTestId('gallery-file-input') as HTMLInputElement;
    const file = new File(['x'], 'nueva.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(mockApi.uploadTaskAttachments).toHaveBeenCalledWith('task-1', [file]),
    );
  });

  it('deletes a photo after confirmation', async () => {
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg')]);
    mockApi.deleteTaskAttachment.mockResolvedValue(undefined);
    renderGallery();

    const delBtn = await screen.findByRole('button', { name: /eliminar frente\.jpg/i });
    fireEvent.click(delBtn);

    // ConfirmContext is globally mocked to auto-resolve true (see test/setup.ts).
    await waitFor(() =>
      expect(mockApi.deleteTaskAttachment).toHaveBeenCalledWith('a1'),
    );
  });

  it('hides the upload and delete controls without scheduling.write', async () => {
    vi.mocked(useCan).mockReturnValue(false);
    mockApi.listTaskAttachments.mockResolvedValue([att('a1', 'frente.jpg')]);
    renderGallery();

    // The photo still renders (read is enough to view) …
    await screen.findByAltText('frente.jpg');
    // … but no upload trigger and no delete button.
    expect(screen.queryByRole('button', { name: /agregar fotos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar frente\.jpg/i })).not.toBeInTheDocument();
  });
});
