/**
 * Un estado de IClass en el catálogo configurable.
 *
 * - `statusCode`: identificador nativo de IClass (inmutable, read-only en la UI).
 * - `iclassLabel`: etiqueta original de IClass (read-only).
 * - `displayLabel`: etiqueta personalizada definida por el operador (editable, null = no customizada).
 * - `effectiveLabel`: `displayLabel ?? iclassLabel` — lo que se muestra en la UI.
 * - `color`: color hex/css elegido por el operador (null = sin color).
 * - `tracked`: cuando true, el estado se muestra en el badge de la tarea.
 * - `lastSyncedAt`: ISO datetime de la última sincronización desde IClass.
 */
export interface IClassStatusCatalogEntry {
  statusCode: string;
  iclassLabel: string;
  displayLabel: string | null;
  effectiveLabel: string;
  color: string | null;
  tracked: boolean;
  lastSyncedAt: string;
}

export interface IClassStatusCatalogSyncResult {
  synced: number;
  created: number;
  updated: number;
}

export interface UpdateIClassStatusCatalogPayload {
  displayLabel?: string | null;
  color?: string | null;
  tracked?: boolean;
}
