import { createPortal } from 'react-dom';
import { useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateRbacRole } from '@/hooks/useRbacRoles';
import type { RbacRoleDto } from '@/types/rbacRole';
import styles from './NewRoleModal.module.css';

export interface NewRoleModalProps {
  onClose: () => void;
  onCreated: (role: RbacRoleDto) => void;
}

interface FormValues {
  code: string;
  label: string;
}

function extractErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { code?: string } } }).response;
    return r?.data?.code;
  }
  return undefined;
}

export function NewRoleModal({ onClose, onCreated }: NewRoleModalProps) {
  const { mutateAsync, isPending } = useCreateRbacRole();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ mode: 'onSubmit' });

  // Auto-focus the heading (a11y: announce modal context to screen reader)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function onSubmit(values: FormValues) {
    try {
      const role = await mutateAsync({ code: values.code, label: values.label });
      onCreated(role);
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === 'ROLE_CODE_TAKEN') {
        setError('code', { message: 'Ese código ya existe' });
      } else {
        setError('root', { message: 'Ocurrió un error. Intentá de nuevo.' });
      }
    }
  }

  const modal = (
    <div className={styles.overlay} role="presentation" onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-role-title"
      >
        {/* Sticky header */}
        <div className={styles.header}>
          <h2
            id="new-role-title"
            className={styles.title}
            ref={headingRef}
            tabIndex={-1}
          >
            Nuevo rol
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
          {/* Root-level server error */}
          {errors.root && (
            <p className={styles.errorBanner} role="alert">{errors.root.message}</p>
          )}

          <div className={styles.field}>
            <label htmlFor="role-code" className={styles.label}>
              Código <span aria-hidden="true">*</span>
            </label>
            <input
              id="role-code"
              type="text"
              autoComplete="off"
              placeholder="ej: operaciones"
              className={`${styles.input} ${errors.code ? styles.inputError : ''}`}
              aria-describedby={errors.code ? 'role-code-error' : undefined}
              {...register('code', {
                required: 'Código requerido',
                pattern: {
                  value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                  message: 'Solo letras, números y guiones (kebab-case)',
                },
              })}
            />
            {errors.code && (
              <span id="role-code-error" className={styles.fieldError} role="alert">
                {errors.code.message}
              </span>
            )}
            <span className={styles.hint}>Identificador único, sin espacios. Ej: operaciones-norte</span>
          </div>

          <div className={styles.field}>
            <label htmlFor="role-label" className={styles.label}>
              Nombre <span aria-hidden="true">*</span>
            </label>
            <input
              id="role-label"
              type="text"
              autoComplete="off"
              placeholder="ej: Operaciones"
              className={`${styles.input} ${errors.label ? styles.inputError : ''}`}
              aria-describedby={errors.label ? 'role-label-error' : undefined}
              {...register('label', {
                required: 'Nombre requerido',
                maxLength: { value: 64, message: 'Máximo 64 caracteres' },
              })}
            />
            {errors.label && (
              <span id="role-label-error" className={styles.fieldError} role="alert">
                {errors.label.message}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
