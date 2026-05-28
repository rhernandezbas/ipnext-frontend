export interface IClassSoType {
  id: string;
  code: string;
  description: string;
  active: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IClassSoTypeSyncResult {
  synced: number;
  created: number;
  updated: number;
  reactivated: number;
  deactivated: number;
}
