import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { roleDisplay } from '@/constants/rbacRoleLabels';
import type { RbacRoleDto } from '@/types/rbacRole';
import styles from './RbacRolesSelector.module.css';

export interface RbacRolesSelectorProps {
  value: string[];             // selected role ids
  roles: RbacRoleDto[];        // all available roles
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function RbacRolesSelector({
  value,
  roles,
  onChange,
  disabled = false,
  error,
}: RbacRolesSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Compute popover position from the WRAPPER trigger rect (not the chevron
  // button — that would give the popover the ~20px chevron width). Pick the
  // side (below / above) with more vertical room and cap maxHeight to the
  // available space so the popover never overflows the viewport on small
  // screens. Clamp horizontal position too so a narrow window can't push it
  // off the right edge.
  const updatePopoverPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    const gap = 4;
    const minWidth = 240;
    const desiredWidth = Math.max(rect.width, minWidth);
    const width = Math.min(desiredWidth, vw - margin * 2);

    // Horizontal: prefer left-aligned to trigger; clamp inside viewport
    let left = rect.left;
    if (left + width > vw - margin) left = vw - margin - width;
    if (left < margin) left = margin;

    // Vertical: compute room on each side, pick the larger one
    const roomBelow = vh - rect.bottom - gap - margin;
    const roomAbove = rect.top - gap - margin;
    const placeAbove = roomBelow < 220 && roomAbove > roomBelow;
    const maxHeight = Math.max(160, placeAbove ? roomAbove : roomBelow);

    const top = placeAbove ? Math.max(margin, rect.top - gap - maxHeight) : rect.bottom + gap;

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  // Recompute on scroll / resize while open so the popover stays anchored.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      updatePopoverPos();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updatePopoverPos]);

  useEffect(() => {
    if (open) {
      updatePopoverPos();
    }
  }, [open, updatePopoverPos]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Refocus the chevron when popover closes via Escape
  // (handled inside the Escape effect below)

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
        openBtnRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const selectedRoles = roles.filter(r => value.includes(r.id));
  const unselectedRoles = roles.filter(r => !value.includes(r.id));

  const systemRoles = unselectedRoles.filter(r => r.isSystem);
  const customRoles = unselectedRoles.filter(r => !r.isSystem);

  const lowerSearch = search.toLowerCase();
  const filteredSystem = systemRoles.filter(r =>
    roleDisplay(r).label.toLowerCase().includes(lowerSearch),
  );
  const filteredCustom = customRoles.filter(r =>
    roleDisplay(r).label.toLowerCase().includes(lowerSearch),
  );
  const hasNoOptions = filteredSystem.length === 0 && filteredCustom.length === 0;

  function handleRemoveChip(id: string) {
    onChange(value.filter(v => v !== id));
  }

  function handleAddRole(id: string) {
    onChange([...value, id]);
    setSearch('');
  }

  const popoverContent = (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={popoverStyle}
      role="listbox"
      aria-label="Roles disponibles"
    >
      <input
        className={styles.searchInput}
        type="text"
        placeholder="Buscar rol..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      {roles.length === 0 ? (
        <div className={styles.emptyPopover}>No hay roles disponibles</div>
      ) : hasNoOptions ? (
        <div className={styles.emptyPopover}>Sin resultados</div>
      ) : (
        <div className={styles.optionsList}>
          {filteredSystem.length > 0 && (
            <>
              <div className={styles.sectionHeader}>Roles del sistema</div>
              {filteredSystem.map(role => {
                const { label } = roleDisplay(role);
                return (
                  <button
                    key={role.id}
                    role="option"
                    aria-selected={false}
                    className={styles.option}
                    onClick={() => handleAddRole(role.id)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </>
          )}
          {filteredCustom.length > 0 && (
            <>
              <div className={styles.sectionHeader}>Roles personalizados</div>
              {filteredCustom.map(role => {
                const { label } = roleDisplay(role);
                return (
                  <button
                    key={role.id}
                    role="option"
                    aria-selected={false}
                    className={styles.option}
                    onClick={() => handleAddRole(role.id)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.wrapper}>
      <div
        ref={triggerRef}
        className={`${styles.trigger} ${error ? styles.triggerError : ''} ${disabled ? styles.triggerDisabled : ''}`}
      >
        {selectedRoles.map(role => {
          const { label, badgeClass } = roleDisplay(role);
          return (
            <span key={role.id} className={`${styles.chip} ${styles[badgeClass] ?? styles.chipCustom}`}>
              {label}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Quitar ${label}`}
                onClick={() => !disabled && handleRemoveChip(role.id)}
                tabIndex={disabled ? -1 : 0}
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          ref={openBtnRef}
          type="button"
          className={styles.openBtn}
          aria-label="Seleccionar roles"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            setOpen(prev => !prev);
          }}
        >
          ▾
        </button>
      </div>

      {error && <span className={styles.errorMsg} role="alert">{error}</span>}

      {open && createPortal(popoverContent, document.body)}
    </div>
  );
}
