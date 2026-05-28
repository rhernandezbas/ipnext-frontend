import { StageColorsBody } from './settings/StageColorsBody';
import styles from './SchedulingTaskCategoriesPage.module.css';

export default function SchedulingStageColorsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Colores de estados</h1>
        </div>
      </div>
      <StageColorsBody />
    </div>
  );
}
