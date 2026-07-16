/**
 * useSessionCuresFilterUrl — URL-backed filter state for the "Sesiones curadas" tab
 * (radius-session-autocure FE-1, REQ-FE-CURE-1).
 *
 * Filter fields (public API): outcome, trigger, username, from, to, page.
 *
 * URL keys are NAMESPACED with the `cure_` prefix (cure_outcome, cure_trigger, …).
 * This hook shares the query string of /admin/networking/audit with
 * useRadiusLogsFilterUrl (logs_*), useNe8000AuditFilterUrl (ne_*),
 * useAuthFailuresFilterUrl (auth_*) and useNasMovesFilterUrl (mv_*); namespacing
 * prevents the tabs from colliding on shared keys (username / page). All writes use
 * replace: true and PRESERVE params that don't belong to this namespace.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RADIUS_SESSION_CURE_OUTCOMES,
  type RadiusSessionCureOutcome,
} from '@/types/radiusSessionCure';

const NS = 'cure_';
const k = (key: string) => `${NS}${key}`;

/**
 * Lee y VALIDA el outcome de la URL contra el union del wire contract conocido.
 * Basura (`?cure_outcome=basura`) → undefined: se ignora como si no hubiera
 * filtro, evitando mandarle un valor inválido al BE (mismo espíritu que
 * useNasMovesFilterUrl.parseOutcome).
 */
function parseOutcome(v: string | null): RadiusSessionCureOutcome | undefined {
  return v != null && (RADIUS_SESSION_CURE_OUTCOMES as readonly string[]).includes(v)
    ? (v as RadiusSessionCureOutcome)
    : undefined;
}

function parseTrigger(v: string | null): 'auto' | 'manual' | undefined {
  return v === 'manual' || v === 'auto' ? v : undefined;
}

/** Basura, cero o negativos → undefined: la page cae a 1, nunca NaN. */
function parsePage(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export interface SessionCuresFilter {
  outcome?: RadiusSessionCureOutcome;
  trigger?: 'auto' | 'manual';
  username?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface SessionCuresFilterUrlResult {
  filter: SessionCuresFilter;
  setFilter: (patch: Partial<SessionCuresFilter>) => void;
  clearFilter: () => void;
}

export function useSessionCuresFilterUrl(): SessionCuresFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: SessionCuresFilter = {
    outcome:  parseOutcome(searchParams.get(k('outcome'))),
    trigger:  parseTrigger(searchParams.get(k('trigger'))),
    username: searchParams.get(k('username')) ?? undefined,
    from:     searchParams.get(k('from')) ?? undefined,
    to:       searchParams.get(k('to')) ?? undefined,
    page:     parsePage(searchParams.get(k('page'))),
  };

  const setFilter = useCallback(
    (patch: Partial<SessionCuresFilter>) => {
      setSearchParams(
        (prev) => {
          // Start from prev so we PRESERVE the other tabs' params, then rewrite
          // only this namespace's keys.
          const next = new URLSearchParams(prev);

          const merged: SessionCuresFilter = {
            outcome:  'outcome'  in patch ? patch.outcome  : parseOutcome(prev.get(k('outcome'))),
            trigger:  'trigger'  in patch ? patch.trigger  : parseTrigger(prev.get(k('trigger'))),
            username: 'username' in patch ? patch.username : (prev.get(k('username')) ?? undefined),
            from:     'from'     in patch ? patch.from     : (prev.get(k('from')) ?? undefined),
            to:       'to'       in patch ? patch.to       : (prev.get(k('to')) ?? undefined),
            page:     'page'     in patch ? patch.page     : parsePage(prev.get(k('page'))),
          };

          const setOrDelete = (key: string, value?: string) => {
            if (value) next.set(k(key), value);
            else next.delete(k(key));
          };

          setOrDelete('outcome',  merged.outcome);
          setOrDelete('trigger',  merged.trigger);
          setOrDelete('username', merged.username);
          setOrDelete('from', merged.from);
          setOrDelete('to', merged.to);
          setOrDelete('page', merged.page && merged.page > 1 ? String(merged.page) : undefined);

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilter = useCallback(
    () => {
      setSearchParams(
        (prev) => {
          // Clear only THIS tab's namespaced keys; leave the other tabs' intact.
          const next = new URLSearchParams(prev);
          for (const key of [...next.keys()]) {
            if (key.startsWith(NS)) next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { filter, setFilter, clearFilter };
}
