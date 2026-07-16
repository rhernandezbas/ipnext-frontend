/**
 * smartolt-provision-fe (K2-FE) — tipos del aprovisionamiento de ONUs fibra.
 * Espejo EXACTO del wire del BE (ListUnconfiguredOnus / ProvisionFiberOnu, K2):
 * ambos endpoints envuelven en `{ data: ... }` — el unwrap vive en fiber.api.ts.
 */

/** Item del picker — GET /api/fiber/unconfigured-onus. */
export interface UnconfiguredOnu {
  sn: string;
  onuTypeName: string | null;
  oltId: string;
  /** Nombre del catálogo local de OLTs (null si el OLT no está catalogado). */
  oltName: string | null;
  board: string | null;
  port: string | null;
  ponType: string | null;
  /** Prefijo HWTC — solo Huawei se auto-aprovisiona. */
  huawei: boolean;
  /** huawei && SmartOLT ofrece authorize para esta ONU. */
  authorizable: boolean;
  serviceVlanDefault: number | null;
  /** true → el operador DEBE mandar `vlan` en el POST (CHIVILCOY / sin catálogo). */
  vlanRequired: boolean;
}

/** Body del POST /api/fiber/provision (Zod del BE). */
export interface ProvisionOnuPayload {
  contractId: string;
  onuSn: string;
  /** VLAN de servicio explícita (int 1-4094) — gana sobre el default del catálogo. */
  vlan?: number;
  /** true → dry-run: el BE devuelve el PLAN sin side-effects. */
  dryRun?: boolean;
}

export type ProvisionStepName =
  | 'authorize'
  | 'mgmt_ip'
  | 'tr069'
  | 'remote_wan'
  | 'wifi_24'
  | 'wifi_5';

export interface ProvisionStepResult {
  step: ProvisionStepName;
  status: 'ok' | 'failed' | 'skipped';
  detail?: string;
}

export type PppoeStaleReason = 'disabled' | 'pending' | 'radius-desync';

/** Resumen del lado PPPoE de la ejecución real (K1). */
export type FiberPppoeSummary =
  | { status: 'created'; username: string; password: string }
  | { status: 'existing'; username: string }
  | { status: 'stale'; username: string; reason: PppoeStaleReason }
  | { status: 'failed' | 'skipped' };

export interface WifiPlanView {
  ssid24: string;
  ssid5: string;
  /** En el dry-run llega el placeholder "(se genera al ejecutar)"; en la ejecución, la clave REAL. */
  password: string;
}

export interface PlannedCall {
  call: string;
  params: Record<string, unknown>;
}

/** Respuesta 200 del POST con dryRun:true. */
export interface ProvisionPlanResult {
  dryRun: true;
  contractId: string;
  onuSn: string;
  /** null = sin vlan en el input: se resuelve del catálogo del OLT AL EJECUTAR. */
  vlan: number | null;
  wifi: WifiPlanView;
  pppoe: { action: 'reuse-existing' | 'review-stale' | 'generate'; username: string };
  plan: PlannedCall[];
}

/** Respuesta 200 del POST con dryRun:false (ejecución real). */
export interface ProvisionExecutedResult {
  dryRun: false;
  contractId: string;
  onuSn: string;
  olt: { smartoltOltId: string; name: string | null };
  vlan: number;
  wifi: WifiPlanView;
  pppoe: FiberPppoeSummary;
  steps: ProvisionStepResult[];
  /** true → el bloque auditable quedó appendeado en la descripción de la tarea. */
  taskUpdated: boolean;
}

export type ProvisionOnuResult = ProvisionPlanResult | ProvisionExecutedResult;
