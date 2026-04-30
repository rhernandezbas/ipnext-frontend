import axiosClient from './axios-client';
import type { AuthUser } from '@/types/auth';

type BackendUser = { id: string; username: string; email: string; role: string };

function mapUser(u: BackendUser): AuthUser {
  return {
    id: u.id as unknown as number,
    username: u.username,
    email: u.email,
    displayName: u.username,
    role: u.role,
    permissions: [],
  };
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await axiosClient.post<{ user: BackendUser }>('/auth/login', { username, password });
  return mapUser(response.data.user);
}

export async function logout(): Promise<void> {
  await axiosClient.post('/auth/logout');
}

export async function getMe(): Promise<AuthUser> {
  const response = await axiosClient.get<BackendUser>('/auth/me');
  return mapUser(response.data);
}
