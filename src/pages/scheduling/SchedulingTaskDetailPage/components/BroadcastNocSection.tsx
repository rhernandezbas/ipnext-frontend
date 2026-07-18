import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useBroadcastTaskToNoc } from '@/hooks/useScheduling';
import { mapBroadcastNocError } from './broadcastNocErrors';
import styles from './BroadcastNocSection.module.css';

export interface BroadcastNocSectionProps {
  /** Id de la tarea a difundir. */
  taskId: string;
  /** Discrimina cliente vs red. Solo las de red se difunden al NOC. */
  taskKind: 'customer' | 'network';
  /** Nombre del nodo (solo para el subtítulo informativo). */
  networkSiteName?: string | null;
  /**
   * Callback para surfacear el resultado por el sistema de toast de la página
   * (una sola superficie de toast en el detalle, en vez de una propia acá).
   */
  onResult: (msg: string, type: 'success' | 'error') => void;
}

/**
 * task-broadcast-fe (N3-FE) — sección "Enviar al NOC por WhatsApp" del detalle
 * de tarea.
 *
 * Gate de visibilidad:
 *  1. Permiso `scheduling.write` (el mismo que edita la tarea; el POST lo exige).
 *  2. SOLO tareas de RED (`kind === 'network'`). Las tareas de cliente no se
 *     difunden — el BE devolvería 422 TASK_NOT_BROADCASTABLE, pero preferimos
 *     ocultar el botón antes que ofrecerlo para que falle.
 *
 * Flujo: click → confirm suave → POST /scheduling/:id/broadcast-noc →
 * toast de éxito, o error legible por código (503/502/422x2/404). El botón se
 * deshabilita mientras el POST está en vuelo para evitar doble-envío.
 */
export function BroadcastNocSection({
  taskId,
  taskKind,
  networkSiteName,
  onResult,
}: BroadcastNocSectionProps) {
  const canWrite = useCan('scheduling.write');
  const confirm = useConfirm();
  const broadcast = useBroadcastTaskToNoc(taskId);

  const gateOk = canWrite && taskKind === 'network';
  if (!gateOk) return null;

  const handleSend = async () => {
    // Guard extra contra doble-envío (además del disabled del botón).
    if (broadcast.isPending) return;
    const ok = await confirm({
      title: 'Enviar al NOC por WhatsApp',
      message: 'Se enviará esta tarea al canal del NOC por WhatsApp.',
      confirmLabel: 'Enviar',
    });
    if (!ok) return;
    try {
      await broadcast.mutateAsync();
      onResult('✅ Enviada al canal del NOC', 'success');
    } catch (err) {
      onResult(mapBroadcastNocError(err), 'error');
    }
  };

  return (
    <section className={styles.section} aria-labelledby="broadcast-noc-section-title">
      <div className={styles.headerRow}>
        <div>
          <h2 id="broadcast-noc-section-title" className={styles.title}>
            Difundir al NOC
          </h2>
          <p className={styles.subtitle}>
            Enviá esta tarea de red al canal del NOC por WhatsApp
            {networkSiteName ? ` — nodo ${networkSiteName}` : ''}, con un link directo
            a la tarea.
          </p>
        </div>
        <button
          type="button"
          className={styles.cta}
          onClick={() => { void handleSend(); }}
          disabled={broadcast.isPending}
          aria-label="Enviar al NOC por WhatsApp"
        >
          {broadcast.isPending ? 'Enviando…' : 'Enviar al NOC por WhatsApp'}
        </button>
      </div>
    </section>
  );
}
