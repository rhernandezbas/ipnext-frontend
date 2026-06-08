import { useState } from 'react';
import {
  useInFlightTasks,
  useReconcileTask,
  useRunClosureBackfill,
} from '@/hooks/useIClassClosure';
import type { InFlightTask, ReconcileCounts } from '@/api/iclassClosure.api';
import styles from './InFlightTasksTable.module.css';

type RowResult =
  | { kind: 'counts'; counts: ReconcileCounts }
  | { kind: 'none' }
  | { kind: 'error' };

/** Inline feedback rendered under a row after a per-task reconcile. */
function RowResultCell({ result }: { result: RowResult }) {
  if (result.kind === 'error') {
    return (
      <p className={styles.resultError} role="status">
        No se pudo reconciliar. Reintentá en unos segundos.
      </p>
    );
  }
  if (result.kind === 'none') {
    return (
      <p className={styles.resultMuted} role="status">
        No se encontró cierre reciente para esta OS.
      </p>
    );
  }
  const { mirrored, transitioned } = result.counts;
  return (
    <p className={styles.resultOk} role="status">
      <span className={styles.resultChip}>{mirrored} espejada{mirrored === 1 ? '' : 's'}</span>
      <span className={styles.resultChip}>
        {transitioned} transicionada{transitioned === 1 ? '' : 's'}
      </span>
    </p>
  );
}

function TaskRow({ task }: { task: InFlightTask }) {
  const reconcile = useReconcileTask();
  const [result, setResult] = useState<RowResult | null>(null);

  async function handleReconcile() {
    setResult(null);
    try {
      const counts = await reconcile.mutateAsync(task.id);
      setResult(
        counts.mirrored === 0 && counts.transitioned === 0
          ? { kind: 'none' }
          : { kind: 'counts', counts },
      );
    } catch {
      setResult({ kind: 'error' });
    }
  }

  return (
    <>
      <tr>
        <td className={styles.colSeq}>
          <span className={styles.seq}>#{task.sequenceNumber}</span>
        </td>
        <td className={styles.colTitle}>{task.title}</td>
        <td className={styles.colCustomer}>
          {task.customerName ?? <span className={styles.dash}>—</span>}
        </td>
        <td className={styles.colCode}>
          {task.iclassOrderCode ? (
            <span className={styles.code}>{task.iclassOrderCode}</span>
          ) : (
            <span className={styles.dash}>—</span>
          )}
        </td>
        <td className={styles.colAction}>
          <button
            className={styles.rowBtn}
            onClick={handleReconcile}
            disabled={reconcile.isPending}
          >
            {reconcile.isPending ? 'Reconciliando…' : 'Reconciliar'}
          </button>
        </td>
      </tr>
      {result && (
        <tr className={styles.resultRow}>
          <td />
          <td colSpan={4}>
            <RowResultCell result={result} />
          </td>
        </tr>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>✓</span>
      <p className={styles.emptyTitle}>No hay OS in-flight</p>
      <p className={styles.emptyText}>
        Ninguna tarea está esperando en "Registrado en IClass". Cuando una OS se envíe a IClass
        y aún no se reconcilie, aparecerá acá.
      </p>
    </div>
  );
}

/**
 * Tabla de tareas atascadas en la etapa `registered_in_iclass` (in-flight).
 * Una fila por tarea con un botón "Reconciliar" sincrónico (200 + counts);
 * el resultado se muestra inline bajo la fila. El header expone "Reconciliar
 * todas" que reusa el backfill async (202). Polling stop-at-empty vía
 * useInFlightTasks: una tarea reconciliada y cerrada desaparece al refetch.
 */
export function InFlightTasksTable() {
  const { data, isLoading } = useInFlightTasks();
  const backfill = useRunClosureBackfill();
  const [batchResult, setBatchResult] = useState<'queued' | 'busy' | 'error' | null>(null);

  const items = data?.items ?? [];

  async function handleBackfillAll() {
    setBatchResult(null);
    try {
      const res = await backfill.mutateAsync();
      setBatchResult(res.queued ? 'queued' : 'busy');
    } catch {
      setBatchResult('error');
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h4 className={styles.title}>Órdenes in-flight</h4>
          <p className={styles.subtitle}>
            Tareas enviadas a IClass y a la espera de reconciliar su cierre
          </p>
        </div>
        <button
          className={styles.batchBtn}
          onClick={handleBackfillAll}
          disabled={backfill.isPending || items.length === 0}
        >
          {backfill.isPending ? 'Encolando…' : 'Reconciliar todas'}
        </button>
      </div>

      {batchResult === 'queued' && (
        <div className={`${styles.banner} ${styles.bannerOk}`} role="status">
          <span className={styles.bannerTitle}>Reconciliación encolada.</span> El batch corre en
          segundo plano; la lista se actualiza sola.
        </div>
      )}
      {batchResult === 'busy' && (
        <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
          <span className={styles.bannerTitle}>Ya hay un batch en curso.</span> Esperá a que
          termine antes de volver a dispararlo.
        </div>
      )}
      {batchResult === 'error' && (
        <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
          <span className={styles.bannerTitle}>No se pudo encolar el batch.</span> Reintentá en
          unos segundos.
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>Cargando…</div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colSeq}>#</th>
              <th className={styles.colTitle}>Tarea</th>
              <th className={styles.colCustomer}>Cliente</th>
              <th className={styles.colCode}>OS IClass</th>
              <th className={styles.colAction} aria-label="Acción" />
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
