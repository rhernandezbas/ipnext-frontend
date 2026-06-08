import { useState } from 'react';
import { useNetworkSites } from '@/hooks/useNetworkSites';
import type { NetworkSite } from '@/types/networkSite';
import styles from './NodeSelector.module.css';

interface NodeSelectorProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

const TYPE_LABELS: Record<NetworkSite['type'], string> = {
  pop: 'POP',
  nodo: 'Nodo',
  datacenter: 'DC',
  tower: 'Torre',
  other: 'Otro',
};

/**
 * Network site picker — lists all active sites with search and selection.
 * Calls onChange(id) on select, onChange(null) on deselect.
 */
export function NodeSelector({ value, onChange }: NodeSelectorProps) {
  const [query, setQuery] = useState('');
  const { data: sites = [], isLoading } = useNetworkSites();

  const filtered = query.trim()
    ? sites.filter(
        s =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.city.toLowerCase().includes(query.toLowerCase()),
      )
    : sites;

  function handleSelect(id: string) {
    onChange(value === id ? null : id);
  }

  if (isLoading) {
    return <div className={styles.loading}>Cargando nodos…</div>;
  }

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.search}
        placeholder="Buscar nodo o ciudad…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Buscar nodo"
      />

      {filtered.length === 0 ? (
        <div className={styles.empty}>Sin resultados para "{query}"</div>
      ) : (
        <ul className={styles.list} role="listbox" aria-label="Nodos de red">
          {filtered.map(site => {
            const isSelected = site.id === value;
            return (
              <li
                key={site.id}
                role="option"
                aria-selected={isSelected}
                className={styles.item}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => handleSelect(site.id)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(site.id);
                  }
                }}
              >
                <span className={styles.itemBody}>
                  <span className={styles.itemName}>{site.name}</span>
                  <span className={styles.itemMeta}>
                    {site.city}
                    <span className={styles.typePill}>{TYPE_LABELS[site.type]}</span>
                    {site.iclassNodeCode && (
                      <span className={styles.codeTag}>{site.iclassNodeCode}</span>
                    )}
                  </span>
                </span>
                {isSelected && (
                  <span className={styles.checkMark} aria-hidden="true">✓</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
