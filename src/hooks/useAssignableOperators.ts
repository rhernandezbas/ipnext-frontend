import { useMemo } from 'react';
import { useRbacUsers } from '@/hooks/useRbacUsers';

/** Minimal shape every assignee select on RecaptacionPage consumes. */
export interface AssignableOperator {
  id: string;
  name: string;
}

/**
 * Role codes barred from the Recaptación assignee pool. Mirrors the BE
 * TECHNICAL_ROLE_CODES (src/domain/entities/rbac.ts) — the FE half of the
 * double guard. Only `tecnico` is excluded; every other role (ventas,
 * administrador, administracion, noc) may receive recaptación leads.
 */
export const TECHNICAL_ROLE_CODES = ['tecnico'] as const;

/**
 * Single source of truth for the Recaptación assignee pool.
 *
 * Wraps {@link useRbacUsers} and applies the ONE predicate every assignee select
 * on the page must honour: an operator is offered iff they are `active`, carry
 * AT LEAST ONE role, and NONE of their roles is technical (`tecnico`). A user
 * with no roles is NOT assignable. The three selects — inline column,
 * BulkAssignToolbar, and the LeadDetailDrawer "Operador" select — all read from
 * here so the filter can never drift between them again.
 *
 * `enabled` gates the underlying GET /admin/rbac/users (which requires the
 * admin/rbac permission). Callers pass their `recapture.assign` flag, so a plain
 * agent never fires it. Operators come from RbacUser because the BE validates
 * `operatorId` against `RbacUser` (NOT the `Admin` table), and those ids match
 * `lead.assigneeId`. The BE re-enforces the same rule (422 RECAPTURE_ASSIGNEE_NOT_ALLOWED).
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
            // Assignable requires at least one role…
            (u.roles?.length ?? 0) > 0 &&
            // …and none of them technical.
            !(u.roles ?? []).some((r) =>
              (TECHNICAL_ROLE_CODES as readonly string[]).includes(r.code),
            ),
        )
        .map((u) => ({ id: u.id, name: u.name })),
    [rbacUsers],
  );

  return { operators, isLoading };
}
