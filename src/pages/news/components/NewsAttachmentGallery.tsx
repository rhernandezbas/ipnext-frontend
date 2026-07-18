import { useState } from 'react';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { formatFileSize } from '@/utils/formatFileSize';
import { safeHref } from '@/utils/safeUrl';
import type { NewsAttachment } from '@/types/news';
import styles from './NewsAttachmentGallery.module.css';

// ── Inline icons (SVG, never emoji — design-system rule) ──────────────────────

function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

interface NewsAttachmentGalleryProps {
  attachments: NewsAttachment[];
}

/**
 * NewsAttachmentGallery (N2-FE) — READ-ONLY view of a post's attachments, used
 * in the detail drawer. Images render in a grid (each opens `ImageLightbox`);
 * files (pdf/md) and links render as a labelled list. Link hrefs pass through
 * `safeHref` so a hostile `javascript:`/`data:` url never becomes a live anchor.
 */
export function NewsAttachmentGallery({ attachments }: NewsAttachmentGalleryProps) {
  const [lightbox, setLightbox] = useState<{ url: string; alt: string; opener: HTMLElement | null } | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === 'image');
  const others = attachments.filter((a) => a.kind !== 'image');

  function closeLightbox() {
    const opener = lightbox?.opener;
    setLightbox(null);
    if (opener) window.setTimeout(() => opener.focus(), 0);
  }

  return (
    <section className={styles.gallery} aria-label="Adjuntos">
      {images.length > 0 && (
        <ul className={styles.imageGrid} aria-label="Imágenes">
          {images.map((a) => {
            const alt = a.filename ?? 'Imagen adjunta';
            return (
              <li key={a.id} className={styles.imageTile}>
                <button
                  type="button"
                  className={styles.imageButton}
                  onClick={(e) => setLightbox({ url: a.fileUrl ?? '', alt, opener: e.currentTarget })}
                  aria-label={`Ver ${alt} en grande`}
                >
                  <img src={a.fileUrl ?? ''} alt={alt} loading="lazy" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {others.length > 0 && (
        <ul className={styles.fileList} aria-label="Archivos y enlaces">
          {others.map((a) => {
            const isLink = a.kind === 'link';
            const name = a.filename ?? (isLink ? a.url ?? 'Enlace' : 'Archivo');
            const href = isLink ? safeHref(a.url) : a.fileUrl;
            const size = formatFileSize(a.sizeBytes);
            const row = (
              <>
                <span className={styles.fileIcon} aria-hidden="true">
                  {isLink ? <IconLink /> : <IconFile />}
                </span>
                <span className={styles.fileName}>{name}</span>
                {size && <span className={styles.fileSize}>{size}</span>}
              </>
            );
            return (
              <li key={a.id} className={styles.fileItem}>
                {href ? (
                  <a
                    className={styles.fileRow}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    {...(isLink ? {} : { download: name })}
                  >
                    {row}
                  </a>
                ) : (
                  // Unsafe/missing href → render as a non-interactive row (no live anchor).
                  <span className={styles.fileRow}>{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lightbox && <ImageLightbox url={lightbox.url} alt={lightbox.alt} onClose={closeLightbox} />}
    </section>
  );
}
