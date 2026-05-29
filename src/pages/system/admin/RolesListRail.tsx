import { useState } from 'react';
import { useRbacRoles, useDeleteRbacRole } from '@/hooks/useRbacRoles';
import { NewRoleModal } from './NewRoleModal';
import type { RbacRoleDto } from '@/types/rbacRole';
import styles from './RolesListRail.module.css';

export interface RolesListRailProps {
  selectedRoleId: string | null;
  onSelect: (roleId: string) => void;
}

function SkeletonItems() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} data-testid="role-skeleton" className={styles.skeleton} />
      ))}
    </>
  );
}

export function RolesListRail({ selectedRoleId, onSelect }: RolesListRailProps) {
  const { data: roles, isLoading } = useRbacRoles();
  const { mutateAsync: deleteRole, isPending: deleting } = useDeleteRbacRole();
  const [showNewModal, setShowNewModal] = useState(false);

  async function handleDelete(role: RbacRoleDto, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el rol "${role.label}"? Esta acción no se puede deshacer.`)) return;
    await deleteRole(role.id);
  }

  function handleCreated(role: RbacRoleDto) {
    setShowNewModal(false);
    onSelect(role.id);
  }

  return (
    <div className={styles.rail}>
      <div className={styles.railHeader}>
        <span className={styles.railTitle}>Roles</span>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => setShowNewModal(true)}
        >
          Nuevo rol
        </button>
      </div>

      <div className={styles.list} role="listbox" aria-label="Roles">
        {isLoading ? (
          <SkeletonItems />
        ) : (
          roles?.map(role => {
            const isSelected = role.id === selectedRoleId;
            return (
              <div
                key={role.id}
                role="option"
                aria-selected={isSelected}
                data-role-item
                className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                onClick={() => onSelect(role.id)}
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(role.id)}
              >
                <div className={styles.itemContent}>
                  <span className={styles.itemLabel}>{role.label}</span>
                  {role.isSystem && (
                    <span className={styles.systemBadge}>Sistema</span>
                  )}
                </div>

                {!role.isSystem && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    aria-label={`Eliminar ${role.label}`}
                    onClick={e => handleDelete(role, e)}
                    disabled={deleting}
                    tabIndex={-1}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {showNewModal && (
        <NewRoleModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
