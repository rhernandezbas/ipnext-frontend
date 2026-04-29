import styles from './PlaceholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description ?? 'Sección en desarrollo.'}</p>
    </div>
  );
}
