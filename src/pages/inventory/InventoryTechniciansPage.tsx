import { Link } from 'react-router-dom';
import { useTechnicianList } from '@/hooks/useTechnicianList';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { NoPermissionPage } from '@/components/auth/NoPermissionPage';
import styles from './InventoryTechniciansPage.module.css';

/**
 * Lista de técnicos con resumen de stock (EPIC #38, Wave 5b).
 *
 * Consumes GET /api/inventory/technicians → [{id, name, assetCount, materialQty}]
 * sorted by name; technicians with no stock location have 0 counts and are
 * included (zero is valid — it means the technician exists but has no assigned
 * stock yet).
 *
 * Each row links to the existing per-technician detail page introduced in W5a.
 * Gate: inventory.read.
 */
export default function InventoryTechniciansPage() {
  const { can, isLoading: permsLoading } = useMyPermissions();
  const { data, isLoading, isError } = useTechnicianList();

  if (!permsLoading && !can('inventory.read')) {
    return <NoPermissionPage />;
  }

  const technicians = data ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>Inventario</p>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Técnicos</h1>
        </div>
        <p className={styles.subtitle}>
          Stock asignado por técnico. Hacé clic en "Ver stock" para ver el detalle.
        </p>
      </header>

      {isError && (
        <p className={styles.errorBanner} role="alert">
          No pudimos cargar la lista de técnicos. Reintentá en unos segundos.
        </p>
      )}

      {isLoading ? (
        <p className={styles.loading}>Cargando técnicos…</p>
      ) : technicians.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <PersonIcon />
          </span>
          <p className={styles.emptyTitle}>Sin técnicos</p>
          <p className={styles.emptyBody}>
            No hay técnicos registrados. Los técnicos aparecen acá cuando tienen stock asignado o
            cuando se crean en el sistema.
          </p>
        </div>
      ) : (
        <section className={styles.section} aria-labelledby="technicians-heading">
          <div className={styles.sectionHead}>
            <h2 id="technicians-heading" className={styles.sectionTitle}>
              Lista de técnicos
            </h2>
            <span className={styles.count}>{technicians.length}</span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col" className={styles.colNum}>Equipos</th>
                  <th scope="col" className={styles.colNum}>Materiales</th>
                  <th scope="col" className={styles.colAction}></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map(tech => (
                  <tr key={tech.id} className={styles.row}>
                    <td className={styles.nameCell}>{tech.name}</td>
                    <td className={styles.numCell}>
                      <span className={tech.assetCount === 0 ? styles.zero : ''}>{tech.assetCount}</span>
                    </td>
                    <td className={styles.numCell}>
                      <span className={tech.materialQty === 0 ? styles.zero : ''}>{tech.materialQty}</span>
                    </td>
                    <td className={styles.actionCell}>
                      <Link
                        to={`/admin/inventory/technicians/${tech.id}`}
                        className={styles.viewLink}
                        aria-label={`Ver stock de ${tech.name}`}
                      >
                        Ver stock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
