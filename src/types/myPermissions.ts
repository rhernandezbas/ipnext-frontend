export interface MeUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

export interface MeRole {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
}

export interface MeResponse {
  user: MeUser;
  roles: MeRole[];
  /** Permission codes, e.g. "scheduling.delete". Super-admin receives ["*"]. */
  permissions: string[];
}
