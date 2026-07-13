import { useEffect, useRef, useState } from 'react';
import { deriveFileType, validateFile, MAX_FILES } from '@/utils/validateAttachment';
import type { DraftAttachment } from '@/types/whatsapp';

/**
 * useComposerAttachments (messaging-inbox-v2-media F1.5 fase A, Tanda 2 —
 * ENVIAR, design §2/§4.1) — estado local de los archivos elegidos en el
 * composer, ANTES de enviar. NO es react-query (no hay red acá): es dueño
 * del ciclo de vida de los `objectURL` (crea uno por draft — TODOS los tipos,
 * bug #10 — al agregar; lo revoca al quitar ese draft y revoca TODOS al
 * desmontar) — aísla el efecto-sucio `createObjectURL` del componente,
 * testeable sin leaks. `clear()` es la ÚNICA excepción: NO revoca (bug #10,
 * ver su doc comment) porque la propiedad de esos URLs pasa al pipeline de
 * envío en el momento en que `Composer.trySend` la llama.
 *
 * Archivos inválidos (type/size) se agregan IGUAL (con `error` seteado) para
 * que el tray los muestre y el agente pueda sacarlos — nunca se descartan en
 * silencio (§5.2). Exceder `MAX_FILES` recorta al tope y expone `feedback`
 * (mismo patrón `showFeedback` de `TaskPhotosGallery`) — tampoco se pierde
 * en silencio (design §5.1).
 */
function makeDraftId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}-${Math.random()}`;
}

export function useComposerAttachments() {
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const draftsRef = useRef<DraftAttachment[]>(drafts);
  draftsRef.current = drafts;

  function add(files: File[]) {
    // Bug ALTO #6 (post-review-adversarial): `URL.createObjectURL` es un
    // efecto sucio — NO puede vivir dentro del updater de `setDrafts`. React
    // StrictMode invoca dos veces las funciones pasadas a un setState (dev,
    // para detectar impurezas, ver https://react.dev/reference/react/StrictMode);
    // si `createObjectURL` corriera adentro, se crearían 2 URLs por draft y
    // solo la del 2do invoke queda en el estado commiteado — la del 1er
    // invoke nunca se revoca (leak). Acá el efecto corre UNA sola vez, ANTES
    // de llamar a `setDrafts`, que queda con un updater puro (`[...prev,
    // ...newDrafts]`, seguro de re-invocar).
    const room = MAX_FILES - draftsRef.current.length;
    const toAdd = files.slice(0, Math.max(0, room));

    if (files.length > room) {
      setFeedback(`Máximo ${MAX_FILES} archivos por mensaje. Se agregaron los primeros ${Math.max(0, room)}.`);
    }

    // Bug MEDIO/BAJO #10: se crea objectURL para TODOS los tipos (no solo
    // image/video) — la burbuja optimista de un envío en vuelo
    // (`toOptimisticMessage`, `MessageThread.tsx`) necesita un `url` real
    // también para audio/file, no un string vacío. El tray simplemente no lo
    // usa para preview en esos tipos (`AttachmentPreviewItem` solo pinta
    // `<img>` si `fileType==='image'`), así que esto es aditivo, cero cambio
    // visual en el composer.
    const newDrafts: DraftAttachment[] = toAdd.map((file) => ({
      id: makeDraftId(),
      file,
      fileType: deriveFileType(file.type),
      previewUrl: URL.createObjectURL(file),
      error: validateFile(file),
    }));

    setDrafts((prev) => [...prev, ...newDrafts]);
  }

  function remove(id: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  }

  /**
   * Bug MEDIO/BAJO #10 (post-review-adversarial): `clear()` YA NO revoca los
   * objectURL de los drafts que vacía. `Composer.trySend` la llama
   * INMEDIATAMENTE al disparar el envío (no en `onSuccess` — ver ese fix),
   * momento en el que la burbuja optimista (`PendingSend`, misma referencia
   * de `DraftAttachment`) todavía necesita esos URLs para renderizar su
   * preview mientras la subida sigue en vuelo. La propiedad de revocarlos
   * pasa al pipeline de envío: `useSendWhatsappMessage.onSuccess` los revoca
   * al confirmar, y `discard()` los revoca si el agente abandona un envío
   * `failed`. Revocar acá rompería esa burbuja (img/tile con un blob: URL ya
   * inválido).
   */
  function clear() {
    setDrafts(() => []);
  }

  /**
   * Fix-fe hallazgo #1/#2 (post-review-adversarial, F1.5-D nota privada): a
   * diferencia de `clear()` (arriba — NO revoca, porque la propiedad de esos
   * objectURL pasa al pipeline de envío), `discardAll()` SÍ revoca. Es para
   * el caso en que los drafts se ABANDONAN sin enviarse nunca — ej.
   * `Composer.handleModeChange` al entrar a modo nota: los adjuntos de un
   * reply a medio armar son irrelevantes ahí (v1 de nota es texto-only,
   * design §3.5), así que ningún pipeline de envío los va a revocar por su
   * cuenta. Revoca TODOS los drafts (con o sin error de validación — ninguno
   * viaja) y limpia `hasBlocking` de paso. Mismo patrón que `add()`: el
   * efecto sucio corre AFUERA del updater (vía `draftsRef`, no dentro de
   * `setDrafts`) para no duplicar revocaciones bajo StrictMode.
   *
   * Fix-fe hallazgo #1 (re-review nota privada): limpia TAMBIÉN el `feedback`
   * de "máximo N archivos". Si no, al entrar a modo nota (que llama acá) el
   * aviso queda pegado en un composer que ya no tiene tray ni botón de
   * adjuntar — un cartel de límite de archivos sin ningún contexto. Abandonar
   * los drafts abandona su feedback.
   */
  function discardAll() {
    draftsRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    setDrafts(() => []);
    setFeedback(null);
  }

  // Revoca cualquier objectURL que quede vigente al desmontar (no leak).
  useEffect(() => {
    return () => {
      draftsRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    };
  }, []);

  const hasBlocking = drafts.some((d) => d.error !== null);

  return { drafts, add, remove, clear, discardAll, hasBlocking, feedback };
}
