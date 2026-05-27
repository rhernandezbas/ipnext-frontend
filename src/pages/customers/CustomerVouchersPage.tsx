import { useCustomerVouchers } from '@/hooks/useCustomerVouchers';
import type { Voucher } from '@/types/voucher';
import styles from './CustomerVouchersPage.module.css';

function statusLabel(s: Voucher['status']) {
  return s;
}

export default function CustomerVouchersPage() {
  const { data: vouchers, isLoading } = useCustomerVouchers();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Vouchers</h1>
        <button className={styles.generateBtn}>Generar vouchers</button>
      </div>
      {isLoading ? (
        <div>Cargando vouchers...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Plan</th>
              <th>Duración</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {(vouchers ?? []).map(v => (
              <tr key={v.id}>
                <td className={styles.code}>{v.code}</td>
                <td>{v.plan}</td>
                <td>{v.duration}</td>
                <td>${v.price}</td>
                <td>
                  <span className={`${styles.badge} ${styles[v.status]}`}>
                    {statusLabel(v.status)}
                  </span>
                </td>
                <td>{v.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
