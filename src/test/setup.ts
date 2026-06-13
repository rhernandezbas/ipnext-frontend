import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

// Default permissive mock for useMyPermissions.
// Grants ALL permissions so existing tests that transitively render <Can>
// continue to see gated content without having to opt-in. Individual tests
// that need to assert DENIAL should override with:
//   vi.mocked(useMyPermissions).mockReturnValue({ ...deniedShape })
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(() => ({
    permissions: ['*'],
    roles: [],
    user: null,
    isLoading: false,
    isError: false,
    can: () => true,
  })),
  // useCan delegates to useMyPermissions — mock it to return true by default
  // so tests that use <Can> or useCan don't break without explicit setup.
  useCan: vi.fn(() => true),
}));

// Default mock for useConfirm: auto-confirms (resolves true) so existing tests
// that trigger a confirm flow proceed without a real ConfirmProvider. Tests that
// need to assert the prompt or exercise the cancel path should override with:
//   const confirmFn = vi.fn().mockResolvedValue(false);
//   vi.mocked(useConfirm).mockReturnValue(confirmFn);
// (re-apply inside beforeEach if the suite calls vi.clearAllMocks()).
// ConfirmProvider is a passthrough — only main.tsx mounts the real one.
vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(() => vi.fn().mockResolvedValue(true)),
  ConfirmProvider: ({ children }: { children: ReactNode }) => children,
}));
