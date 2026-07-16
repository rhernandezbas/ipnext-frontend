import { useState } from 'react';
import { useCan } from '@/hooks/useMyPermissions';
import { technologyFamily } from '@/types/recaptacion';
import type { TaskCategory } from '@/types/scheduling';
import { ProvisionOnuModal } from './ProvisionOnuModal';
import styles from './ProvisionOnuSection.module.css';

export interface ProvisionOnuSectionProps {
  taskCategory: TaskCategory;
  contractId: string | null;
  /**
   * Tecnología del contrato vinculado (catálogo ServiceTechnology, ej. FTTH).
   * `undefined` = contrato todavía no resuelto/cargado; `null` = sin tecnología.
   */
  contractTechnology?: string | null;
}

/**
 * smartolt-provision-fe (K2-FE) — sección "Aprovisionar ONU" del detalle de tarea.
 *
 * Gate de visibilidad:
 *  1. Permiso `network.manage` (el POST /fiber/provision lo exige — mismo gate acá).
 *  2. Tarea de categoría 'installation' CON contrato asociado (el BE aprovisiona
 *     POR CONTRATO; sin contrato no hay a quién derivar WiFi/PPPoE).
 *  3. Señal de tecnología: la TAREA no lleva tecnología propia (el ingest K1
 *     rutea fibra por projectId, pero ese config es de settings y no viaja en el
 *     DTO de la tarea), así que la señal usable es la tecnología del CONTRATO
 *     (catálogo ServiceTechnology, vía technologyFamily de recaptación):
 *       - familia fiber (Fiber/FTTH)   → mostrar (señal limpia de fibra)
 *       - familia wireless/cable       → ocultar (señal limpia de NO-fibra)
 *       - null/desconocida/no cargada  → MOSTRAR (fallback documentado del
 *         change: ante la duda el botón se ofrece en toda instalación con
 *         contrato; el BE igual rechaza ONUs no-Huawei/no autorizables y el
 *         dry-run obliga a aprobar el plan antes de tocar nada).
 */
export function ProvisionOnuSection({
  taskCategory,
  contractId,
  contractTechnology,
}: ProvisionOnuSectionProps) {
  const canManage = useCan('network.manage');
  const [modalOpen, setModalOpen] = useState(false);

  if (!canManage || taskCategory !== 'installation' || !contractId) return null;

  const family = contractTechnology ? technologyFamily(contractTechnology) : 'other';
  if (family === 'wireless' || family === 'cable') return null;

  return (
    <section className={styles.section} aria-labelledby="provision-onu-section-title">
      <div className={styles.headerRow}>
        <div>
          <h2 id="provision-onu-section-title" className={styles.title}>
            Aprovisionar ONU
          </h2>
          <p className={styles.subtitle}>
            Instalación de fibra — autorizá y configurá la ONU del cliente vía
            SmartOLT, con plan de aprobación previo (dry-run).
          </p>
        </div>
        <button type="button" className={styles.cta} onClick={() => setModalOpen(true)}>
          Aprovisionar ONU
        </button>
      </div>
      {/* Montado solo abierto: cada apertura arranca el wizard limpio y la
          query de ONUs no corre de fondo en la página. */}
      {modalOpen && (
        <ProvisionOnuModal contractId={contractId} onClose={() => setModalOpen(false)} />
      )}
    </section>
  );
}
