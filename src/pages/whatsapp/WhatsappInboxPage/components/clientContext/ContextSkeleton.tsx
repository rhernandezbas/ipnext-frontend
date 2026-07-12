import { Skeleton } from '../Skeleton';
import styles from '../ClientContextPanel.module.css';

/**
 * ContextSkeleton — loading del contexto rico (messaging-inbox-v2 F1.5,
 * design §4/§8.3). Reserva un alto APROXIMADO al del contenido real
 * (identidad + Financiero/Servicio/Interacciones) para minimizar el layout
 * shift del crossfade skeleton→contenido. `aria-hidden`: decorativo, el
 * "cargando" real lo comunica el container (mismo contrato que el `Skeleton`
 * compartido).
 *
 * Fix bug ALTO layout (review adversarial): los altos viejos (72/56/96)
 * estaban ~2x por debajo del alto real de cada sección (~150/~120/~190,
 * medido con datos típicos — 1 contrato, 1 factura, 1-2 tickets). Con
 * secciones de CARDINALIDAD VARIABLE (0..N contratos/tickets/tareas/logs) es
 * imposible reservar el alto EXACTO sin conocer la data de antemano — estos
 * valores acercan el alto reservado al caso típico, pero SIEMPRE puede haber
 * algún shift residual cuando la data real tiene más ítems que el caso
 * típico (ninguna cantidad fija de layout shift es prometible acá).
 */
export function ContextSkeleton() {
  return (
    <div className={styles['sk-wrapper']} aria-hidden="true">
      <div className={styles['sk-identity']}>
        <Skeleton circle width={36} height={36} />
        <div className={styles['sk-identityLines']}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="50%" height={12} />
        </div>
      </div>
      <Skeleton width="100%" height={152} className={styles['sk-block']} />
      <Skeleton width="100%" height={120} className={styles['sk-block']} />
      <Skeleton width="100%" height={192} className={styles['sk-block']} />
    </div>
  );
}
