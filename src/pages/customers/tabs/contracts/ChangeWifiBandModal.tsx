import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WifiBand } from '@/types/wifi';
import styles from './WifiModals.module.css';

const SSID_MIN = 1;
const SSID_MAX = 32;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 63;

interface ChangeWifiBandModalProps {
  sn: string;
  band: WifiBand;
  saving: boolean;
  error: string | null;
  onConfirm: (ssid: string, password: string) => void;
  onClose: () => void;
}

/**
 * "Cambiar WiFi" por banda — espeja la validación de forma del BE
 * (`validateWifiCredentials.ts`: ssid 1..32, password 8..63 WPA2) para no
 * dejar disparar un PUT que el server va a rechazar. El PUT manda
 * `{port, ssid, password}` con el `port` TAL CUAL vino en el GET (string tipo
 * 'wifi_0/1' — no es un número, es el identificador SmartOLT del puerto).
 */
export function ChangeWifiBandModal({ sn, band, saving, error, onConfirm, onClose }: ChangeWifiBandModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [ssid, setSsid] = useState(band.ssid ?? '');
  const [password, setPassword] = useState('');
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

  const ssidInvalid = ssid.length < SSID_MIN || ssid.length > SSID_MAX;
  const passwordInvalid = password.length < PASSWORD_MIN || password.length > PASSWORD_MAX;
  const canSubmit = !ssidInvalid && !passwordInvalid && !saving;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onConfirm(ssid, password);
  }

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wifi-band-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className={styles.modal} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <h2 id="wifi-band-modal-title" className={styles.title}>
              Cambiar WiFi {band.band === '2.4' ? '2.4 GHz' : '5 GHz'}
            </h2>
            <p className={styles.subtitle}>ONU {sn}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor="wifi-ssid" className={styles.label}>SSID</label>
            <input
              ref={firstFieldRef}
              id="wifi-ssid"
              className={`${styles.control} ${touched && ssidInvalid ? styles.controlError : ''}`}
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={SSID_MAX}
              aria-invalid={touched && ssidInvalid}
              aria-describedby="wifi-ssid-hint"
              required
            />
            <p id="wifi-ssid-hint" className={touched && ssidInvalid ? styles.errorHint : styles.hint}>
              1 a {SSID_MAX} caracteres.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="wifi-password" className={styles.label}>Clave (WPA2)</label>
            <input
              id="wifi-password"
              className={`${styles.control} ${touched && passwordInvalid ? styles.controlError : ''}`}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={PASSWORD_MAX}
              autoComplete="off"
              aria-invalid={touched && passwordInvalid}
              aria-describedby="wifi-password-hint"
              required
            />
            <p id="wifi-password-hint" className={touched && passwordInvalid ? styles.errorHint : styles.hint}>
              {PASSWORD_MIN} a {PASSWORD_MAX} caracteres.
            </p>
          </div>

          <p className={styles.impactNote} id="wifi-band-impact">
            El WiFi del cliente se reinicia unos segundos al aplicar el cambio.
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
            aria-describedby="wifi-band-impact"
            disabled={!canSubmit}
          >
            {saving ? 'Aplicando…' : 'Aplicar cambio'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
