import { Link } from 'react-router-dom';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { ClosureProgressTable } from './settings/ClosureProgressTable';
import styles from './SchedulingTaskCategoriesPage.module.css';

/**
 * Standalone page for monitoring pending closure side-effects.
 * Gated by `iclass.manage` via RequirePermission.
 *
 * Route: /admin/scheduling/iclass/closure/pending
 *
 * Hosts the ClosureProgressTable (previously embedded in the Procesamiento
 * sub-tab). Decoupling it here matches the async mental model: trigger the
 * backfill from settings, then watch progress drain on this page.
 */
export function ClosurePendingPage() {
  return (
    <RequirePermission permission="iclass.manage">
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.breadcrumb}>
              <Link to="/admin/scheduling/settings">Scheduling / Configuración /</Link>
            </span>
            <h1 className={styles.title}>Side-effects pendientes</h1>
          </div>
        </div>

        <ClosureProgressTable />
      </div>
    </RequirePermission>
  );
}
