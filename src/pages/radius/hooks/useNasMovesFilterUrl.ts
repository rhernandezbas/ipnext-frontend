/**
 * useNasMovesFilterUrl — URL-backed filter state for the "Movimientos NAS" tab.
 *
 * Filter fields (public API): outcome, trigger, username, page.
 *
 * URL keys are NAMESPACED with the `mv_` prefix (mv_outcome, mv_trigger,
 * mv_username, mv_page). This hook shares the query string of
 * /admin/networking/audit with useRadiusLogsFilterUrl (logs_*),
 * useNe8000AuditFilterUrl (ne_*) and useAuthFailuresFilterUrl (auth_*);
 * namespacing prevents the tabs from colliding on shared keys (username / page).
 * All writes use replace: true and PRESERVE params that don't belong to this
 * namespace (the other tabs' filters).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PPPOE_NAS_MOVE_OUTCOMES,
  type PppoeNasMoveOutcome,
  type PppoeNasMoveTrigger,
} from '@/types/pppoeNasMove';

const NS = 'mv_';
const k = (key: string) => `${NS}${key}`;

/**
 * Lee y VALIDA el outcome de la URL contra el union del wire contract.
 * Basura (`?mv_outcome=basura`) → undefined: se ignora como si no hubiera
 * filtro, evitando mandarle un valor inválido al BE.
 */
function parseOutcome(v: string | null): PppoeNasMoveOutcome | undefined {
  return v != null && (PPPOE_NAS_MOVE_OUTCOMES as readonly string[]).includes(v)
    ? (v as PppoeNasMoveOutcome)
    : undefined;
}

function parseTrigger(v: string | null): PppoeNasMoveTrigger | undefined {
  return v === 'manual' || v === 'auto' ? v : undefined;
}

/**
 * Lee y VALIDA la página de la URL (mismo espíritu que parseOutcome).
 * Basura (`?mv_page=abc`), cero o negativos → undefined: la page cae a 1 en
 * vez de propagar NaN/0 a la query y a <Pagination currentPage={NaN}>.
 */
function parsePage(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export interface NasMovesFilter {
  outcome?: PppoeNasMoveOutcome;
  trigger?: PppoeNasMoveTrigger;
  username?: string;
  page?: number;
}

export interface NasMovesFilterUrlResult {
  filter: NasMovesFilter;
  setFilter: (patch: Partial<NasMovesFilter>) => void;
  clearFilter: () => void;
}

export function useNasMovesFilterUrl(): NasMovesFilterUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const filter: NasMovesFilter = {
    outcome:  parseOutcome(searchParams.get(k('outcome'))),
    trigger:  parseTrigger(searchParams.get(k('trigger'))),
    username: searchParams.get(k('username')) ?? undefined,
    page:     parsePage(searchParams.get(k('page'))),
  };

  const setFilter = useCallback(
    (patch: Partial<NasMovesFilter>) => {
      setSearchParams(
        (prev) => {
          // Start from prev so we PRESERVE the other tabs' params (logs_* /
          // ne_* / auth_*), then rewrite only this namespace's keys.
          const next = new URLSearchParams(prev);

          const merged: NasMovesFilter = {
            outcome:  'outcome'  in patch ? patch.outcome  : parseOutcome(prev.get(k('outcome'))),
            trigger:  'trigger'  in patch ? patch.trigger  : parseTrigger(prev.get(k('trigger'))),
            username: 'username' in patch ? patch.username : (prev.get(k('username')) ?? undefined),
            page:     'page'     in patch ? patch.page     : parsePage(prev.get(k('page'))),
          };

          const setOrDelete = (key: string, value?: string) => {
            if (value) next.set(k(key), value);
            else next.delete(k(key));
          };

          setOrDelete('outcome',  merged.outcome);
          setOrDelete('trigger',  merged.trigger);
          setOrDelete('username', merged.username);
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
