import { useWorkflows, useUpdateStageColor } from '@/hooks/useWorkflows';
import type { WorkflowStage } from '@/types/workflow';
import styles from './SchedulingTaskCategoriesPage.module.css';

const CATEGORY_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  enProgreso: 'En progreso',
  hecho: 'Hecho',
  cancelado: 'Cancelado',
};

const CATEGORY_FALLBACK: Record<string, string> = {
  nuevo: '#3b82f6',
  enProgreso: '#f59e0b',
  hecho: '#22c55e',
  cancelado: '#ef4444',
};

export default function SchedulingStageColorsPage() {
  const { data: workflows = [], isLoading } = useWorkflows();
  const updateColor = useUpdateStageColor();

  function onColorChange(workflowId: string, stage: WorkflowStage, color: string) {
    void updateColor.mutateAsync({ workflowId, stageId: stage.id, color });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.breadcrumb}>Scheduling /</span>
          <h1 className={styles.title}>Colores de estados</h1>
        </div>
      </div>

      {isLoading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : (
        workflows.map(wf => (
          <div className={styles.card} key={wf.id} style={{ marginBottom: 16 }}>
            <table className={styles.table}>
              <thead>
                <tr><th>Color</th><th>Estado</th><th>Categoría</th></tr>
              </thead>
              <tbody>
                {[...wf.stages].sort((a, b) => a.order - b.order).map(stage => (
                  <tr key={stage.id}>
                    <td>
                      <input
                        type="color"
                        value={stage.color ?? CATEGORY_FALLBACK[stage.category] ?? '#3b82f6'}
                        onChange={e => onColorChange(wf.id, stage, e.target.value)}
                        style={{ width: 44, height: 30, padding: 2, border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
                        aria-label={`Color de ${stage.name}`}
                      />
                    </td>
                    <td>{stage.name}</td>
                    <td className={styles.desc}>{CATEGORY_LABEL[stage.category] ?? stage.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
