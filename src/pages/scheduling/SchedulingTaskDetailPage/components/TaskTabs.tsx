import { useState } from 'react';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TaskDetailsTab } from './TaskDetailsTab';
import { TaskCommentsTimeline } from './TaskCommentsTimeline';
import { ComingSoonPanel } from './ComingSoonPanel';
import { TaskInventorySuggestions } from './TaskInventorySuggestions';
import type { TaskDetailsTabProps } from './TaskDetailsTab';
import styles from './TaskTabs.module.css';

export interface TaskTabsProps {
  detailsProps: TaskDetailsTabProps;
  commentsTaskId: string;
  reviewedByInventory: boolean;
  onInventoryToggle: (next: boolean) => void;
}

const TAB_IDS = {
  detalles: 'detalles',
  comentarios: 'comentarios',
  relacionado: 'relacionado',
  inventory: 'inventory',
  registroTrabajo: 'registro-trabajo',
  actividad: 'actividad',
} as const;

interface InventoryPanelProps {
  taskId: string;
  reviewedByInventory: boolean;
  onInventoryToggle: (next: boolean) => void;
}

function InventoryPanel({ taskId, reviewedByInventory, onInventoryToggle }: InventoryPanelProps) {
  return (
    <div className={styles.inventoryPanel}>
      <div className={styles.inventoryToggleRow}>
        <label className={styles.inventoryToggleLabel}>
          <input
            type="checkbox"
            className={styles.inventoryCheckbox}
            checked={reviewedByInventory}
            onChange={(e) => onInventoryToggle(e.target.checked)}
          />
          <span>Revisado por inventario</span>
        </label>
      </div>
      <TaskInventorySuggestions taskId={taskId} />
    </div>
  );
}

export function TaskTabs({
  detailsProps,
  commentsTaskId,
  reviewedByInventory,
  onInventoryToggle,
}: TaskTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.detalles);
  const [mountedIds, setMountedIds] = useState<Set<string>>(
    new Set([TAB_IDS.detalles]),
  );

  function handleTabChange(id: string) {
    setActiveTab(id);
    setMountedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const tabs = [
    {
      id: TAB_IDS.detalles,
      label: 'Detalles',
      content: <TaskDetailsTab {...detailsProps} />,
    },
    {
      id: TAB_IDS.comentarios,
      label: 'Comentarios',
      content: <TaskCommentsTimeline taskId={commentsTaskId} />,
    },
    {
      id: TAB_IDS.relacionado,
      label: 'Relacionado',
      content: (
        <ComingSoonPanel
          title="Relacionado"
          description="Tareas y entidades relacionadas. Próximamente."
        />
      ),
    },
    {
      id: TAB_IDS.inventory,
      label: 'Inventory',
      content: (
        <InventoryPanel
          taskId={commentsTaskId}
          reviewedByInventory={reviewedByInventory}
          onInventoryToggle={onInventoryToggle}
        />
      ),
    },
    {
      id: TAB_IDS.registroTrabajo,
      label: 'Registro de trabajo',
      content: (
        <ComingSoonPanel
          title="Registro de trabajo"
          description="Registrá el tiempo y las actividades de trabajo. Próximamente."
        />
      ),
    },
    {
      id: TAB_IDS.actividad,
      label: 'Actividad',
      content: (
        <ComingSoonPanel
          title="Actividad"
          description="Historial de cambios y auditoría de la tarea. Próximamente."
        />
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        mountMode="lazy"
        mountedIds={mountedIds}
        size="compact"
      />
    </div>
  );
}
