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
  // Keep latest onSearch in a ref so we don't re-trigger the debounce when the
  // parent passes a fresh inline callback (e.g. on pagination re-render). The
  // debounce must depend ONLY on what the user typed.
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearchRef.current(searchValue);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [searchValue]);

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
