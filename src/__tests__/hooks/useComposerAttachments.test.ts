/**
 * useComposerAttachments — estado local de drafts del composer
 * (messaging-inbox-v2-media F1.5 fase A, Tanda 2 — ENVIAR, design §2/§4.1).
 * Hook de estado local (NO react-query): agrega/quita/valida drafts y es
 * DUEÑO del ciclo de vida de los `objectURL` (crea al agregar, revoca al
 * quitar y al desmontar).
 *
 * GOTCHA jsdom: no trae `URL.createObjectURL`/`revokeObjectURL` — se
 * mockean acá (mismo gap que `matchMedia` en `MessageBubble.tsx`).
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, StrictMode } from 'react';
import { useComposerAttachments } from '@/hooks/useComposerAttachments';

function makeFile(name: string, type: string, sizeBytes = 100): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

let objectUrlCounter = 0;

beforeEach(() => {
  objectUrlCounter = 0;
  (globalThis as { URL: typeof URL }).URL.createObjectURL = vi.fn(() => `blob:mock-${++objectUrlCounter}`);
  (globalThis as { URL: typeof URL }).URL.revokeObjectURL = vi.fn();
});

describe('useComposerAttachments — add', () => {
  it('agrega un archivo válido: crea un draft con id, fileType derivado, previewUrl (objectURL) y error null', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const file = makeFile('foto.jpg', 'image/jpeg');

    act(() => result.current.add([file]));

    expect(result.current.drafts).toHaveLength(1);
    const draft = result.current.drafts[0]!;
    expect(draft.file).toBe(file);
    expect(draft.fileType).toBe('image');
    expect(draft.error).toBeNull();
    expect(draft.previewUrl).toBe('blob:mock-1');
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(draft.id).toBeTruthy();
  });

  it('un archivo que excede su límite por tipo se agrega igual, pero marcado con error TOO_LARGE (se ve en el tray para poder sacarlo)', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const bigImage = makeFile('grande.jpg', 'image/jpeg', 6 * 1024 * 1024);

    act(() => result.current.add([bigImage]));

    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.drafts[0]?.error?.code).toBe('TOO_LARGE');
  });

  it('audio/file TAMBIÉN crea objectURL (bug MEDIO/BAJO #10: la burbuja optimista de un envío en vuelo necesita un url real para audio/file, no solo image/video — el tray simplemente no lo usa para <img>, solo el ícono+nombre)', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const audio = makeFile('nota.ogg', 'audio/ogg');

    act(() => result.current.add([audio]));

    expect(result.current.drafts[0]?.previewUrl).toBe('blob:mock-1');
    expect(URL.createObjectURL).toHaveBeenCalledWith(audio);
  });

  it('agregar 2 archivos de una → cada uno con su propio id/objectURL, ambos en drafts', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const a = makeFile('a.jpg', 'image/jpeg');
    const b = makeFile('b.png', 'image/png');

    act(() => result.current.add([a, b]));

    expect(result.current.drafts).toHaveLength(2);
    expect(result.current.drafts[0]!.id).not.toBe(result.current.drafts[1]!.id);
  });

  it('agregar por encima del tope (MAX_FILES=10) recorta al tope y expone feedback (no pierde en silencio)', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const files = Array.from({ length: 12 }, (_, i) => makeFile(`f${i}.jpg`, 'image/jpeg'));

    act(() => result.current.add(files));

    expect(result.current.drafts).toHaveLength(10);
    expect(result.current.feedback).toMatch(/m[aá]ximo 10/i);
  });

  it('agregar más encima de un tope ya alcanzado en 2 llamadas también recorta', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const firstBatch = Array.from({ length: 8 }, (_, i) => makeFile(`f${i}.jpg`, 'image/jpeg'));
    const secondBatch = Array.from({ length: 5 }, (_, i) => makeFile(`g${i}.jpg`, 'image/jpeg'));

    act(() => result.current.add(firstBatch));
    act(() => result.current.add(secondBatch));

    expect(result.current.drafts).toHaveLength(10);
  });
});

describe('useComposerAttachments — remove', () => {
  it('quita el draft por id y revoca su objectURL', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const file = makeFile('foto.jpg', 'image/jpeg');
    act(() => result.current.add([file]));
    const id = result.current.drafts[0]!.id;

    act(() => result.current.remove(id));

    expect(result.current.drafts).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
  });

  it('quitar un draft de audio/file (que ahora también tiene previewUrl, bug #10) SÍ revoca su objectURL', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const file = makeFile('nota.ogg', 'audio/ogg');
    act(() => result.current.add([file]));
    const id = result.current.drafts[0]!.id;
    const url = result.current.drafts[0]!.previewUrl;

    act(() => result.current.remove(id));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });
});

describe('useComposerAttachments — clear', () => {
  it('bug MEDIO/BAJO #10: vacía todos los drafts SIN revocar sus objectURL — la propiedad pasa al PendingSend en el momento del envío (`Composer.trySend` llama `clear()` INMEDIATAMENTE al disparar, no en onSuccess); revocar acá rompería el preview de la burbuja optimista mientras la subida sigue en vuelo. La revocación real la hacen `useSendWhatsappMessage.onSuccess`/`discard`.', () => {
    const { result } = renderHook(() => useComposerAttachments());
    act(() => result.current.add([makeFile('a.jpg', 'image/jpeg'), makeFile('b.png', 'image/png')]));

    act(() => result.current.clear());

    expect(result.current.drafts).toHaveLength(0);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('useComposerAttachments — StrictMode (bug ALTO #6: no debe leakear objectURL)', () => {
  it('bajo StrictMode, add() llama a createObjectURL UNA sola vez por archivo (no 2 — el updater de setDrafts es puro, el createObjectURL corre AFUERA)', () => {
    const { result } = renderHook(() => useComposerAttachments(), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    const file = makeFile('foto.jpg', 'image/jpeg');

    act(() => result.current.add([file]));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(result.current.drafts).toHaveLength(1);
  });

  it('bajo StrictMode, agregar 2 archivos crea exactamente 2 objectURL (no 4)', () => {
    const { result } = renderHook(() => useComposerAttachments(), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });

    act(() => result.current.add([makeFile('a.jpg', 'image/jpeg'), makeFile('b.png', 'image/png')]));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(result.current.drafts).toHaveLength(2);
  });
});

describe('useComposerAttachments — unmount', () => {
  it('al desmontar revoca todos los objectURL que quedaban vigentes (no leak)', () => {
    const { result, unmount } = renderHook(() => useComposerAttachments());
    act(() => result.current.add([makeFile('a.jpg', 'image/jpeg'), makeFile('b.png', 'image/png')]));

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe('useComposerAttachments — discardAll (fix-fe hallazgo #1/#2: abandonar drafts SIN enviarlos — ej. Composer.handleModeChange al entrar a modo nota)', () => {
  it('a diferencia de clear() (que NO revoca, ver su describe arriba), discardAll() SÍ revoca el objectURL de todos los drafts', () => {
    const { result } = renderHook(() => useComposerAttachments());
    act(() => result.current.add([makeFile('a.jpg', 'image/jpeg'), makeFile('b.png', 'image/png')]));

    act(() => result.current.discardAll());

    expect(result.current.drafts).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('revoca también drafts con error de validación (bloqueantes) y limpia hasBlocking', () => {
    const { result } = renderHook(() => useComposerAttachments());
    act(() => result.current.add([makeFile('grande.jpg', 'image/jpeg', 6 * 1024 * 1024)]));
    const url = result.current.drafts[0]!.previewUrl;
    expect(result.current.hasBlocking).toBe(true);

    act(() => result.current.discardAll());

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(result.current.hasBlocking).toBe(false);
  });

  it('sin drafts, no revoca nada (no explota)', () => {
    const { result } = renderHook(() => useComposerAttachments());

    act(() => result.current.discardAll());

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('resetea el feedback de "máximo N archivos" (fix-fe hallazgo #1 re-review nota privada: al entrar a modo nota se hace discardAll() — el composer en modo nota NO tiene tray ni botón de adjuntar, así que un cartel de límite de archivos queda pegado y sin sentido; abandonar los drafts debe limpiar su feedback)', () => {
    const { result } = renderHook(() => useComposerAttachments());
    const files = Array.from({ length: 12 }, (_, i) => makeFile(`f${i}.jpg`, 'image/jpeg'));
    act(() => result.current.add(files));
    expect(result.current.feedback).toMatch(/m[aá]ximo/i);

    act(() => result.current.discardAll());

    expect(result.current.feedback).toBeNull();
  });
});

describe('useComposerAttachments — hasBlocking', () => {
  it('false cuando no hay drafts o ninguno tiene error', () => {
    const { result } = renderHook(() => useComposerAttachments());
    expect(result.current.hasBlocking).toBe(false);

    act(() => result.current.add([makeFile('a.jpg', 'image/jpeg')]));
    expect(result.current.hasBlocking).toBe(false);
  });

  it('true cuando algún draft tiene error de validación', () => {
    const { result } = renderHook(() => useComposerAttachments());
    act(() => result.current.add([makeFile('grande.jpg', 'image/jpeg', 6 * 1024 * 1024)]));
    expect(result.current.hasBlocking).toBe(true);
  });
});
