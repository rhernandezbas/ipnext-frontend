import { Link } from 'react-router-dom';
import type { WhatsappClientContextClient } from '@/types/whatsapp';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { toStatusBadgeVariant } from './statusBadgeVariant';
import styles from '../ClientContextPanel.module.css';

interface CandidatePickerProps {
  clients: WhatsappClientContextClient[];
  onChoose: (id: string) => void;
}

/**
 * CandidatePicker — lista de candidatos en `ambiguous` (messaging-inbox-v2
 * F1.5, design §1/§5.0). Usa SOLO el `lightContext` liviano (nombre+status,
 * ya disponible en el detalle F1) — CTX-1 prohíbe agregar datos de nadie
 * hasta que el agente elige, así que este componente NUNCA dispara el fetch
 * rico. "Ver perfil" navega directo a la ficha (contrato heredado del
 * `ClientContextPanel` histórico); "Elegir" confirma el candidato y dispara
 * `useInboxClientContext` con ese `clientId` (vía `onChoose` en el container).
 */
export function CandidatePicker({ clients, onChoose }: CandidatePickerProps) {
  return (
    <>
      <p className={styles['cand-hint']}>Varios clientes posibles — elegí uno para confirmar.</p>
      <ul className={styles['cand-list']}>
        {clients.map((c) => (
          <li key={c.id} className={styles['cand-item']}>
            <span className={styles['cand-name']}>{c.name}</span>
            <StatusBadge status={toStatusBadgeVariant(c.status)} />
            <div className={styles['cand-actions']}>
              <Link to={`/admin/customers/view/${c.id}`} className={styles['cand-link']}>
                Ver perfil →
              </Link>
              <button type="button" className={styles['cand-choose']} onClick={() => onChoose(c.id)}>
                Elegir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
