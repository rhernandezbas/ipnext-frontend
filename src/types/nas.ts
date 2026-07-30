import type { IpTypePreference } from './pppoe';

export type NasType = 'mikrotik_api' | 'radius_orchestrator' | 'cisco' | 'ubiquiti' | 'cambium' | 'other';

/** Mask que el BE devuelve para radiusSecret/apiPassword en lecturas (nunca el valor real). */
export const NAS_SECRET_MASK = '••••••••';

export interface NasServer {
  id: string;
  name: string;
  type: NasType;
  /** Etiqueta de presentación del tipo, computada en el BE (ej. "BRAS RADIUS" para radius_orchestrator). Aditiva/opcional: si no viene, el FE deriva el label de `type`. */
  displayType?: string;
  /**
   * pppoe-move-ip-kind-aware: clases de IP que este NAS puede asignar, DERIVADAS en el BE de sus
   * `IpPool.ipKind`. Aditiva/opcional (molde de `displayType`).
   *
   * El FE la usa para ofrecer SOLO los tipos posibles: el NE8000 quedó 100% público (18 pools
   * public, 0 cgnat), así que mostrar "Privada" ahí es ofrecer algo que no existe.
   *
   * AUSENTE o `[]` ⇒ "no determinado" → el FE muestra AMBAS opciones y el BE rechaza si la
   * combinación es inválida. Esconder las dos bloquearía al operador por un fallo de lectura
   * ajeno a su intención; molestarlo con un error claro del backend es preferible a un
   * formulario muerto sin explicación.
   */
  supportedIpKinds?: IpTypePreference[];
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
export type NasServerInput = Omit<NasServer, 'id' | 'displayType' | 'supportedIpKinds'>;

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
