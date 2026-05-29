import { useState, useEffect, useCallback } from 'react';
import { useRbacRoles } from '@/hooks/useRbacRoles';
import { useRbacPermissions } from '@/hooks/useRbacPermissions';
import { useRolePermissions, useSetRolePermissions } from '@/hooks/useRolePermissions';
import { RolesListRail } from './RolesListRail';
import { PermissionMatrix } from './PermissionMatrix';
import styles from './RolesMatrixBody.module.css';

// ── Skeleton for matrix loading ──────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} data-testid="perm-skeleton" className={styles.skeleton} />
      ))}
    </div>
  );
}

// ── Save feedback banner ─────────────────────────────────────────────────────

type FeedbackKind = 'success' | 'error' | null;

interface FeedbackBannerProps {
  kind: FeedbackKind;
  message: string;
}

function FeedbackBanner({ kind, message }: FeedbackBannerProps) {
  if (!kind) return null;
  return (
    <div
      className={`${styles.banner} ${kind === 'success' ? styles.bannerSuccess : styles.bannerError}`}
      role="status"
      aria-live="polite"
    >
      {kind === 'success' ? '✓' : '⚠'} {message}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SUPER_ADMIN_CODE = 'super_admin';

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { code?: string } } }).response;
    return r?.data?.code;
  }
  return undefined;
}

export function RolesMatrixBody() {
  const { data: roles } = useRbacRoles();
  const { modules, isLoading: catalogLoading } = useRbacPermissions();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [stagedIds, setStagedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; message: string }>({
    kind: null,
    message: '',
  });

  const selectedRole = roles?.find(r => r.id === selectedRoleId);
  const isSuperAdmin = selectedRole?.code === SUPER_ADMIN_CODE;

  const { data: serverPermIds, isLoading: permsLoading } = useRolePermissions(selectedRoleId);
  const { mutateAsync: savePermissions, isPending: isSaving } = useSetRolePermissions();

  // Sync staged + saved when server data arrives or role changes
  useEffect(() => {
    if (serverPermIds !== undefined) {
      const s = new Set(serverPermIds);
      setSavedIds(s);
      setStagedIds(new Set(s)); // reset staged to server state
    }
  }, [serverPermIds, selectedRoleId]);

  const isDirty = !setsEqual(stagedIds, savedIds);

  function handleSelect(roleId: string) {
    if (roleId === selectedRoleId) return;
    if (isDirty && !window.confirm('Tenés cambios sin guardar. ¿Descartar y continuar?')) return;
    setSelectedRoleId(roleId);
    setStagedIds(new Set());
    setSavedIds(new Set());
    setFeedback({ kind: null, message: '' });
  }

  const handleCellChange = useCallback((permId: string, checked: boolean) => {
    setStagedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
  }, []);

  function handleDiscard() {
    setStagedIds(new Set(savedIds));
    setFeedback({ kind: null, message: '' });
  }

  async function handleSave() {
    if (!selectedRoleId || !isDirty) return;
    setFeedback({ kind: null, message: '' });
    try {
      await savePermissions({ roleId: selectedRoleId, permissionIds: Array.from(stagedIds) });
      const saved = new Set(stagedIds);
      setSavedIds(saved);
      setFeedback({ kind: 'success', message: 'Permisos guardados' });
      setTimeout(() => setFeedback({ kind: null, message: '' }), 2000);
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === 'SUPER_ADMIN_IMMUTABLE') {
        setFeedback({ kind: 'error', message: 'El rol Super Administrador no puede modificarse' });
      } else if (code === 'INVALID_PERMISSION_IDS') {
        setFeedback({ kind: 'error', message: 'Algunos permisos no son válidos. Recargá la página.' });
      } else if (code === 'ROLE_NOT_FOUND') {
        setFeedback({ kind: 'error', message: 'El rol ya no existe. Recargá la lista.' });
        setSelectedRoleId(null);
      } else {
        setFeedback({ kind: 'error', message: 'Error al guardar. Intentá de nuevo.' });
      }
      setTimeout(() => setFeedback(f => f.kind === 'error' ? f : { kind: null, message: '' }), 4000);
    }
  }

  const showSaveBar = selectedRoleId !== null && !isSuperAdmin;
  const matrixIsLoading = permsLoading || catalogLoading;

  return (
    <div className={styles.body}>
      {/* Feedback banner */}
      <FeedbackBanner kind={feedback.kind} message={feedback.message} />

      {/* 3-column layout */}
      <div className={styles.layout}>
        {/* Left rail */}
        <RolesListRail selectedRoleId={selectedRoleId} onSelect={handleSelect} />

        {/* Matrix panel */}
        <div className={styles.panel}>
          {!selectedRoleId ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="6" y="10" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 16h16M12 20h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className={styles.emptyText}>Seleccioná un rol para ver sus permisos</p>
            </div>
          ) : matrixIsLoading ? (
            <MatrixSkeleton />
          ) : (
            <PermissionMatrix
              modules={modules}
              selectedIds={stagedIds}
              onChange={handleCellChange}
              roleCode={selectedRole?.code}
              isSaving={isSaving}
            />
          )}
        </div>
      </div>

      {/* Sticky save bar */}
      {showSaveBar && (
        <div
          className={styles.saveBar}
          aria-label={`Editar permisos de ${selectedRole?.label ?? ''}`}
        >
          <span className={styles.saveBarRole}>
            {selectedRole?.label}
            {isDirty && <span className={styles.dirtyDot} aria-label="cambios sin guardar" />}
          </span>
          <div className={styles.saveBarActions}>
            <button
              type="button"
              className={styles.discardBtn}
              onClick={handleDiscard}
              disabled={!isDirty || isSaving}
            >
              Descartar
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              aria-busy={isSaving}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
