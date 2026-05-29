import type { RbacRoleDto } from './rbacRole';

export interface RbacUserDto {
  id: string;
  name: string;
  email: string;
  login: string;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface RbacUserWithRolesDto extends RbacUserDto {
  roles: RbacRoleDto[];
}

export interface CreateRbacUserPayload {
  name: string;
  email: string;
  login: string;
  password: string;
  roleIds: string[];
}

export interface UpdateRbacUserPayload {
  name?: string;
  email?: string;
  login?: string;
  /** Empty string = no change. Omit key entirely in edit mode when password section is collapsed. */
  password?: string;
  status?: 'active' | 'disabled';
}

export interface ChangeRbacUserPasswordPayload {
  newPassword: string;
  oldPassword?: string;
}

export interface SetRolesForUserPayload {
  roleIds: string[];
}
