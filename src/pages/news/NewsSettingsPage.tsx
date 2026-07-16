import { NewsCategoriesBody } from './components/NewsCategoriesBody';
import styles from './NewsSettingsPage.module.css';

/**
 * NewsSettingsPage (internal-news FE apply — `/admin/news/settings`, gated
 * news.manage). Single-section settings page (only categories today) — molde
 * `TicketsSettingsPage.tsx` header, sin tabs (un solo catálogo, a diferencia
 * de Tickets que tiene 3).
 */
export default function NewsSettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>Noticias /</span>
        <h1 className={styles.title}>Categorías</h1>
      </div>

      <NewsCategoriesBody />
    </div>
  );
}
