import { Link } from 'react-router-dom';
import styles from './Breadcrumbs.module.css';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className={styles.item}>
            {index > 0 && <span className={styles.separator}>/</span>}
            {isLast || !item.to ? (
              <span className={styles.current}>{item.label}</span>
            ) : (
              <Link to={item.to} className={styles.link}>
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
