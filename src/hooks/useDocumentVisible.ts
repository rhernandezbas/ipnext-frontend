import { useEffect, useState } from 'react';

/**
 * useDocumentVisible (messaging-inbox F1, design §4) — genérico, reusable fuera
 * del inbox. Gatea el polling de `useWhatsapp.ts`: `refetchInterval` pasa a
 * `false` cuando la pestaña está oculta (`refetchIntervalInBackground` NO
 * alcanza acá — esa opción solo controla si el refetch sigue corriendo en
 * background, no si el intervalo arranca; la pausa real es no programarlo).
 */
export function useDocumentVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible');

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
