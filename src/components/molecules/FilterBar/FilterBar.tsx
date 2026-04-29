import { useState, useEffect, useRef } from 'react';
import { Input } from '../../atoms/Input/Input';
import styles from './FilterBar.module.css';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  onSearch: (value: string) => void;
  filters?: FilterDef[];
  onFilterChange?: (key: string, value: string) => void;
  searchPlaceholder?: string;
}

export function FilterBar({ onSearch, filters = [], onFilterChange, searchPlaceholder = 'Buscar...' }: FilterBarProps) {
  const [searchValue, setSearchValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(searchValue);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchValue, onSearch]);

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrapper}>
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          className={styles.select}
          onChange={(e) => onFilterChange?.(f.key, e.target.value)}
          aria-label={f.label}
        >
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}
