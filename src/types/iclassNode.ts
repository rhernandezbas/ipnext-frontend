/** Wire item of GET /api/admin/iclass/nodes — the persisted IClass node catalog. */
export interface IClassNode {
  id: string;
  nodeId: number;
  code: string;
  description: string;
  active: boolean;
  selectable: boolean;
  lastSyncedAt: string | null;
}

/** Result of POST /api/admin/iclass/nodes/sync — parity with IClassSoTypeSyncResult. */
export interface IClassNodeSyncResult {
  synced: number;
  created: number;
  updated: number;
  reactivated: number;
  deactivated: number;
}
