/** Wire item of GET /api/admin/iclass/teams — the persisted IClass team catalog. */
export interface IClassTeam {
  login: string;
  name: string;
  thirdPartyCode: string | null;
  active: boolean;
  selectable: boolean;
  lastSyncedAt: string | null;
}

/** Result of POST /api/admin/iclass/teams/sync */
export interface IClassTeamSyncResult {
  synced: number;
  created: number;
  updated: number;
}
