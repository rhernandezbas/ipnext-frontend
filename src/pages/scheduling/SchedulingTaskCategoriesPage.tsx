import { TaskCategoriesBody } from './settings/TaskCategoriesBody';
import styles from './SchedulingTaskCategoriesPage.module.css';

export default function SchedulingTaskCategoriesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Categorías de tareas</h1>
        </div>
      </div>
      <TaskCategoriesBody />
    </div>
  );
}
