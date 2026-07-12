import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImageLightbox.module.css';

export interface ImageLightboxProps {
  url: string;
  alt: string;
  onClose: () => void;
}

// ── Inline icon (SVG, never emoji — design-system rule) ──────────────────────

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * ImageLightbox — extraído de `TaskPhotosGallery.tsx` (`function Lightbox`,
 * messaging-inbox-v2-media F1.5 fase A, design §4). API idéntica a la
 * versión embebida: `{ url, alt, onClose }`. Consumido por `TaskPhotosGallery`
 * (fotos de tareas) y por `MediaImage` (media entrante del inbox de
 * WhatsApp) — un solo focus-trap/portal/fallback en vez de dos copias que
 * divergen.
 *
 * La restauración de foco al opener (guardar el elemento que abrió el
 * lightbox y re-enfocarlo al cerrar) queda a propósito en el CONSUMIDOR (como
 * ya hacía `TaskPhotosGallery`) — no en este componente — para no cambiar el
 * contrato actual (design §4, tradeoff documentado).
 */
export function ImageLightbox({ url, alt, onClose }: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: keep Tab inside the dialog so keyboard focus can't escape to
      // the page behind (otherwise aria-modal is a lie). The lightbox holds a
      // single focusable (the close button), so Tab/Shift+Tab cycle onto it.
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      className={styles.lightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada de ${alt}`}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className={styles.lightboxClose}
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
      >
        <IconClose />
      </button>
      {broken ? (
        <div
          className={styles.lightboxBroken}
          role="img"
          aria-label={alt}
          onClick={(e) => e.stopPropagation()}
        >
          No se pudo cargar la imagen.
        </div>
      ) : (
        <img
          className={styles.lightboxImage}
          src={url}
          alt={alt}
          onError={() => setBroken(true)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body,
  );
}
