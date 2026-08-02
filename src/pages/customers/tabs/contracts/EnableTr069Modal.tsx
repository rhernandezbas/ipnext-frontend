import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_TR069_PROFILE } from '@/types/wifi';
import styles from './WifiModals.module.css';

const TR069_PROFILES = [DEFAULT_TR069_PROFILE, 'Wispcontrol'] as const;

interface EnableTr069ModalProps {
  sn: string;
  saving: boolean;
  error: string | null;
  onConfirm: (vlan: number, tr069Profile: string) => void;
  onClose: () => void;
}

/**
 * "Habilitar TR-069" — el primer paso para poder gestionar el WiFi de la ONU
 * (proposal wifi-self-service, punto 1). Pide la VLAN de management SIN
 * default (el BE la exige, el operador la elige) más la pista MERCEDES1=11 /
 * ESTUDIANTES=12, y una confirmación explícita de impacto: esto configura la
 * gestión remota del equipo REAL del cliente.
 */
export function EnableTr069Modal({ sn, saving, error, onConfirm, onClose }: EnableTr069ModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [vlanText, setVlanText] = useState('');
  const [profile, setProfile] = useState<string>(DEFAULT_TR069_PROFILE);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const vlanNum = Number(vlanText);
  const vlanInvalid = vlanText.trim() === '' || !Number.isInteger(vlanNum) || vlanNum < 1 || vlanNum > 4094;
  const canSubmit = !vlanInvalid && !saving;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(vlanNum, profile);
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tr069-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="tr069-modal-title" className={styles.title}>Habilitar TR-069</h2>
            <p className={styles.subtitle}>ONU {sn}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="tr069-vlan" className={styles.label}>VLAN de management</label>
            <input
              ref={firstFieldRef}
              id="tr069-vlan"
              className={`${styles.control} ${touched && vlanInvalid ? styles.controlError : ''}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={4094}
              value={vlanText}
              onChange={(e) => setVlanText(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && vlanInvalid}
              aria-describedby="tr069-vlan-hint"
              required
            />
            <p id="tr069-vlan-hint" className={styles.hint}>
              Sin default — la elige el operador. Ej. MERCEDES1=11, ESTUDIANTES=12.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="tr069-profile" className={styles.label}>Perfil TR-069</label>
            <select
              id="tr069-profile"
              className={styles.control}
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
            >
              {TR069_PROFILES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <p className={styles.impactNote} id="tr069-impact">
            Esto configura la gestión remota del equipo real del cliente (IP de
            management + TR-069 en la ONU).
          </p>

          {error && <p className={styles.formError} role="alert">{error}</p>}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className={styles.dangerBtn}
            aria-describedby="tr069-impact"
            disabled={!canSubmit}
          >
            {saving ? 'Habilitando…' : 'Habilitar TR-069'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
