import '@testing-library/jest-dom';
import { vi } from 'vitest';

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
