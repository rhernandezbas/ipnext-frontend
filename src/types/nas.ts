export type NasType = 'mikrotik_api' | 'mikrotik_radius' | 'cisco' | 'ubiquiti' | 'cambium' | 'other';

export interface NasServer {
  id: string;
  name: string;
  type: NasType;
  /** Etiqueta de presentación del tipo, computada en el BE (ej. "BRAS RADIUS" para mikrotik_radius). Aditiva/opcional: si no viene, el FE deriva el label de `type`. */
  displayType?: string;
  ipAddress: string;
  radiusSecret: string;
  nasIpAddress: string;
  apiPort: number | null;
  apiLogin: string | null;
  apiPassword: string | null;
  status: 'active' | 'inactive' | 'error';
  lastSeen: string | null;
  clientCount: number;
  description: string;
}

/** Tipo de payload para crear/actualizar un NAS. Omite `id` y `displayType` porque
 *  `displayType` es computado por el BE — no debe enviarse en escrituras. */
export type NasServerInput = Omit<NasServer, 'id' | 'displayType'>;

export interface RadiusConfig {
  authPort: number;
  acctPort: number;
  coaPort: number;
  sessionTimeout: number;
  idleTimeout: number;
  interimUpdateInterval: number;
  nasType: string;
  enableCoa: boolean;
  enableAccounting: boolean;
}
