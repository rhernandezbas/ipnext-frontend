import styles from '../SchedulingCalendarPage.module.css';
import sidebarStyles from './ResourceSidebar.module.css';
import type { CalendarResource } from '@/types/calendar';

interface ResourceSidebarProps {
  resources: CalendarResource[];
  isLoading?: boolean;
  headerHeight?: number; // px for top spacer to align with hour header
}

// Deterministic colour from resource name
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ResourceSidebar({ resources, isLoading, headerHeight = 32 }: ResourceSidebarProps) {
  if (isLoading) {
    return (
      <div className={sidebarStyles.sidebar} data-testid="resource-sidebar">
        {/* Spacer to align with hour header */}
        <div style={{ height: headerHeight }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${sidebarStyles.skeletonRow} ${styles.skeleton}`} />
        ))}
      </div>
    );
  }

  return (
    <div className={sidebarStyles.sidebar} data-testid="resource-sidebar">
      {/* Spacer to align with hour header */}
      <div style={{ height: headerHeight, borderBottom: '1px solid var(--color-border)' }} />

      {/* Flat list — one row per resource, no group-header buttons.
          This ensures 1:1 alignment with the grid (WeekView/DayView)
          which has no matching spacer rows for group headers. */}
      {resources.map(resource => (
        <div
          key={resource.id}
          className={sidebarStyles.resourceRow}
          data-testid="resource-row"
          data-resource-id={resource.id}
        >
          <div
            className={styles.avatar}
            style={{ backgroundColor: avatarColor(resource.name) }}
            aria-hidden="true"
          >
            {resource.initials}
          </div>
          <span className={sidebarStyles.resourceName}>{resource.name}</span>
        </div>
      ))}

      {/* "Sin asignar" row always at bottom */}
      <div
        className={sidebarStyles.resourceRow}
        data-testid="resource-row"
        data-resource-id="unassigned"
      >
        <div
          className={styles.avatar}
          style={{ backgroundColor: 'var(--color-gray-300)' }}
          aria-hidden="true"
        >
          ?
        </div>
        <span className={sidebarStyles.resourceName}>Sin asignar</span>
      </div>
    </div>
  );
}
