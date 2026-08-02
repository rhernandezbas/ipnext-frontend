import axiosClient from './axios-client';
import type { OnuWifiStatus, SetWifiBandInput, EnableTr069Input } from '@/types/wifi';

/**
 * wifi-staff-panel — cliente del self-service WiFi admin (BE F0, en prod).
 * GOTCHA envelope: el GET envuelve en `{ data: ... }`; el PUT/POST de escritura
 * NO — devuelven `{ applied: true }` pelado (verificado contra
 * `src/infrastructure/http/routes/wifi.routes.ts` del backend).
 */
export const wifiApi = {
  async getOnuWifiStatus(serial: string): Promise<OnuWifiStatus> {
    const r = await axiosClient.get<{ data: OnuWifiStatus }>(`/wifi/onu/${encodeURIComponent(serial)}`);
    return r.data.data;
  },

  async setWifiBand(serial: string, input: SetWifiBandInput): Promise<void> {
    await axiosClient.put<{ applied: boolean }>(`/wifi/onu/${encodeURIComponent(serial)}/band`, input);
  },

  async enableTr069(serial: string, input: EnableTr069Input): Promise<void> {
    await axiosClient.post<{ applied: boolean }>(`/wifi/onu/${encodeURIComponent(serial)}/enable-tr069`, input);
  },
};

/**
 * Copy humano por código de error del contrato WiFi (mismo criterio que
 * `fiberProvisionErrors.ts` — nada de "Error 503" pelado). `SMARTOLT_NOT_CONFIGURED`
 * es el caso explícito que pide el proposal: mostrar estado claro, no error genérico.
 */
const WIFI_ERROR_COPY: Record<string, string> = {
  SMARTOLT_NOT_CONFIGURED: 'SmartOLT no está configurado en el servidor — avisale al administrador.',
  SMARTOLT_UNREACHABLE: 'No se pudo contactar a SmartOLT — reintentá en unos minutos.',
  SMARTOLT_REJECTED: 'SmartOLT rechazó la operación — revisá la ONU en SmartOLT antes de reintentar.',
  VALIDATION_ERROR: 'Datos inválidos — revisá el SSID (1-32 caracteres) y la clave (8-63, WPA2).',
};

/** true si el error es un 503 SMARTOLT_NOT_CONFIGURED — estado a mostrar aparte, nunca como error genérico. */
export function isSmartOltNotConfigured(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
  return res?.status === 503 && res?.data?.code === 'SMARTOLT_NOT_CONFIGURED';
}

/**
 * Extrae `response.data.code`/`error` de un error axios-like y lo mapea a copy
 * humano. `perm` nombra el permiso correspondiente en el 401/403 (wifi.read
 * para el GET, wifi.manage para las escrituras).
 */
export function mapWifiError(err: unknown, perm: 'wifi.read' | 'wifi.manage' = 'wifi.manage'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number; data?: { code?: string; error?: string } } }).response;
    const code = res?.data?.code;
    if (code && WIFI_ERROR_COPY[code]) return WIFI_ERROR_COPY[code];
    if (res?.status === 401 || res?.status === 403) {
      return perm === 'wifi.read'
        ? 'No tenés permiso para ver el WiFi de esta ONU (requiere wifi.read).'
        : 'No tenés permiso para gestionar el WiFi de esta ONU (requiere wifi.manage).';
    }
    if (typeof res?.data?.error === 'string' && res.data.error) return res.data.error;
  }
  return 'Error inesperado al hablar con el servidor. Reintentá.';
}
