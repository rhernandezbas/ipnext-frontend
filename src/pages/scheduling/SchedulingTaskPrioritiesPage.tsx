import { TaskPrioritiesBody } from './settings/TaskPrioritiesBody';
import styles from './SchedulingTaskCategoriesPage.module.css';

export default function SchedulingTaskPrioritiesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Prioridades</h1>
        </div>
      </div>
      <TaskPrioritiesBody />
    </div>
  );
}
