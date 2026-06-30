import { useState } from 'react';
import { useConfirm } from '@/context/ConfirmContext';
import { useRbacUsers, useCreateRbacUser, useUpdateRbacUser, useDeleteRbacUser, useSetUserRoles, useUnlockRbacUser } from '@/hooks/useRbacUsers';
import { useRbacRoles } from '@/hooks/useRbacRoles';
import { roleDisplay } from '@/constants/rbacRoleLabels';
import { RbacUserModal } from './RbacUserModal';
import { formatTimeShort } from '@/utils/formatDate';
import type { RbacUserWithRolesDto, CreateRbacUserPayload, UpdateRbacUserPayload } from '@/types/rbacUser';
import styles from './RbacUsersBody.module.css';

// ── Lock helpers ─────────────────────────────────────────────────────────────

/** True only when lockedUntil is set AND still in the future. */
function isLocked(lockedUntil: string | null | undefined): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

// ── Error code → message ─────────────────────────────────────────────────────

function mapDeleteError(code: string | undefined): string {
  switch (code) {
    case 'CANNOT_DELETE_SELF':
      return 'No podés borrar tu propio usuario';
    case 'CANNOT_REMOVE_LAST_SUPER_ADMIN':
      return 'Quedaría el sistema sin Super Administradores — asigná otro primero';
    default:
      return 'No se pudo eliminar el usuario. Intentá de nuevo.';
  }
}

function mapUnlockError(): string {
  return 'No se pudo desbloquear el usuario. Intentá de nuevo.';
}

// ── Skeleton rows (AD-FE-5) ──────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} data-testid="skeleton-row">
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} className={styles.skeletonCell}>
              <span className={styles.skeleton} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// ── Locked badge ──────────────────────────────────────────────────────────────

function LockedBadge({ lockedUntil }: { lockedUntil: string }) {
  const time = formatTimeShort(lockedUntil);
  return (
    <span className={styles.statusLocked} aria-label={`Bloqueado hasta las ${time}`}>
      Bloqueado hasta {time}
    </span>
  );
}

// ── Role chips ───────────────────────────────────────────────────────────────

function RoleChips({ user }: { user: RbacUserWithRolesDto }) {
  const MAX_VISIBLE = 3;
  const visible = user.roles.slice(0, MAX_VISIBLE);
  const overflow = user.roles.length - MAX_VISIBLE;

  return (
    <span className={styles.roleChips}>
      {visible.map(role => {
        const { label, badgeClass } = roleDisplay(role);
        return (
          <span
            key={role.id}
            className={`${styles.roleChip} ${styles[badgeClass] ?? styles.chipCustom}`}
          >
            {label}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className={`${styles.roleChip} ${styles.chipOverflow}`}>+{overflow}</span>
      )}
    </span>
  );
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} meses`;
  return `Hace más de un año`;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden="true">👤</div>
      <h3 className={styles.emptyTitle}>No hay usuarios registrados</h3>
      <p className={styles.emptyBody}>
        Si recién deployaste, verificá{' '}
        <code className={styles.envCode}>BOOTSTRAP_RBAC_*</code>{' '}
        en el servidor, o creá el primer usuario manualmente.
      </p>
      <button className={styles.btnPrimary} onClick={onCreateClick} type="button">
        Crear usuario
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RbacUsersBody() {
  const { data: users, isLoading, isError, refetch } = useRbacUsers();
  const { data: roles = [] } = useRbacRoles();

  const createMutation = useCreateRbacUser();
  const updateMutation = useUpdateRbacUser();
  const deleteMutation = useDeleteRbacUser();
  const setRolesMutation = useSetUserRoles();
  const unlockMutation = useUnlockRbacUser();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<RbacUserWithRolesDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const confirm = useConfirm();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSave(payload: CreateRbacUserPayload | UpdateRbacUserPayload) {
    if (editingUser) {
      // Edit mode
      const { roleIds, ...rest } = payload as UpdateRbacUserPayload & { roleIds?: string[] };
      await updateMutation.mutateAsync({ id: editingUser.id, payload: rest });
      if (roleIds) {
        await setRolesMutation.mutateAsync({ userId: editingUser.id, roleIds });
      }
      setEditingUser(null);
    } else {
      // Create mode
      const createPayload = payload as CreateRbacUserPayload;
      await createMutation.mutateAsync(createPayload);
      setShowCreateModal(false);
    }
  }

  async function handleDelete(user: RbacUserWithRolesDto) {
    const rolesLabel = user.roles.map(r => roleDisplay(r).label).join(', ');
    const confirmed = await confirm({
      message: `¿Eliminás a ${user.name} (${user.login})? Esta acción no se puede deshacer.\nRoles actuales: ${rolesLabel || 'ninguno'}`,
      tone: 'danger',
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(user.id);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setDeleteError(mapDeleteError(code));
    }
  }

  async function handleUnlock(user: RbacUserWithRolesDto) {
    const confirmed = await confirm({
      message: `¿Desbloquear a ${user.login}? Podrá volver a iniciar sesión.`,
      confirmLabel: 'Desbloquear',
    });
    if (!confirmed) return;

    setUnlockError(null);
    try {
      await unlockMutation.mutateAsync(user.id);
    } catch {
      setUnlockError(mapUnlockError());
    }
  }

  return (
    <div className={styles.body}>
      {/* Header (AD-FE-1: table is primary surface) */}
      <div className={styles.header}>
        <h2 className={styles.heading}>Usuarios</h2>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setShowCreateModal(true)}
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Delete error toast */}
      {deleteError && (
        <div className={styles.errorToast} role="alert">
          {deleteError}
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setDeleteError(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Unlock error toast */}
      {unlockError && (
        <div className={styles.errorToast} role="alert">
          {unlockError}
          <button
            type="button"
            className={styles.toastClose}
            onClick={() => setUnlockError(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className={styles.errorBanner} role="alert">
          <span>Error al cargar los usuarios.</span>
          <button type="button" className={styles.retryBtn} onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {/* Table (AD-FE-1) */}
      {!isError && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Login</th>
                <th>Roles</th>
                <th>Estado</th>
                <th>Última sesión</th>
                <th className={styles.actionsCol}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : users && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    <EmptyState onCreateClick={() => setShowCreateModal(true)} />
                  </td>
                </tr>
              ) : (
                users?.map(user => (
                  <tr key={user.id} className={styles.row}>
                    <td className={styles.cellName}>{user.name}</td>
                    <td className={styles.cellEmail}>{user.email}</td>
                    <td className={styles.cellLogin}>
                      <code className={styles.loginCode}>{user.login}</code>
                    </td>
                    <td>
                      <RoleChips user={user} />
                    </td>
                    <td>
                      <div className={styles.statusCell}>
                        <StatusBadge status={user.status} />
                        {isLocked(user.lockedUntil) && (
                          <LockedBadge lockedUntil={user.lockedUntil!} />
                        )}
                      </div>
                    </td>
                    <td className={styles.cellMuted}>{relativeTime(user.lastLoginAt)}</td>
                    <td className={styles.cellActions}>
                      <button
                        type="button"
                        className={styles.btnEdit}
                        onClick={() => setEditingUser(user)}
                      >
                        Editar
                      </button>
                      {isLocked(user.lockedUntil) && (
                        <button
                          type="button"
                          className={styles.btnUnlock}
                          onClick={() => handleUnlock(user)}
                        >
                          Desbloquear
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btnDelete}
                        onClick={() => handleDelete(user)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <RbacUserModal
          mode="create"
          roles={roles}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
          loading={isSaving}
        />
      )}

      {/* Edit modal */}
      {editingUser && (
        <RbacUserModal
          mode="edit"
          initialValues={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSave={handleSave}
          loading={isSaving}
        />
      )}
    </div>
  );
}
