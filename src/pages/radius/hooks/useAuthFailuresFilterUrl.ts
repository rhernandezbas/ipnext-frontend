/**
 * useAuthFailuresFilterUrl — URL-backed filter state for the "Errores de auth" tab.
 *
 * Filter fields (public API): username, reply, from, to, page.
 *
 * URL keys are NAMESPACED with the `auth_` prefix (auth_username, auth_reply,
 * auth_from, auth_to, auth_page). This hook shares the query string of
 * /admin/networking/audit with useRadiusLogsFilterUrl (logs_*) and
 * useNe8000AuditFilterUrl (ne_*); namespacing prevents the three tabs from
 * colliding on the shared keys (username / page) — each tab keeps its own filters
 * and never overwrites another's. All writes use replace: true and PRESERVE
 * params that don't belong to this namespace (the other tabs' filters).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const NS = 'auth_';
const k = (key: string) => `${NS}${key}`;

/**
 * `reply` semantics:
 *   ''            → unset in the URL. The page treats this as the DEFAULT
 *                   (Access-Reject), because the feature is "errores".
 *   'all'         → explicit "Todos" chosen by the user; the page sends NO reply
 *                   param to the BE so both Accept and Reject come back.
 *   'Access-*'    → that exact reply.
 */
export interface AuthFailuresFilter {
  username?: string;
  reply?: 'Access-Accept' | 'Access-Reject' | 'all' | '';
  from?: string;
  to?: string;
  page?: number;
}

export interface AuthFailuresFilterUrlResult {
  filter: AuthFailuresFilter;
  setFilter: (patch: Partial<AuthFailuresFilter>) => void;
  clearFilter: () => void;
}

export function useAuthFailuresFilterUrl(): AuthFailuresFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: AuthFailuresFilter = {
    username: searchParams.get(k('username')) ?? undefined,
    reply:    (searchParams.get(k('reply')) ?? '') as AuthFailuresFilter['reply'],
    from:     searchParams.get(k('from')) ?? undefined,
    to:       searchParams.get(k('to')) ?? undefined,
    page:     searchParams.get(k('page')) ? Number(searchParams.get(k('page'))) : undefined,
  };

  const setFilter = useCallback(
    (patch: Partial<AuthFailuresFilter>) => {
      setSearchParams(
        (prev) => {
          // Start from prev so we PRESERVE the other tabs' params (logs_* / ne_*),
          // then rewrite only this namespace's keys.
          const next = new URLSearchParams(prev);

          const merged: AuthFailuresFilter = {
            username: 'username' in patch ? patch.username : (prev.get(k('username')) ?? undefined),
            reply:    'reply'    in patch ? patch.reply    : (prev.get(k('reply')) ?? '') as AuthFailuresFilter['reply'],
            from:     'from'     in patch ? patch.from     : (prev.get(k('from')) ?? undefined),
            to:       'to'       in patch ? patch.to       : (prev.get(k('to')) ?? undefined),
            page:     'page'     in patch ? patch.page     : (prev.get(k('page')) ? Number(prev.get(k('page'))) : undefined),
          };

          const setOrDelete = (key: string, value?: string) => {
            if (value) next.set(k(key), value);
            else next.delete(k(key));
          };

          setOrDelete('username', merged.username);
          setOrDelete('reply',    merged.reply);
          setOrDelete('from',     merged.from);
          setOrDelete('to',       merged.to);
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
