export interface IClassResultCode {
  id: string;
  soTypeId: string | null;
  /** Result-code name (matches motivoFechamento on a closed SO). */
  code: string;
  /** Sucesso | Falha | Pendente | ... */
  type: string;
  /** Configurable closure mapping: target Stage id (null = unmapped). */
  mappedStageId: string | null;
  mappedStageName: string | null;
  lastSyncedAt: string;
}

export interface IClassResultCodeSyncResult {
  synced: number;
  created: number;
  updated: number;
}
