import { useState, useEffect, useRef } from 'react';
import styles from './KebabMenu.module.css';

interface MenuItem {
  label: string;
  onClick: () => void;
}

interface KebabMenuProps {
  items: MenuItem[];
}

export function KebabMenu({ items }: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="Acciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        &#8942;
      </button>
      {open && (
        <ul className={styles.menu} role="menu">
          {items.map((item) => (
            <li key={item.label}>
              <button
                role="menuitem"
                className={styles.item}
                onClick={() => { item.onClick(); setOpen(false); }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
