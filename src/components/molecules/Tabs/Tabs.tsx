import { ReactNode } from 'react';
import styles from './Tabs.module.css';

interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
  mountMode?: 'all' | 'lazy';
  mountedIds?: Set<string>;
  /** 'compact' tightens tab padding/size so many tabs fit without horizontal scroll. */
  size?: 'default' | 'compact';
}

export function Tabs({ tabs, activeTab, onTabChange, mountMode = 'all', mountedIds, size = 'default' }: TabsProps) {
  return (
    <div className={styles.container}>
      <div className={[styles.tabList, size === 'compact' ? styles.compact : ''].join(' ')} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            className={[styles.tab, tab.id === activeTab ? styles.active : ''].join(' ')}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => {
        const shouldRenderContent = mountMode === 'all' || tab.id === activeTab || mountedIds?.has(tab.id);
        return (
          <div
            key={tab.id}
            id={`panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={tab.id}
            style={{ display: tab.id === activeTab ? 'block' : 'none' }}
            className={styles.panel}
          >
            {shouldRenderContent ? tab.content : null}
          </div>
        );
      })}
    </div>
  );
}
