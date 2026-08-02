/**
 * wifi-staff-panel — tipos del self-service WiFi operado por Prominense sobre
 * ONUs Huawei de fibra (BE F0, ya en prod). Rutas por SERIAL, no por contrato
 * — el staff opera la ONU aunque todavía no esté asociada a ningún contrato.
 * Espeja 1:1 `AdminOnuWifiStatusDto` / `WifiBandStatus` / `AdminWifiDeviceDto`
 * del BE (`src/application/dto/wifi.dto.ts`, `mapWifiPortsToBands.ts`).
 */

export type WifiBandName = '2.4' | '5';

/** Una banda WiFi de la ONU. `port` es el identificador SmartOLT ('wifi_0/1'..'wifi_0/8'),
 *  no un número — se manda tal cual de vuelta en el PUT. */
export interface WifiBand {
  band: WifiBandName;
  port: string;
  ssid: string | null;
  enabled: boolean;
}

/** Dispositivo conectado al router de la ONU. Vista admin: incluye ip/mac (a
 *  diferencia del portal del cliente). */
export interface WifiHost {
  name: string | null;
  ip: string | null;
  mac: string | null;
  interface: 'wifi' | 'ethernet';
  active: boolean;
  vendor: string | null;
}

/** `GET /api/wifi/onu/:serial` — respuesta completa. */
export interface OnuWifiStatus {
  sn: string;
  /** false = el serial no existe en SmartOLT (síntoma típico: serial mal tipeado). */
  found: boolean;
  onuType: string | null;
  online: boolean;
  /** TR-069 = Enabled en SmartOLT. Prominense nunca lo prende sola — el staff decide. */
  tr069Enabled: boolean;
  bands: WifiBand[];
  hosts: WifiHost[];
}

/** Body de `PUT /api/wifi/onu/:serial/band`. `port` viaja como vino en `WifiBand.port`. */
export interface SetWifiBandInput {
  port: string;
  ssid: string;
  password: string;
}

/**
 * Body de `POST /api/wifi/onu/:serial/enable-tr069`. `vlan` es SIN default —
 * el operador la elige (BE: `vlan` requerida, pista MERCEDES1=11/ESTUDIANTES=12
 * en el 400 cuando falta). `tr069Profile` es camelCase en el wire (verificado
 * contra `EnableOnuTr069Schema`, `src/application/dto/wifi.dto.ts`).
 */
export interface EnableTr069Input {
  vlan: number;
  tr069Profile?: string;
}

/** Perfil TR-069 default del BE (`EnableOnuTr069.ts`). */
export const DEFAULT_TR069_PROFILE = 'SmartOLT';
