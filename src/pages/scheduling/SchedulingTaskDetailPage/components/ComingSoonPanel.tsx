import styles from './ComingSoonPanel.module.css';

interface ComingSoonPanelProps {
  title: string;
  description: string;
}

export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  return (
    <div className={styles.root}>
      <div className={styles.icon} aria-hidden="true">⏳</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <span className={styles.badge}>Próximamente</span>
    </div>
  );
}
