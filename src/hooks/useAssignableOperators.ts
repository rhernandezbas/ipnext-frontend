import { useMemo } from 'react';
import { useRbacUsers } from '@/hooks/useRbacUsers';

/** Minimal shape every assignee select on RecaptacionPage consumes. */
export interface AssignableOperator {
  id: string;
  name: string;
}

/**
 * System role code that qualifies an RbacUser as a Recaptación assignee. Only
 * users carrying this role belong in the operator pool — assigning recaptación
 * leads is a sales task. See SYSTEM_ROLES on the BE (super_admin, administrador,
 * administracion, ventas, noc, tecnico).
 */
export const VENTAS_ROLE_CODE = 'ventas';

/**
 * Single source of truth for the Recaptación assignee pool.
 *
 * Wraps {@link useRbacUsers} and applies the ONE predicate every assignee select
 * on the page must honour: an operator is offered iff they are `active` AND carry
 * the `ventas` role. The three selects — inline column, BulkAssignToolbar, and
 * the LeadDetailDrawer "Operador" select — all read from here so the filter can
 * never drift between them again.
 *
 * `enabled` gates the underlying GET /admin/rbac/users (which requires the
 * admin/rbac permission). Callers pass their `recapture.assign` flag, so a plain
 * agent never fires it. Operators come from RbacUser because the BE validates
 * `operatorId` against `RbacUser` (NOT the `Admin` table), and those ids match
 * `lead.assigneeId`.
 *
 * Note: a lead already assigned to someone OUTSIDE this pool keeps showing their
 * name via the phantom <option> in each select — the filter trims the *choices*,
 * it never erases an existing assignment.
 */
export function useAssignableOperators(enabled = true): {
  operators: AssignableOperator[];
  isLoading: boolean;
} {
  const { data: rbacUsers, isLoading } = useRbacUsers(enabled);

  const operators = useMemo<AssignableOperator[]>(
    () =>
      (rbacUsers ?? [])
        .filter(
          (u) =>
            u.status === 'active' &&
            // Defensive guard: the BE could return a user without the roles array.
            (u.roles ?? []).some((r) => r.code === VENTAS_ROLE_CODE),
        )
        .map((u) => ({ id: u.id, name: u.name })),
    [rbacUsers],
  );

  return { operators, isLoading };
}
