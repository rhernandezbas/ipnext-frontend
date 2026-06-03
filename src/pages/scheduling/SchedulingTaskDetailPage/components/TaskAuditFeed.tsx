import { useTaskAuditFindings } from '@/hooks/useTaskAuditFindings';
import type { AuditFinding, AuditSeverity } from '@/types/taskAudit';
import styles from './TaskAuditFeed.module.css';

const SEVERITY_LABEL: Record<AuditSeverity, string> = { ok: 'OK', warning: 'Atención', critical: 'Crítico' };

function FindingItem({ f }: { f: AuditFinding }) {
  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <span className={`${styles.badge} ${styles[f.severity]}`}>{SEVERITY_LABEL[f.severity]}</span>
        <span className={styles.chip}>{f.category}</span>
        <time className={styles.date} dateTime={f.createdAt}>{new Date(f.createdAt).toLocaleString('es-AR')}</time>
      </div>
      <p className={styles.text}>{f.text}</p>
      {f.photoUrls.length > 0 && (
        <div className={styles.thumbs}>
          {f.photoUrls.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" className={styles.thumbLink}>
              <img className={styles.thumb} src={u} alt="foto de la auditoría" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Feed de auditoría IA de la instalación: clona el patrón del feed de comentarios
 * pero read-only y con autor fijo "Auditoría IA". Cada hallazgo se muestra con su
 * badge de severidad + chip de categoría. Tres estados: sin auditoría / con
 * observaciones / todo OK (un solo finding 'ok').
 */
export function TaskAuditFeed({ taskId }: { taskId: string }) {
  const { data, isLoading } = useTaskAuditFindings(taskId);

  if (isLoading) return <p className={styles.muted}>Cargando auditoría…</p>;

  const findings = data ?? [];
  if (findings.length === 0) {
    return (
      <p className={styles.muted}>
        Sin auditoría para esta instalación. Se genera automáticamente al cerrar la OS en IClass
        (requiere la auditoría IA activa).
      </p>
    );
  }

  return (
    <div className={styles.feed}>
      <div className={styles.author}>
        <span className={styles.avatar}>IA</span>
        <span className={styles.authorName}>Auditoría IA</span>
      </div>
      {findings.map(f => (
        <FindingItem key={f.id} f={f} />
      ))}
    </div>
  );
}
