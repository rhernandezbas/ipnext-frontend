// Re-export shim so `import('@/pages/scheduling/SchedulingCalendarPage')` resolves
// to a sibling `.tsx` file (Vite's preferred resolution path) instead of trying
// to resolve the same-named directory's index.tsx. This mirrors the layout of
// SchedulingTasksPage and avoids the Vite production-build edge case where
// directory-only lazy imports silently produced an empty chunk.
export { default } from './SchedulingCalendarPage/index';
