import axiosClient from './axios-client';
import type { AuthUser } from '@/types/auth';

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await axiosClient.post<AuthUser>('/auth/login', { username, password });
  return response.data;
}

export async function logout(): Promise<void> {
  await axiosClient.post('/auth/logout');
}

export async function getMe(): Promise<AuthUser> {
  const response = await axiosClient.get<AuthUser>('/auth/me');
  return response.data;
}
