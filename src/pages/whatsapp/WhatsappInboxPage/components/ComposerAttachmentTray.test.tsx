/**
 * ComposerAttachmentTray — grid horizontal scrollable de chips
 * (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR, design §5.2).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { ComposerAttachmentTray } from './ComposerAttachmentTray';
import type { DraftAttachment } from '@/types/whatsapp';

function makeDraft(id: string, name: string): DraftAttachment {
  return {
    id,
    file: new File(['x'], name, { type: 'image/jpeg' }),
    fileType: 'image',
    previewUrl: `blob:${id}`,
    error: null,
  };
}

describe('ComposerAttachmentTray', () => {
  it('role=list con un item por draft, aria-label incluye la cantidad', () => {
    const drafts = [makeDraft('d1', 'a.jpg'), makeDraft('d2', 'b.jpg')];
    render(<ComposerAttachmentTray drafts={drafts} onRemove={vi.fn()} />);

    const list = screen.getByRole('list', { name: /archivos adjuntos \(2\)/i });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('quitar un item específico llama a onRemove con SU id', async () => {
    const onRemove = vi.fn();
    const drafts = [makeDraft('d1', 'a.jpg'), makeDraft('d2', 'b.jpg')];
    render(<ComposerAttachmentTray drafts={drafts} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar b\.jpg/i }));

    expect(onRemove).toHaveBeenCalledWith('d2');
  });

  it('con 0 drafts no renderiza nada (el padre ya lo gatea, pero es seguro por las dudas)', () => {
    const { container } = render(<ComposerAttachmentTray drafts={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ComposerAttachmentTray — bug CRÍTICO #3 (foco no se pierde a document.body al quitar)', () => {
  function StatefulTray({ initial, onEmptied }: { initial: DraftAttachment[]; onEmptied?: () => void }) {
    const [items, setItems] = useState(initial);
    return (
      <ComposerAttachmentTray
        drafts={items}
        onRemove={(id: string) => setItems((prev) => prev.filter((d) => d.id !== id))}
        onEmptied={onEmptied}
      />
    );
  }

  it('quitar un chip que NO es el último mueve el foco al remove-button del chip que ocupa su lugar', async () => {
    const drafts = [makeDraft('d1', 'a.jpg'), makeDraft('d2', 'b.jpg'), makeDraft('d3', 'c.jpg')];
    render(<StatefulTray initial={drafts} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar a\.jpg/i }));

    expect(screen.getByRole('button', { name: /quitar b\.jpg/i })).toHaveFocus();
  });

  it('quitar el ÚLTIMO chip llama a onEmptied (el padre decide a dónde va el foco — ej. el botón "adjuntar")', async () => {
    const onEmptied = vi.fn();
    const drafts = [makeDraft('d1', 'a.jpg')];
    render(<StatefulTray initial={drafts} onEmptied={onEmptied} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar a\.jpg/i }));

    expect(onEmptied).toHaveBeenCalledTimes(1);
  });
});

describe('ComposerAttachmentTray — bug ALTO #7 (stagger --i, como MediaAttachments Tanda 1)', () => {
  it('cada chip recibe --i = su índice 0-based', () => {
    const drafts = [makeDraft('d1', 'a.jpg'), makeDraft('d2', 'b.jpg'), makeDraft('d3', 'c.jpg')];
    const { container } = render(<ComposerAttachmentTray drafts={drafts} onRemove={vi.fn()} />);
    const items = container.querySelectorAll('li');
    expect((items[0] as HTMLElement).style.getPropertyValue('--i')).toBe('0');
    expect((items[1] as HTMLElement).style.getPropertyValue('--i')).toBe('1');
    expect((items[2] as HTMLElement).style.getPropertyValue('--i')).toBe('2');
  });
});

describe('ComposerAttachmentTray — bug MEDIO #12 (live-announce de la cantidad de adjuntos)', () => {
  it('expone una región aria-live con el conteo (para que el cambio se anuncie, no solo el aria-label estático del <ul>)', () => {
    const drafts = [makeDraft('d1', 'a.jpg'), makeDraft('d2', 'b.jpg')];
    render(<ComposerAttachmentTray drafts={drafts} onRemove={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 archivos adjuntos');
  });

  it('singular cuando hay un solo archivo', () => {
    render(<ComposerAttachmentTray drafts={[makeDraft('d1', 'a.jpg')]} onRemove={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 archivo adjunto');
  });
});

describe('Composer.attachments.module.css — bug ALTO #7 (sin CSS muerto de .exiting)', () => {
  const cssPath = join(__dirname, 'Composer.attachments.module.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('.previewItem usa animation-delay con --i (stagger real)', () => {
    const block = css.slice(css.indexOf('.previewItem {'), css.indexOf('.previewItem.errored'));
    expect(block).toMatch(/animation-delay:\s*calc\(var\(--i,\s*0\)\s*\*\s*40ms\)/);
  });

  it('no queda ninguna regla ".exiting" muerta (nunca se aplicaba — remove() es síncrono)', () => {
    expect(css).not.toMatch(/\.exiting\s*[,{]/);
    expect(css).not.toMatch(/animation:\s*waAttachExit/);
  });

  it('.errorBanner usa el token de font-size (--font-size-xs), no un hardcode de 10px (nit #13a)', () => {
    const block = css.slice(css.indexOf('.errorBanner {'), css.indexOf('}', css.indexOf('.errorBanner {')));
    expect(block).toMatch(/font-size:\s*var\(--font-size-xs\)/);
    expect(block).not.toMatch(/font-size:\s*10px/);
  });
});
