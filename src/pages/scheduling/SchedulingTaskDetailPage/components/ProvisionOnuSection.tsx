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
  // M1 (fix wave) — LATCH del modal: guardamos el contractId con el que se
  // abrió. Mientras esté abierto, un cambio de señal (contrato que refetchea a
  // wireless, contrato que se desasocia de la tarea) NO desmonta la sección —
  // matar el modal a mitad de una ejecución dejaría al operador sin las
  // credenciales ni el resultado por paso. El gate se re-aplica al cerrarlo.
  const [openContractId, setOpenContractId] = useState<string | null>(null);

  const family = contractTechnology ? technologyFamily(contractTechnology) : 'other';
  const gateOk =
    canManage &&
    taskCategory === 'installation' &&
    !!contractId &&
    family !== 'wireless' &&
    family !== 'cable';

  if (!gateOk && openContractId === null) return null;

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
        <button
          type="button"
          className={styles.cta}
          onClick={() => {
            if (contractId) setOpenContractId(contractId);
          }}
        >
          Aprovisionar ONU
        </button>
      </div>
      {/* Montado solo abierto: cada apertura arranca el wizard limpio y la
          query de ONUs no corre de fondo en la página. El modal usa el
          contractId LATCHEADO al abrir, inmune a cambios del task en vivo. */}
      {openContractId !== null && (
        <ProvisionOnuModal
          contractId={openContractId}
          onClose={() => setOpenContractId(null)}
        />
      )}
    </section>
  );
}
