import { Link } from 'react-router-dom';
import styles from './SideCard.module.css';

interface ContractDetail {
  plan: string;
  type: string;
  address?: string | null;
  technology?: string | null;
}

interface ContractCardProps {
  contractId: string | null;
  customerId: string | null;
  contract: ContractDetail | null;
  isLoading?: boolean;
}

export function ContractCard({ contractId, customerId, contract, isLoading = false }: ContractCardProps) {
  const renderContent = () => {
    if (!contractId && !customerId) {
      return <p className={styles.emptyText}>Sin contrato asignado</p>;
    }

    return (
      <div className={styles.cardContent}>
        <div className={styles.info}>
          {isLoading ? (
            <span className={styles.servicePlaceholder}>—</span>
          ) : contract ? (
            <>
              <span className={styles.name}>{contract.plan}</span>
              <span className={styles.serviceType}>{contract.type}</span>
            </>
          ) : (
            <span className={styles.name}>Contrato #{contractId}</span>
          )}
          {customerId && (
            <Link
              to={`/admin/customers/view/${customerId}#contratos`}
              className={styles.link}
            >
              Ver contrato →
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="contract-heading">
      <h2 id="contract-heading" className={styles.cardTitle}>Contrato</h2>
      {renderContent()}
    </section>
  );
}
