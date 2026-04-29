export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
}
