import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

// happy-dom does not implement window.alert/confirm/prompt (jsdom shipped them as
// no-op stubs; happy-dom leaves them undefined). Tests that do
// `vi.spyOn(window, 'alert')` need an existing function to wrap — spying on
// `undefined` throws "can only spy on a function". Define real functions here so
// the spy works AND the underlying call is still observable. Defaults mirror the
// browser/jsdom contract (confirm → false, prompt → null) so no behavior shifts.
if (typeof window.alert !== 'function') {
  window.alert = () => {};
}
if (typeof window.confirm !== 'function') {
  window.confirm = () => false;
}
if (typeof window.prompt !== 'function') {
  window.prompt = () => null;
}

// happy-dom label-activation spec bug (through v20.x): when a click bubbles to a
// <label> that wraps MULTIPLE form controls, happy-dom re-dispatches a synthetic
// click to the label's FIRST labelable descendant whenever `event.target` differs
// from that control — WITHOUT the spec-required exclusion for clicks that
// originate on an interactive descendant. Net effect: clicking the 2nd/3rd radio
// of a segmented control also fires the 1st radio's onChange, so the state reverts
// (the tests see the filter/toggle "not applying"). jsdom honors the spec, so this
// only surfaced after the happy-dom migration. See HTMLLabelElement.dispatchEvent
// in happy-dom: it only guards `event.target !== control`.
// Fix (spec-aligned, test-env only — no component touched): when the click target
// IS (or is inside) a labelable control, make the label treat THAT control as its
// `control` for the duration of the dispatch, so the buggy re-dispatch is skipped.
// Clicks on non-control parts of the label (e.g. its text) keep the original
// behavior, so label-text-activates-control still works.
{
  const LabelProto = window.HTMLLabelElement?.prototype as
    | (HTMLLabelElement & { dispatchEvent: (e: Event) => boolean })
    | undefined;
  if (LabelProto) {
    const originalDispatch = LabelProto.dispatchEvent;
    const CONTROL_SELECTOR =
      'button,input:not([type="hidden"]),select,textarea,meter,progress,output';
    LabelProto.dispatchEvent = function patchedLabelDispatch(event: Event) {
      const target = event.target as Element | null;
      if (
        event.type === 'click' &&
        target &&
        (target as unknown) !== (this as unknown) &&
        typeof target.closest === 'function' &&
        target.closest(CONTROL_SELECTOR)
      ) {
        // Force the label's `control` to equal the event target itself, so
        // happy-dom's re-dispatch guard `event.target !== control` is ALWAYS
        // false → the buggy re-dispatch is skipped. Using the target's identity
        // (not `closest(...)`) is what makes this recursion-proof: when the target
        // is an <option> inside a <select> (an interactive descendant that is not
        // itself in CONTROL_SELECTOR) `closest()` would return the <select> and
        // the guard would still fire a re-dispatch → infinite recursion via the
        // <label><select>…</label> pattern (e.g. BulkAssignToolbar).
        Object.defineProperty(this, 'control', {
          configurable: true,
          get: () => target,
        });
        try {
          return originalDispatch.call(this, event);
        } finally {
          delete (this as unknown as { control?: unknown }).control;
        }
      }
      return originalDispatch.call(this, event);
    };
  }
}

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

// Default safe mock for useNewsUnreadCount (internal-news FE apply, sidebar batch).
// Sidebar.tsx calls this hook unconditionally for the "Noticias" badge — it is a
// REAL react-query useQuery under the hood, so every one of the ~12 existing test
// files that render <Sidebar/> WITHOUT a QueryClientProvider (they only ever needed
// MemoryRouter, mirroring the useMyPermissions treatment above) would throw "No
// QueryClient set" once Sidebar starts calling it. Other exports of the module
// (useNewsList, mutations, ...) stay real via importOriginal — only the one hook
// pervasively invoked by Sidebar gets a safe default. Tests that care about the
// badge itself override with vi.mocked(useNewsUnreadCount).mockReturnValue(...);
// src/__tests__/hooks/useNews.test.ts opts out entirely via vi.unmock to exercise
// the real polling implementation.
vi.mock('@/hooks/useNews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useNews')>();
  return {
    ...actual,
    useNewsUnreadCount: vi.fn(() => ({ data: 0, isLoading: false, isError: false })),
  };
});
