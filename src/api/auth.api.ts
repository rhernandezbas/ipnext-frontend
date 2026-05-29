import axiosClient from './axios-client';
import type { AuthUser } from '@/types/auth';

// Legacy shape returned by POST /auth/login (still { user: { id, username, email } })
type LoginUser = { id: string; username: string; email: string };

// New shape returned by GET /auth/me after SDD #3:
//   { user: { id, login, email, name }, roles: [...], permissions: [...] }
type MeResponse = {
  user: { id: string; login: string; email: string; name: string };
  roles: Array<{ id: string; code: string; label: string }>;
  permissions: string[];
};

function mapLoginUser(u: LoginUser): AuthUser {
  return {
    id: u.id as unknown as number,
    username: u.username,
    email: u.email,
    displayName: u.username,
    role: '',          // legacy field — no longer carried in JWT; roles are resolved via /me
    permissions: [],
  };
}

function mapMeResponse(me: MeResponse): AuthUser {
  return {
    id: me.user.id as unknown as number,
    username: me.user.login,
    email: me.user.email,
    displayName: me.user.name || me.user.login,
    // Legacy `role` slot: kept for back-compat with any consumer still reading it.
    // Holds the first system role code if present, otherwise the first role's code.
    role: me.roles.find(r => r.code === 'super_admin')?.code
      ?? me.roles[0]?.code
      ?? '',
    permissions: me.permissions,
  };
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await axiosClient.post<{ user: LoginUser }>('/auth/login', { username, password });
  return mapLoginUser(response.data.user);
}

export async function logout(): Promise<void> {
  await axiosClient.post('/auth/logout');
}

export async function getMe(): Promise<AuthUser> {
  const response = await axiosClient.get<MeResponse>('/auth/me');
  return mapMeResponse(response.data);
}
