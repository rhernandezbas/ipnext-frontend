import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const trigger = triggerRef.current;
      const menu = document.getElementById('kebab-portal-menu');
      if (
        trigger && !trigger.contains(target) &&
        menu && !menu.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleTrigger() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX,
    });
    setOpen((o) => !o);
  }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={handleTrigger}
        aria-label="Acciones"
        aria-haspopup="true"
        aria-expanded={open}
      >
        &#8942;
      </button>
      {open && createPortal(
        <ul
          id="kebab-portal-menu"
          className={styles.menu}
          role="menu"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-100%)',
          }}
        >
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
        </ul>,
        document.body
      )}
    </div>
  );
}
