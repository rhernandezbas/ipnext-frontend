import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  PromosCard,
  StoreCard,
  PushCard,
  PortalAccountsCard,
  AppConfigCard,
} from './components/OverviewCards';
import styles from './AppOverviewPage.module.css';

/**
 * AppOverviewPage (gestion-app) — portada de la sección "Gestión de App".
 *
 * NO es una pantalla nueva de gestión: es el índice de lo que ya existe
 * (Promociones, Tienda, Avisos push, Cuentas, Configuración), con el estado
 * real de cada cosa para que el operador sepa a dónde entrar sin adivinar.
 *
 * REGLA DURA del change, implementada en `AppSummaryCard`/`metricFromQuery`:
 * si un endpoint falla o el dato no existe, la tarjeta muestra su acceso SIN
 * el número. Nunca un número inventado (ni un `0` de relleno, que el operador
 * leería como "no hay ninguna"), nunca un error que rompa la página. Cada
 * tarjeta consulta lo suyo y degrada sola.
 *
 * Gating: la ruta ya exige `portal.read`; acá se filtra ADEMÁS cada tarjeta por
 * el permiso de SU sub-página (los mismos gates propios que usa el sidebar), así
 * la portada no ofrece puertas que el operador no puede abrir.
 */
export default function AppOverviewPage() {
  const { can } = useMyPermissions();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.breadcrumb}>Gestión de App /</span>
        <h1 className={styles.title}>Resumen</h1>
        <p className={styles.subtitle}>
          Todo lo que ven los clientes en la app: promociones, tienda, avisos y cuentas.
        </p>
      </div>

      <div className={styles.grid}>
        {can('promos.read') && <PromosCard />}
        {can('store.read') && <StoreCard />}
        {can('push.send') && <PushCard />}
        {can('portal.read') && <PortalAccountsCard />}
        {can('portal.read') && <AppConfigCard />}
      </div>
    </div>
  );
}
