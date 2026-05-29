export type SystemRoleCode =
  | 'super_admin'
  | 'administrador'
  | 'administracion'
  | 'ventas'
  | 'noc'
  | 'tecnico';

export interface RbacRoleDto {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
}
