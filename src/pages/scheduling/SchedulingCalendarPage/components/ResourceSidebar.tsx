import { useState } from 'react';
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
  // Group resources by role
  const grouped = resources.reduce<Record<string, CalendarResource[]>>((acc, r) => {
    if (!acc[r.role]) acc[r.role] = [];
    acc[r.role].push(r);
    return acc;
  }, {});

  // Add "unassigned" group at the bottom
  const roles = Object.keys(grouped);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(role: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

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

      {roles.map(role => (
        <div key={role}>
          <button
            className={sidebarStyles.groupHeader}
            onClick={() => toggleGroup(role)}
            aria-expanded={!collapsed.has(role)}
          >
            <span className={sidebarStyles.groupLabel}>{role}</span>
            <span className={sidebarStyles.collapseIcon}>
              {collapsed.has(role) ? '▶' : '▼'}
            </span>
          </button>
          {!collapsed.has(role) && grouped[role].map(resource => (
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
