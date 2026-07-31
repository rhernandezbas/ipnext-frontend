import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs } from '@/components/molecules/Tabs/Tabs';
import { TicketMessagingThread } from './messaging/TicketMessagingThread';
import type { RelatedTask } from '@/types/ticket';
import styles from './TicketTabs.module.css';

export interface TicketTabsProps {
  ticketId: string;
  /** #77 — passed through to TicketMessagingThread for the synthetic opening comment. */
  description: string;
  reporterName?: string | null;
  createdAt?: string;
  tasks?: RelatedTask[];
}

const TAB_IDS = {
  conversacion: 'conversacion',
  relacionado: 'relacionado',
} as const;

/** Relacionado tab — ScheduledTasks created from this ticket. */
function RelacionadoPanel({ tasks }: { tasks?: RelatedTask[] }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className={styles.relEmptyState}>
        No hay tareas vinculadas a este ticket
      </div>
    );
  }
  return (
    <ul className={styles.relList}>
      {tasks.map((task) => (
        <li key={task.id} className={styles.relItem}>
          <Link to={`/admin/scheduling/tasks/${task.id}`} className={styles.relLink}>
            #{task.sequenceNumber} — {task.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TicketTabs({ ticketId, description, reporterName, createdAt, tasks }: TicketTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(TAB_IDS.conversacion);
  const [mountedIds, setMountedIds] = useState<Set<string>>(
    new Set([TAB_IDS.conversacion]),
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
      id: TAB_IDS.conversacion,
      label: 'Conversación',
      content: (
        // C1 (fix wave, CRITICAL) — key={ticketId}: la ruta es
        // /admin/tickets/:id y React Router NO remonta al cambiar solo el
        // param. Sin esta key, TicketMessagingThread (y por lo tanto los
        // composers y el seenIdsRef que vive adentro) sobrevive al cambio de
        // ticket con su draft/adjuntos/refs intactos — un borrador escrito en
        // el ticket A se manda al ticket B. Ver TicketTabs.crossTicketState.test.tsx.
        <TicketMessagingThread
          key={ticketId}
          ticketId={ticketId}
          description={description}
          reporterName={reporterName}
          createdAt={createdAt}
        />
      ),
    },
    {
      id: TAB_IDS.relacionado,
      label: 'Relacionado',
      content: <RelacionadoPanel tasks={tasks} />,
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
