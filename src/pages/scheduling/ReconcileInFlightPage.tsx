import { Link } from 'react-router-dom';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { InFlightTasksTable } from './settings/InFlightTasksTable';
import styles from './SchedulingTaskCategoriesPage.module.css';

/**
 * Standalone page for reconciling tasks stuck in the `registered_in_iclass`
 * stage. Gated by `iclass.manage` via RequirePermission.
 *
 * Route: /admin/scheduling/iclass/closure/reconcile
 *
 * Hosts the InFlightTasksTable: list every in-flight task with a per-row
 * synchronous reconcile (200 + counts) plus a header "Reconciliar todas" that
 * reuses the async batch backfill (202). Mirrors ClosurePendingPage.
 */
export function ReconcileInFlightPage() {
  return (
    <RequirePermission permission="iclass.manage">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.breadcrumb}>
              <Link to="/admin/scheduling/settings">Scheduling / Configuración /</Link>
            </span>
            <h1 className={styles.title}>Reconciliar OS in-flight</h1>
          </div>
        </div>

        <InFlightTasksTable />
      </div>
    </RequirePermission>
  );
}
