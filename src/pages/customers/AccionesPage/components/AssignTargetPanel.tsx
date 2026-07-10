import { useState } from 'react';
import { CustomerPicker } from '@/components/molecules/CustomerPicker/CustomerPicker';
import { useClientContracts } from '@/hooks/useCustomers';
import styles from './AssignTargetPanel.module.css';

/**
 * AssignTargetPanel — GAP 1 del actions-worklist: un caso `pending` nacido
 * SIN destino (0 candidatos del detector) dejaba al operador en un dead-end
 * visual ("Sin destino" y nada más). Este panel inline permite asignarlo:
 * cliente destino (CustomerPicker, excluye al origen) + contrato de ese
 * cliente (los en baja van deshabilitados — el BE los rechaza con 422
 * INVALID_TARGET_ASSIGNMENT igual) → confirmar dispara el
 * PATCH {targetContractId} en el CaseCard.
 *
 * Reusa los patrones del form-step del TransferServiceModal SIN duplicar el
 * modal: acá no hay transferencia, solo la asignación del destino del caso.
 */

/** Estado del contrato destino → etiqueta corta del <option>. */
const CONTRACT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  late: 'Moroso',
  blocked: 'Bloqueado',
  inactive: 'Inactivo',
  baja: 'Baja',
  new: 'Nuevo',
};

interface AssignTargetPanelProps {
  /** Id del caso — namespacea los ids de los controles del panel. */
  caseId: string;
  /** Cliente ORIGEN del caso — excluido del picker (destino ≠ mismo cliente). */
  sourceClientId: string;
  /** Deshabilita el confirmar mientras el PATCH está en vuelo. */
  pending: boolean;
  /** Confirmar → el CaseCard dispara el PATCH {targetContractId}. */
  onAssign: (targetContractId: string) => void;
  onCancel: () => void;
}

export function AssignTargetPanel({
  caseId,
  sourceClientId,
  pending,
  onAssign,
  onCancel,
}: AssignTargetPanelProps) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [contractId, setContractId] = useState('');
  const contractsQuery = useClientContracts(target?.id ?? '', !!target);
  const contracts = contractsQuery.data ?? [];

  return (
    <section className={styles.panel} aria-label="Asignar destino">
      <p className={styles.title}>Asignar destino</p>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`assign-target-client-${caseId}`}>
          Cliente destino
        </label>
        <CustomerPicker
          id={`assign-target-client-${caseId}`}
          value={target?.id ?? null}
          valueName={target?.name ?? null}
          excludeId={sourceClientId}
          onChange={(id, name) => {
            setTarget(id && name ? { id, name } : null);
            setContractId('');
          }}
        />
      </div>

      {target && (
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`assign-target-contract-${caseId}`}>
            Contrato destino
          </label>
          {contractsQuery.isLoading ? (
            <p className={styles.hint}>Cargando contratos…</p>
          ) : contracts.length === 0 ? (
            <p className={styles.hint}>El cliente destino no tiene contratos.</p>
          ) : (
            <select
              id={`assign-target-contract-${caseId}`}
              className={styles.select}
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">Elegí un contrato…</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id} disabled={c.status === 'baja'}>
                  {(c.name ?? c.plan) +
                    ' — ' +
                    (c.address ?? 'sin dirección') +
                    ' · ' +
                    (CONTRACT_STATUS_LABELS[c.status] ?? c.status)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={contractId === '' || pending}
          onClick={() => onAssign(contractId)}
        >
          Asignar
        </button>
      </div>
    </section>
  );
}
