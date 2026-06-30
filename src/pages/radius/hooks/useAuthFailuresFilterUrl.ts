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
import type { RelativeRange } from '@/types/networkAudit';
import { isRelativeRange } from '@/hooks/useRadiusAuthFailures';

const NS = 'auth_';
const k = (key: string) => `${NS}${key}`;

/**
 * Lee y VALIDA el preset relativo de la URL contra el set válido (`5m|1h|24h|7d`).
 * Basura (`?auth_range=5min`) → undefined: se ignora como si no hubiera preset,
 * evitando que un valor inválido llegue a la queryFn y dispare RangeError + loop
 * de error-polling (auth_range presente fuerza el auto-refresh ON).
 */
function parseRange(v: string | null): RelativeRange | undefined {
  return isRelativeRange(v) ? v : undefined;
}

/** auth_auto es tri-estado: '1'→true (forzado ON), '0'→false (forzado OFF), ausente→undefined (default). */
function parseAuto(v: string | null): boolean | undefined {
  if (v === '1') return true;
  if (v === '0') return false;
  return undefined;
}

/**
 * `reply` semantics:
 *   ''            → unset in the URL. The page treats this as the DEFAULT
 *                   (Access-Reject), because the feature is "errores".
 *   'all'         → explicit "Todos" chosen by the user; the page sends NO reply
 *                   param to the BE so both Accept and Reject come back.
 *   'Access-*'    → that exact reply.
 *
 * `reason` semantics: one of the 3 reason values the BE stores, or undefined (sin filtro).
 * Cuando reason está seteado, los chips de conteo resaltan ese chip como activo.
 */
export interface AuthFailuresFilter {
  username?: string;
  reply?: 'Access-Accept' | 'Access-Reject' | 'all' | '';
  from?: string;
  to?: string;
  page?: number;
  reason?: 'session_stuck' | 'user_not_found' | 'other';
  /**
   * Preset de rango RELATIVO (ventana deslizante). Mutuamente excluyente con
   * `from`/`to` (modo absoluto): la page limpia uno al setear el otro.
   */
  relativeRange?: RelativeRange;
  /**
   * Toggle de auto-refresh. Tri-estado: true/false explícito o undefined (default —
   * la page decide ON cuando hay un preset relativo activo).
   */
  autoRefresh?: boolean;
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
    reason:   (searchParams.get(k('reason')) ?? undefined) as AuthFailuresFilter['reason'],
    relativeRange: parseRange(searchParams.get(k('range'))),
    autoRefresh:   parseAuto(searchParams.get(k('auto'))),
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
            reason:   'reason'   in patch ? patch.reason   : (prev.get(k('reason')) ?? undefined) as AuthFailuresFilter['reason'],
            relativeRange: 'relativeRange' in patch ? patch.relativeRange : parseRange(prev.get(k('range'))),
            autoRefresh:   'autoRefresh'   in patch ? patch.autoRefresh   : parseAuto(prev.get(k('auto'))),
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
          setOrDelete('reason', merged.reason);
          setOrDelete('range', merged.relativeRange);
          // auto es tri-estado: '1'/'0' explícito, o se borra cuando es undefined.
          if (merged.autoRefresh === undefined) next.delete(k('auto'));
          else next.set(k('auto'), merged.autoRefresh ? '1' : '0');

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
