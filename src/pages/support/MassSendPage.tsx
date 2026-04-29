import styles from './MassSendPage.module.css';

export default function MassSendPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Envío masivo</h1>
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Canal</label>
          <select className={styles.select}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="internal">Mensaje interno</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Destinatarios</label>
          <select className={styles.select}>
            <option value="all">Todos los clientes</option>
            <option value="active">Clientes activos</option>
            <option value="inactive">Clientes inactivos</option>
            <option value="overdue">Con facturas vencidas</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Asunto</label>
          <input type="text" className={styles.input} placeholder="Asunto del mensaje..." />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Mensaje</label>
          <textarea className={styles.textarea} rows={6} placeholder="Escribí el mensaje aquí..." />
        </div>
        <button className={styles.sendBtn}>Enviar</button>
      </div>
    </div>
  );
}
