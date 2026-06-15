/** Wire item of GET /api/admin/iclass/technician-teams */
export interface TechnicianTeamMappingItem {
  userId: string;
  userName: string;
  userLogin: string;
  iclassTeamLogin: string | null;
  teamName: string | null;
  teamActive: boolean;
}

/** Response of PATCH /api/admin/iclass/technician-teams/:userId */
export interface SetTechnicianTeamMappingResponse {
  userId: string;
  iclassTeamLogin: string | null;
  teamName: string | null;
  teamActive: boolean;
}
