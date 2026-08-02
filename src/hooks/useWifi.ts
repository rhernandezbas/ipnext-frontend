import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { wifiApi } from '@/api/wifi.api';
import type { OnuWifiStatus, SetWifiBandInput, EnableTr069Input } from '@/types/wifi';

const onuWifiKey = (serial: string) => ['wifi-onu-status', serial] as const;

/**
 * `GET /api/wifi/onu/:serial` — estado WiFi de la ONU por serial. Se dispara
 * solo cuando el contrato tiene un item ONU activo con serial cargado
 * (`enabled`) — sin eso no hay nada que consultar.
 */
export function useOnuWifiStatus(serial: string | undefined | null, enabled = true) {
  return useQuery<OnuWifiStatus>({
    queryKey: onuWifiKey(serial ?? ''),
    queryFn: () => wifiApi.getOnuWifiStatus(serial!),
    enabled: !!serial && enabled,
    retry: false,
  });
}

/**
 * `PUT /api/wifi/onu/:serial/band`. Invalida el estado WiFi de ESTA sn al
 * aplicar — el card refleja el nuevo SSID sin que el operador tenga que
 * refrescar la página.
 */
export function useSetWifiBand(serial: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetWifiBandInput) => wifiApi.setWifiBand(serial, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onuWifiKey(serial) }),
  });
}

/**
 * `POST /api/wifi/onu/:serial/enable-tr069`. Misma invalidación — el card
 * pasa de "Habilitar TR-069" a los controles por banda tras el 200.
 */
export function useEnableTr069(serial: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnableTr069Input) => wifiApi.enableTr069(serial, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: onuWifiKey(serial) }),
  });
}

/**
 * Verificación manual para el flujo "Asociar ONU" (#2 del proposal): el
 * operador tipea un serial y confirma VIENDO el equipo antes de asociarlo —
 * nunca a ciegas. Mismo patrón que `useInspectPppoeDevices` (trigger manual,
 * sin auto-fetch, sin cachear entre seriales distintos).
 */
export function useVerifyOnuWifi() {
  const [isPending, setIsPending] = useState(false);

  const verify = useCallback(async (serial: string): Promise<OnuWifiStatus> => {
    setIsPending(true);
    try {
      return await wifiApi.getOnuWifiStatus(serial);
    } finally {
      setIsPending(false);
    }
  }, []);

  return { verify, isPending };
}
