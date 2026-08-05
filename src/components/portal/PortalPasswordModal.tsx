import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './PortalPasswordModal.module.css';

interface PortalPasswordModalProps {
  open: boolean;
  clientName: string;
  password: string;
  /** Título contextual — difiere entre "creada" y "regenerada". */
  title?: string;
  onClose: () => void;
}

/**
 * Fallback de copia para contextos no seguros (sin `navigator.clipboard`).
 * JAMÁS confirmar lo que no pasó: si tampoco anda, se le pide al operador que
 * copie a mano (el valor es seleccionable). Molde de `ProvisionOnuModal`.
 */
function legacyCopy(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * PortalPasswordModal (gestion-app) — revela UNA sola vez la contraseña en
 * texto plano que el BE devuelve al crear/regenerar una cuenta del portal. El
 * BE no la vuelve a exponer: el aviso "no se vuelve a ver" es literal.
 *
 * Copia con feedback accesible (`role=status`) + fallback legacy. El botón
 * "Entendido" es la ÚNICA salida deliberada — el operador tiene que reconocer
 * que ya la guardó (por eso no cierra con backdrop ni Escape).
 */
export function PortalPasswordModal({
  open,
  clientName,
  password,
  title = 'Contraseña generada',
  onClose,
}: PortalPasswordModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }

  async function handleCopy() {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(password);
        flash('Copiado');
        return;
      } catch {
        // permiso denegado / clipboard roto → probamos el fallback legacy
      }
    }
    flash(legacyCopy(password) ? 'Copiado' : 'Copiá manualmente');
  }

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="portal-pass-title">
      <div className={styles.dialog}>
        <h2 id="portal-pass-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.subtitle}>
          Contraseña temporal de <strong>{clientName}</strong>. Compartila por un canal seguro.
        </p>

        <div className={styles.passRow}>
          <code className={styles.password}>{password}</code>
          <button type="button" className={styles.copyBtn} onClick={() => void handleCopy()} aria-label="Copiar contraseña">
            Copiar
          </button>
        </div>
        <span role="status" aria-live="polite" className={styles.copyFeedback}>
          {feedback ?? ''}
        </span>

        <p className={styles.warning} role="note">
          Guardala ahora: por seguridad no se vuelve a mostrar. Todas las sesiones activas del cliente
          fueron revocadas.
        </p>

        <div className={styles.actions}>
          <button ref={closeRef} type="button" className={styles.primaryBtn} onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
