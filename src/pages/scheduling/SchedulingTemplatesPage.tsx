import { TaskTemplatesBody } from './settings/TaskTemplatesBody';
import styles from './SchedulingTemplatesPage.module.css';

export default function SchedulingTemplatesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Plantillas</h1>
        </div>
      </div>
      <div className={styles.body}>
        <TaskTemplatesBody />
      </div>
    </div>
  );
}
