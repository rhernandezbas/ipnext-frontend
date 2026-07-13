/**
 * AttachmentPreviewItem — un chip del tray de adjuntos (messaging-inbox-v2-
 * media F1.5 fase A, Tanda 2 — ENVIAR, design §5.2). Presentacional puro.
 * FE-3 (design §11): imagen → `<img>` thumbnail; video/audio/file → tile
 * ícono+nombre (barato, robusto — nunca poster-frame de video).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AttachmentPreviewItem } from './AttachmentPreviewItem';
import type { DraftAttachment } from '@/types/whatsapp';

function makeDraft(overrides: Partial<DraftAttachment> = {}): DraftAttachment {
  return {
    id: 'd1',
    file: new File(['x'], overrides.file?.name ?? 'foto.jpg', { type: 'image/jpeg' }),
    fileType: 'image',
    previewUrl: 'blob:mock-1',
    error: null,
    ...overrides,
  };
}

describe('AttachmentPreviewItem — image', () => {
  it('renderiza un <img> con el previewUrl y alt = filename', () => {
    const draft = makeDraft({ fileType: 'image', previewUrl: 'blob:mock-1' });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'blob:mock-1');
  });
});

describe('AttachmentPreviewItem — video/audio/file → tile ícono+nombre', () => {
  it('video: NO renderiza <img>, muestra el nombre del archivo', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const draft = makeDraft({ fileType: 'video', file, previewUrl: null });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });

  it('audio: tile con nombre + tamaño formateado', () => {
    const file = new File(['x'], 'nota.ogg', { type: 'audio/ogg' });
    Object.defineProperty(file, 'size', { value: 2048 });
    const draft = makeDraft({ fileType: 'audio', file, previewUrl: null });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    expect(screen.getByText('nota.ogg')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('file (documento): tile con nombre, sin <img>', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const draft = makeDraft({ fileType: 'file', file, previewUrl: null });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });
});

describe('AttachmentPreviewItem — error de validación', () => {
  it('con error, muestra role=alert + el mensaje del error', () => {
    const draft = makeDraft({ error: { code: 'TOO_LARGE', message: 'Supera el límite de 5.0 MB para image.' } });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/supera el límite/i);
  });

  it('sin error, no hay ningún alert', () => {
    const draft = makeDraft({ error: null });
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('AttachmentPreviewItem — quitar', () => {
  it('el botón quitar tiene aria-label con el filename y dispara onRemove(id)', async () => {
    const onRemove = vi.fn();
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    const draft = makeDraft({ id: 'draft-9', file });
    render(<AttachmentPreviewItem draft={draft} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar foto\.jpg/i }));

    expect(onRemove).toHaveBeenCalledWith('draft-9');
  });
});

describe('AttachmentPreviewItem — bug CRÍTICO #3 (removeButtonRef, para restaurar foco tras quitar)', () => {
  it('expone el botón quitar vía removeButtonRef (para que el padre pueda re-enfocarlo)', () => {
    const draft = makeDraft();
    let btn: HTMLButtonElement | null = null;
    render(<AttachmentPreviewItem draft={draft} onRemove={vi.fn()} removeButtonRef={(el) => { btn = el; }} />);

    expect(btn).toBe(screen.getByRole('button', { name: /quitar/i }));
  });

  it('al desmontar, removeButtonRef se llama con null (limpieza normal de refs)', () => {
    const draft = makeDraft();
    const calls: (HTMLButtonElement | null)[] = [];
    const { unmount } = render(
      <AttachmentPreviewItem draft={draft} onRemove={vi.fn()} removeButtonRef={(el) => calls.push(el)} />,
    );
    unmount();

    expect(calls[calls.length - 1]).toBeNull();
  });
});

describe('AttachmentPreviewItem — bug ALTO #7 (stagger, style pass-through)', () => {
  it('aplica el `style` recibido (custom property --i para el stagger CSS)', () => {
    const draft = makeDraft();
    const { container } = render(
      <AttachmentPreviewItem draft={draft} onRemove={vi.fn()} style={{ '--i': 2 } as React.CSSProperties} />,
    );
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--i')).toBe('2');
  });
});
