import { useEffect, useRef, useState } from 'react';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { IconImageOff } from './mediaIcons';
import type { WhatsappChatMessageAttachment } from '@/types/whatsapp';
import styles from './Media.module.css';

interface MediaImageProps {
  attachment: WhatsappChatMessageAttachment;
}

/**
 * MediaImage — hoja `fileType==='image'` ya `downloaded` (design §3.1).
 * `<img src>` (thumb -> lightbox con el original) solo se monta si
 * `status==='downloaded'` — regresión del 409 (spec §1: setear `src` en
 * `pending` pega al endpoint de servido por cada poll y responde 409 sin
 * motivo). Blur-up al `onLoad` (§7.1); `onError` cae a un estado roto local
 * (mismo criterio que `Tile` de `TaskPhotosGallery`), cubre el edge del
 * 409-race (DTO dice `downloaded` pero el binario aún no está).
 */
export function MediaImage({ attachment }: MediaImageProps) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const alt = attachment.filename ?? 'Imagen adjunta';
  const ready = attachment.status === 'downloaded';
  const src = ready ? (attachment.thumbUrl ?? attachment.url) : undefined;
  const ar = attachment.width && attachment.height ? `${attachment.width} / ${attachment.height}` : '4 / 3';

  // Fix bug LOW #7 (post-review-adversarial): una imagen SERVIDA DESDE CACHÉ
  // dispara el evento `load` del navegador ANTES de que React ate el handler
  // `onLoad` (el <img> nace con el `src` ya puesto) — sin este check, el
  // blur-up nunca completaba y la imagen quedaba invisible (opacity:0) para
  // siempre. `img.complete && naturalWidth>0` confirma que YA cargó aunque el
  // evento se haya perdido.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-chequear cuando cambia el src servido (thumb/imagen distinta), no en cada render.
  }, [src]);

  function openLightbox() {
    if (ready) setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={styles.mediaImageWrapper}
        style={{ '--media-ar': ar } as React.CSSProperties}
        onClick={openLightbox}
        aria-label={`Ver ${alt} en grande`}
      >
        {broken ? (
          <div className={styles.mediaImageBroken}>
            <IconImageOff />
            No se pudo mostrar
          </div>
        ) : (
          src && (
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              data-loaded={loaded ? 'true' : 'false'}
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
            />
          )
        )}
      </button>

      {lightboxOpen && (
        <ImageLightbox url={attachment.url} alt={alt} onClose={closeLightbox} />
      )}
    </>
  );
}
