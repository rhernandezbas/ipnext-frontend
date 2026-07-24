import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as api from '@/api/nocAlerts.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import type { NocAlertDto, NocAlertStreamEvent } from '@/types/nocAlert';

/**
 * useNocAlerts (Fase C FE, change `noc-alerts-hub`) — lista + ACK + SSE del
 * panel de alertas NOC. spec.md `noc-alert-realtime`.
 *
 * `nocAlertsKey` es una ÚNICA cache entry (lista SIN filtros server-side):
 * `useNocAlertsStream` parchea ESTA key en cada frame del SSE — con una key
 * por combinación de filtros (molde `useWhatsappConversations`) el mismo
 * evento tendría que replicarse a N entries cacheadas, y una que el usuario
 * nunca visitó (por ej. cambia de filtro y vuelve) quedaría stale hasta su
 * próximo mount. `AlertsPage` filtra client-side sobre esta lista completa —
 * el contrato BE soporta filtros server-side (`?source=&severity=&status=`)
 * pero el volumen de un hub de alertas NOC no lo amerita hoy.
 */
export const nocAlertsKey = ['nocAlerts', 'list'] as const;

/** Ventana de gracia (spec.md "FE falls back to polling when the stream fails"):
 *  un `onerror` aislado puede ser solo el reintento automático NATIVO de
 *  `EventSource` (pasa a CONNECTING y se recupera solo) — recién si a los 5s
 *  la conexión sigue sin estar OPEN se considera "persistente". */
const STREAM_ERROR_GRACE_MS = 5_000;

/** Polling de respaldo cuando el stream cayó — mismo intervalo que
 *  `useWhatsappConversations` (molde `useWhatsapp.ts`). */
const POLLING_INTERVAL_MS = 15_000;

export type NocAlertsStreamMode = 'connecting' | 'live' | 'polling';

export function useNocAlertsList(pollingEnabled: boolean) {
  const visible = useDocumentVisible();

  return useQuery({
    queryKey: nocAlertsKey,
    queryFn: api.listNocAlerts,
    refetchInterval: pollingEnabled && visible ? POLLING_INTERVAL_MS : false,
  });
}

export function useAcknowledgeNocAlert() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.acknowledgeNocAlert(id, note),
    onSuccess: (updated: NocAlertDto) => {
      qc.setQueryData<NocAlertDto[]>(nocAlertsKey, (old = []) =>
        old.map((a) => (a.id === updated.id ? updated : a)),
      );
    },
    // Reconciliación SIEMPRE (éxito o error, molde `useSetConversationStatus`):
    // el 403 del BE (sin `monitoring.acknowledge_alert`) o un 404 (alerta ya
    // borrada) no debe dejar la fila "colgada" en un estado que ya no es real.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: nocAlertsKey });
    },
  });
}

/** Upsert por id — un `firing` de fingerprint nuevo entra al tope; cualquier
 *  evento sobre un id YA presente (re-fire, resolved, acked) reemplaza esa
 *  fila in-place sin reordenar el resto. */
function applyStreamEvent(qc: QueryClient, event: NocAlertStreamEvent) {
  qc.setQueryData<NocAlertDto[]>(nocAlertsKey, (old = []) => {
    const idx = old.findIndex((a) => a.id === event.alert.id);
    if (idx === -1) return [event.alert, ...old];
    const next = [...old];
    next[idx] = event.alert;
    return next;
  });
}

interface UseNocAlertsStreamOptions {
  enabled: boolean;
  /** Disparado en cada frame `firing` — el caller lo usa para marcar la fila
   *  y disparar la animación de entrada (SOLO en firing: es la única señal
   *  real de "esto es nuevo/re-disparado", no un heurístico derivado). */
  onFiring?: (alertId: string) => void;
}

/**
 * useNocAlertsStream — `EventSource` a `GET /api/alerts/stream`.
 *
 * - `onopen` (conexión inicial O reconexión — el navegador dispara el MISMO
 *   evento en ambos casos) invalida `nocAlertsKey` para reconciliar con un
 *   refetch completo (spec.md "FE reconnection reconciles via full refetch,
 *   not event replay" — NUNCA Last-Event-ID/replay).
 * - `onmessage` parchea la cache in-place (`applyStreamEvent`).
 * - `onerror` persistente (sin volver a OPEN dentro de la ventana de gracia)
 *   → cierra el stream y devuelve `mode:'polling'`; el caller ata ese modo a
 *   `useNocAlertsList(pollingEnabled)`.
 */
export function useNocAlertsStream({ enabled, onFiring }: UseNocAlertsStreamOptions): NocAlertsStreamMode {
  const qc = useQueryClient();
  const [mode, setMode] = useState<NocAlertsStreamMode>('connecting');
  const onFiringRef = useRef(onFiring);
  onFiringRef.current = onFiring;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const es = new EventSource(api.NOC_ALERTS_STREAM_URL, { withCredentials: true });

    function clearGrace() {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
    }

    es.onopen = () => {
      if (cancelled) return;
      clearGrace();
      setMode('live');
      void qc.invalidateQueries({ queryKey: nocAlertsKey });
    };

    es.onmessage = (ev: MessageEvent<string>) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(ev.data) as NocAlertStreamEvent;
        applyStreamEvent(qc, parsed);
        if (parsed.type === 'firing') onFiringRef.current?.(parsed.alert.id);
      } catch {
        // Frame malformado — se ignora; el próximo evento/heartbeat sigue llegando.
      }
    };

    es.onerror = () => {
      if (cancelled || graceTimer) return;
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (cancelled) return;
        if (es.readyState !== EventSource.OPEN) {
          setMode('polling');
          es.close();
        }
      }, STREAM_ERROR_GRACE_MS);
    };

    return () => {
      cancelled = true;
      clearGrace();
      es.close();
    };
  }, [enabled, qc]);

  return mode;
}
