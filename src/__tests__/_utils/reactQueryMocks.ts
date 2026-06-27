/**
 * Typed stubs for @tanstack/react-query v5 result types.
 *
 * React-query v5 exports discriminated union types for UseMutationResult and
 * UseQueryResult. Partial casts like `{ isPending: false } as UseMutationResult`
 * fail TS2352/TS2345 because the partial object does not satisfy any branch of
 * the union. These helpers fill in all required fields with safe defaults so
 * tests can pass only the fields they care about without `as unknown as` hacks.
 *
 * Usage:
 *   vi.mocked(useFoo).mockReturnValue(mockMutation({ mutateAsync: myFn }));
 *   vi.mocked(useBar).mockReturnValue(mockQuery({ data: result, isLoading: false }));
 */

import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// ─── UseMutationResult ───────────────────────────────────────────────────────

/**
 * Flat override shape for UseMutationResult — accepts vi.fn() for function fields.
 * NoInfer prevents TData/TVariables from being inferred from the literal values
 * passed here; TypeScript instead resolves them from the contextual type (i.e.
 * the return type expected by the mocked hook).
 */
export type MutationOverrides<TData = unknown, TVariables = unknown, TContext = unknown> = {
  data?: NoInfer<TData> | undefined;
  error?: Error | null;
  variables?: NoInfer<TVariables> | undefined;
  context?: NoInfer<TContext> | undefined;
  status?: 'idle' | 'pending' | 'success' | 'error';
  isError?: boolean;
  isIdle?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
  isPaused?: boolean;
  failureCount?: number;
  failureReason?: Error | null;
  submittedAt?: number;
  mutate?: AnyFn;
  mutateAsync?: AnyFn;
  reset?: AnyFn;
};

/**
 * Returns a fully-typed UseMutationResult stub with sane defaults.
 * Pass only the fields your test cares about as overrides.
 */
export function mockMutation<TData = unknown, TVariables = unknown, TContext = unknown>(
  overrides?: MutationOverrides<TData, TVariables, TContext>,
): UseMutationResult<TData, Error, TVariables, TContext> {
  return {
    // MutationState fields
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: 'idle' as const,
    variables: undefined,
    submittedAt: 0,
    // MutationObserverBaseResult additions
    isError: false,
    isIdle: true,
    isPending: false,
    isSuccess: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    // UseBaseMutationResult addition
    mutateAsync: vi.fn(),
    // apply test overrides
    ...overrides,
  } as unknown as UseMutationResult<TData, Error, TVariables, TContext>;
}

// ─── UseQueryResult ──────────────────────────────────────────────────────────

/**
 * Flat override shape for UseQueryResult — accepts vi.fn() for refetch.
 * NoInfer prevents TData from being inferred from the literal `data` value
 * passed here; TypeScript resolves TData from the contextual type instead.
 */
export type QueryOverrides<TData = unknown> = {
  data?: NoInfer<TData> | undefined;
  error?: Error | null;
  dataUpdatedAt?: number;
  errorUpdatedAt?: number;
  failureCount?: number;
  failureReason?: Error | null;
  errorUpdateCount?: number;
  isError?: boolean;
  isFetched?: boolean;
  isFetchedAfterMount?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
  isLoadingError?: boolean;
  isInitialLoading?: boolean;
  isPaused?: boolean;
  isPlaceholderData?: boolean;
  isRefetchError?: boolean;
  isRefetching?: boolean;
  isStale?: boolean;
  isSuccess?: boolean;
  isEnabled?: boolean;
  status?: 'pending' | 'error' | 'success';
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  refetch?: AnyFn;
  promise?: Promise<NoInfer<TData>>;
};

/**
 * Returns a fully-typed UseQueryResult stub with sane defaults.
 * Pass only the fields your test cares about as overrides.
 */
export function mockQuery<TData = unknown>(
  overrides?: QueryOverrides<TData>,
): UseQueryResult<TData, Error> {
  return {
    // QueryObserverBaseResult fields
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isPending: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    isEnabled: true,
    refetch: vi.fn().mockResolvedValue({}),
    status: 'success' as const,
    fetchStatus: 'idle' as const,
    promise: Promise.resolve(undefined) as unknown as Promise<TData>,
    // apply test overrides
    ...overrides,
  } as unknown as UseQueryResult<TData, Error>;
}
