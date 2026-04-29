import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export function Spinner({ size = 'md', fullPage = false }: SpinnerProps) {
  const spinner = (
    <span
      className={[styles.spinner, styles[size]].join(' ')}
      aria-label="Cargando..."
      role="status"
    />
  );

  if (fullPage) {
    return <div className={styles.overlay}>{spinner}</div>;
  }

  return spinner;
}
