import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useConfirm } from '@/context/ConfirmContext';
import { RbacRolesSelector } from './RbacRolesSelector';
import type { RbacUserWithRolesDto, CreateRbacUserPayload, UpdateRbacUserPayload } from '@/types/rbacUser';
import type { RbacRoleDto } from '@/types/rbacRole';
import styles from './RbacUserModal.module.css';

export interface RbacUserModalProps {
  mode: 'create' | 'edit';
  initialValues?: RbacUserWithRolesDto;
  roles: RbacRoleDto[];
  onClose: () => void;
  onSave: (payload: CreateRbacUserPayload | UpdateRbacUserPayload) => Promise<void>;
  loading: boolean;
}

interface FormValues {
  name: string;
  email: string;
  login: string;
  password: string;
  status?: 'active' | 'disabled';
}

// Server error code → user-friendly message + field
type ErrorField = 'login' | 'email' | 'password' | 'banner';
interface MappedError {
  field: ErrorField;
  message: string;
}

function mapServerError(code: string | undefined): MappedError {
  switch (code) {
    case 'LOGIN_ALREADY_TAKEN':
      return { field: 'login', message: 'Ese login ya está en uso' };
    case 'EMAIL_ALREADY_TAKEN':
      return { field: 'email', message: 'Ese email ya está en uso' };
    case 'PASSWORD_TOO_SHORT':
      return { field: 'password', message: 'Contraseña: mínimo 8 caracteres' };
    case 'AT_LEAST_ONE_ROLE_REQUIRED':
      return { field: 'banner', message: 'Tenés que asignar al menos un rol' };
    case 'CANNOT_DELETE_SELF':
      return { field: 'banner', message: 'No podés borrar tu propio usuario' };
    case 'CANNOT_REMOVE_LAST_SUPER_ADMIN':
      return {
        field: 'banner',
        message: 'Quedaría el sistema sin Super Administradores — asigná otro primero',
      };
    default:
      return { field: 'banner', message: 'Ocurrió un error. Intentá de nuevo.' };
  }
}

export function RbacUserModal({
  mode,
  initialValues,
  roles,
  onClose,
  onSave,
  loading,
}: RbacUserModalProps) {
  const isEdit = mode === 'edit';
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    initialValues?.roles.map(r => r.id) ?? [],
  );
  const [rolesError, setRolesError] = useState<string | undefined>(undefined);
  const [serverBanner, setServerBanner] = useState<string | undefined>(undefined);
  const [changePassword, setChangePassword] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      name: initialValues?.name ?? '',
      email: initialValues?.email ?? '',
      login: initialValues?.login ?? '',
      password: '',
      status: initialValues?.status ?? 'active',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // ESC to close
  function handleDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  async function handleOverlayClick() {
    if (isDirty || selectedRoleIds.length > 0 && !initialValues) {
      // only confirm if user modified something
      if (isDirty) {
        if (await confirm({ message: '¿Descartás los cambios?', confirmLabel: 'Descartar' })) onClose();
        return;
      }
    }
    onClose();
  }

  async function onSubmit(data: FormValues) {
    setServerBanner(undefined);
    // Validate roles
    if (selectedRoleIds.length === 0) {
      setRolesError('Seleccioná al menos un rol.');
      return;
    }
    setRolesError(undefined);

    try {
      if (isEdit) {
        const payload: UpdateRbacUserPayload = {
          name: data.name || undefined,
          email: data.email || undefined,
          status: data.status,
        };
        // Include password only if changePassword section is open and has value
        if (changePassword && data.password) {
          payload.password = data.password;
        }
        // Include roleIds via setRoles — backend handles separately
        // For this payload we include roleIds as an UpdateRbacUserPayload extension
        (payload as UpdateRbacUserPayload & { roleIds?: string[] }).roleIds = selectedRoleIds;
        await onSave(payload);
      } else {
        const payload: CreateRbacUserPayload = {
          name: data.name,
          email: data.email,
          login: data.login,
          password: data.password,
          roleIds: selectedRoleIds,
        };
        await onSave(payload);
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const mapped = mapServerError(code);
      if (mapped.field === 'banner') {
        setServerBanner(mapped.message);
      } else {
        setError(mapped.field as keyof FormValues, { message: mapped.message });
      }
    }
  }

  const title = isEdit
    ? `Editar ${initialValues?.name ?? 'usuario'}`
    : 'Nuevo usuario';

  const titleId = 'rbac-user-modal-title';

  return (
    <div
      className={styles.overlay}
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        {/* Sticky header (AD-FE-6) */}
        <div className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>{title}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Server error banner (AD-FE-7) */}
        {serverBanner && (
          <div className={styles.errorBanner} role="alert">
            {serverBanner}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className={styles.formBody} noValidate>
          {/* Name */}
          <div className={styles.formGroup}>
            <label htmlFor="rbac-name">Nombre *</label>
            <input
              id="rbac-name"
              type="text"
              aria-describedby={errors.name ? 'rbac-name-error' : undefined}
              autoFocus
              {...register('name', { required: 'El nombre es obligatorio' })}
            />
            {errors.name && (
              <span id="rbac-name-error" className={styles.fieldError} role="alert">
                {errors.name.message}
              </span>
            )}
          </div>

          {/* Email */}
          <div className={styles.formGroup}>
            <label htmlFor="rbac-email">Email *</label>
            <input
              id="rbac-email"
              type="email"
              aria-describedby={errors.email ? 'rbac-email-error' : undefined}
              {...register('email', {
                required: 'El email es obligatorio',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Ingresá un email válido',
                },
              })}
            />
            {errors.email && (
              <span id="rbac-email-error" className={styles.fieldError} role="alert">
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Login */}
          <div className={styles.formGroup}>
            <label htmlFor="rbac-login">
              Login *{isEdit && (
                <span className={styles.fieldHint} title="El login no se puede modificar una vez creado">
                  {' '}(no editable)
                </span>
              )}
            </label>
            <input
              id="rbac-login"
              type="text"
              disabled={isEdit}
              aria-describedby={errors.login ? 'rbac-login-error' : undefined}
              {...register('login', {
                required: !isEdit ? 'El login es obligatorio' : false,
              })}
            />
            {errors.login && (
              <span id="rbac-login-error" className={styles.fieldError} role="alert">
                {errors.login.message}
              </span>
            )}
          </div>

          {/* Password — always shown in create; collapsed in edit (AD-FE-11) */}
          {!isEdit ? (
            <div className={styles.formGroup}>
              <label htmlFor="rbac-password">Contraseña *</label>
              <input
                id="rbac-password"
                type="password"
                autoComplete="new-password"
                aria-describedby={errors.password ? 'rbac-password-error' : undefined}
                {...register('password', {
                  required: 'La contraseña es obligatoria',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
              />
              {errors.password && (
                <span id="rbac-password-error" className={styles.fieldError} role="alert">
                  {errors.password.message}
                </span>
              )}
            </div>
          ) : (
            <div className={styles.formGroup}>
              <button
                type="button"
                className={styles.togglePasswordBtn}
                onClick={() => setChangePassword(prev => !prev)}
              >
                {changePassword ? 'Cancelar cambio de contraseña' : 'Cambiar contraseña'}
              </button>
              {changePassword && (
                <div className={styles.passwordSection}>
                  <label htmlFor="rbac-password-edit">Nueva contraseña</label>
                  <input
                    id="rbac-password-edit"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby={errors.password ? 'rbac-password-edit-error' : undefined}
                    {...register('password', {
                      minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    })}
                  />
                  {errors.password && (
                    <span id="rbac-password-edit-error" className={styles.fieldError} role="alert">
                      {errors.password.message}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status (edit only) */}
          {isEdit && (
            <div className={styles.formGroup}>
              <label htmlFor="rbac-status">Estado</label>
              <select id="rbac-status" {...register('status')}>
                <option value="active">Activo</option>
                <option value="disabled">Inactivo</option>
              </select>
            </div>
          )}

          {/* Roles multi-select */}
          <div className={styles.formGroup}>
            <label>Roles *</label>
            <RbacRolesSelector
              value={selectedRoleIds}
              roles={roles}
              onChange={ids => {
                setSelectedRoleIds(ids);
                if (ids.length > 0) setRolesError(undefined);
              }}
              error={rolesError}
            />
          </div>

          {/* Actions */}
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={loading}
              aria-label={loading ? 'Guardando' : 'Guardar'}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
