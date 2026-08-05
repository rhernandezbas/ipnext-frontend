import { usePromos } from '@/hooks/usePromos';
import { useStoreProducts, useStoreOrders } from '@/hooks/useStore';
import { usePortalAccountsSummary } from '@/hooks/usePortalAccounts';
import { useClientPortalSettings } from '@/hooks/useSettings';
import { derivePromoStatus } from '@/utils/promoStatus';
import { deriveProductStatus } from '@/utils/productStatus';
import { AppSummaryCard, metricFromQuery } from './AppSummaryCard';

/**
 * Las tarjetas con dato de la portada de "Gestión de App".
 *
 * Cada una hace SU propia consulta y vive o muere sola: si un endpoint se cae,
 * degrada esa tarjeta (queda el acceso, sin número) y NO arrastra a las demás
 * ni tumba la página. Por eso el fetch vive acá adentro y no en la página: una
 * tarjeta que el permiso no deja ver ni siquiera se monta, así que tampoco
 * dispara un request condenado al 403.
 */

export function PromosCard() {
  const query = usePromos();
  return (
    <AppSummaryCard
      title="Promociones"
      description="Las promos que ven los clientes dentro de la app."
      to="/admin/portal/promos"
      metrics={[
        {
          label: 'Publicadas',
          testId: 'metric-promos',
          state: metricFromQuery(
            query,
            (promos) => {
              const n = promos.filter((p) => derivePromoStatus(p) === 'published').length;
              return n === 0 ? null : `${n}`;
            },
            'Ninguna publicada',
          ),
        },
      ]}
    />
  );
}

export function StoreCard() {
  const products = useStoreProducts();
  const orders = useStoreOrders();
  return (
    <AppSummaryCard
      title="Tienda"
      description="Productos que se ofrecen en la app y los pedidos que hicieron los clientes."
      to="/admin/portal/store"
      metrics={[
        {
          label: 'Productos activos',
          testId: 'metric-store-products',
          state: metricFromQuery(
            products,
            (list) => {
              const n = list.filter((p) => deriveProductStatus(p) === 'active').length;
              return n === 0 ? null : `${n}`;
            },
            'Ninguno activo',
          ),
        },
        {
          label: 'Pedidos',
          testId: 'metric-store-orders',
          // Las DOS consultas son independientes: que se caiga la de productos
          // no le saca el número a la de pedidos, ni al revés.
          state: metricFromQuery(orders, (list) => (list.length === 0 ? null : `${list.length}`), 'Sin pedidos'),
        },
      ]}
    />
  );
}

export function PortalAccountsCard() {
  const query = usePortalAccountsSummary();
  return (
    <AppSummaryCard
      title="Cuentas de la app"
      description="Clientes con usuario para entrar a la app."
      to="/admin/portal/users"
      metrics={[
        {
          label: 'Cuentas',
          testId: 'metric-accounts',
          // Este endpoint pide `portal.manage`; con sólo `portal.read` responde
          // 403 y la tarjeta degrada — el acceso sigue estando.
          state: metricFromQuery(query, (page) => (page.total === 0 ? null : `${page.total}`), 'Sin cuentas'),
        },
      ]}
    />
  );
}

export function AppConfigCard() {
  const query = useClientPortalSettings();
  return (
    <AppSummaryCard
      title="Configuración de la app"
      description="Qué puede hacer el cliente desde la app. El interruptor general vive en Sistema › Configuración."
      to="/admin/portal"
      metrics={[
        {
          label: 'Estado',
          testId: 'metric-app-status',
          // Kill-switch REAL (`ClientPortalSettings.enabled`, GET
          // /api/settings/client-portal). Nunca cae a 'empty': apagada es un
          // estado legítimo, no un vacío.
          state: metricFromQuery(query, (settings) => (settings.enabled ? 'Activada' : 'Desactivada'), '—'),
        },
      ]}
    />
  );
}

export function PushCard() {
  // Sin métrica a propósito: "cuántos avisos mandé" no es un dato que el BE
  // exponga hoy, y un número inventado acá sería exactamente lo que el change
  // prohíbe. Es una tarjeta de ACCIÓN.
  return (
    <AppSummaryCard
      title="Avisos push"
      description="Mandar un aviso de servicio al teléfono de los clientes (todos o los de un nodo)."
      to="/admin/portal/push"
    />
  );
}
