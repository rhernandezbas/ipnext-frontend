import { useClientContracts } from '@/hooks/useCustomers';
import { ContractCard } from './contracts/ContractCard';
import styles from './ContractsTab.module.css';

interface Props {
  clientId: string;
  active: boolean;
}

/**
 * Contracts tab (#42). Container: fetches the client's contracts (services
 * embedded) and renders one card per contract. There is no create/edit/delete
 * contract flow — contracts sync from Gestión Real.
 */
export function ContractsTab({ clientId, active }: Props) {
  const { data, isLoading } = useClientContracts(clientId, active);
  const contracts = data ?? [];

  if (isLoading) {
    return <p className={styles.loading}>Cargando contratos…</p>;
  }

  if (contracts.length === 0) {
    return (
      <div className={styles.placeholder}>
        <p className={styles.placeholderText}>Este cliente no tiene contratos.</p>
        <p className={styles.placeholderSub}>Los contratos se sincronizan desde Gestión Real.</p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {contracts.map((contract) => (
        <ContractCard key={contract.id} contract={contract} clientId={clientId} active={active} />
      ))}
    </div>
  );
}
