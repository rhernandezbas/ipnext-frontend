import { useState } from 'react';
import { useEnable2FA, useDisable2FA, useAdmin2FAStatus } from '@/hooks/useAdmins';
import type { Admin } from '@/types/admin';
import { RbacUsersBody } from './admin/RbacUsersBody';
import { RolesMatrixBody } from './admin/RolesMatrixBody';
import { ActivityBody } from './admin/ActivityBody';
import { SessionsBody } from './admin/SessionsBody';
import { Can } from '@/components/auth/Can';
import styles from './AdminPage.module.css';

type Tab = 'admins' | 'activity' | 'roles' | 'seguridad' | 'sesiones';


function TwoFAModal({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const { data: status } = useAdmin2FAStatus(admin.id);
  const { mutate: enable2FA, isPending: enabling } = useEnable2FA();
  const { mutate: disable2FA, isPending: disabling } = useDisable2FA();
  const [method, setMethod] = useState<'totp' | 'sms'>('totp');
  const [result, setResult] = useState<{ qrCode: string; backupCodes: string[] } | null>(null);

  function handleEnable() {
    enable2FA({ adminId: admin.id, method }, {
      onSuccess: (data) => setResult(data),
    });
  }

  function handleDisable() {
    disable2FA(admin.id, { onSuccess: () => onClose() });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Configurar 2FA — {admin.name}</h2>

        {result ? (
          <div>
            <p style={{ fontWeight: 600, color: '#059669' }}>2FA activado exitosamente</p>
            {result.qrCode && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Código QR:</p>
                <img src={result.qrCode} alt="QR Code" style={{ width: 150, height: 150 }} />
              </div>
            )}
            <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Códigos de respaldo:</p>
            <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', background: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem' }}>
              {result.backupCodes.map(code => <div key={code}>{code}</div>)}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
            </div>
          </div>
        ) : status?.enabled ? (
          <div>
            <p>El 2FA está <strong>habilitado</strong> con método: <strong>{status.method}</strong></p>
            <p>Códigos de respaldo restantes: {status.backupCodesCount}</p>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              <Can permission="admin.manage_2fa">
                <button
                  className={styles.btnDanger ?? styles.btnPrimary}
                  onClick={handleDisable}
                  disabled={disabling}
                >
                  {disabling ? 'Desactivando...' : 'Desactivar 2FA'}
                </button>
              </Can>
            </div>
          </div>
        ) : (
          <div>
            <p>El 2FA está <strong>deshabilitado</strong>.</p>
            <div className={styles.formGroup}>
              <label htmlFor="2fa-method">Método</label>
              <select
                id="2fa-method"
                value={method}
                onChange={e => setMethod(e.target.value as 'totp' | 'sms')}
              >
                <option value="totp">Autenticador TOTP</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
              <Can permission="admin.manage_2fa">
                <button className={styles.btnPrimary} onClick={handleEnable} disabled={enabling}>
                  {enabling ? 'Activando...' : 'Activar'}
                </button>
              </Can>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Seguridad Tab ───────────────────────────────────────────────────────────

interface IpWhitelistEntry {
  id: string;
  cidr: string;
  description: string;
  adminName: string;
}

const MOCK_IP_WHITELIST: IpWhitelistEntry[] = [
  { id: '1', cidr: '192.168.1.0/24', description: 'Oficina principal', adminName: 'Super Admin' },
  { id: '2', cidr: '10.0.0.0/8', description: 'VPN corporativa', adminName: 'Carlos López' },
];

function SeguridadTab() {
  const [minLength, setMinLength] = useState(8);
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireNumbers, setRequireNumbers] = useState(true);
  const [requireSymbols, setRequireSymbols] = useState(false);
  const [expirationDays, setExpirationDays] = useState(0);
  const [preventReuseCount, setPreventReuseCount] = useState(5);

  const [require2FAAll, setRequire2FAAll] = useState(false);
  const [require2FARoles, setRequire2FARoles] = useState<Record<string, boolean>>({
    superadmin: true,
    admin: false,
    viewer: false,
  });
  const [gracePeriodHours, setGracePeriodHours] = useState(24);

  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [ipEntries, setIpEntries] = useState<IpWhitelistEntry[]>(MOCK_IP_WHITELIST);

  function removeIpEntry(id: string) {
    setIpEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Política de contraseñas */}
      <div className={styles.card ?? ''} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Política de contraseñas</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label htmlFor="pwd-min-length">Longitud mínima</label>
            <input
              id="pwd-min-length"
              type="number"
              min={6}
              max={32}
              value={minLength}
              onChange={e => setMinLength(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pwd-expiration">Expiración (días, 0=nunca)</label>
            <input
              id="pwd-expiration"
              type="number"
              min={0}
              value={expirationDays}
              onChange={e => setExpirationDays(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="pwd-reuse-count">Prevenir reutilización (últimas N)</label>
            <input
              id="pwd-reuse-count"
              type="number"
              min={0}
              value={preventReuseCount}
              onChange={e => setPreventReuseCount(Number(e.target.value))}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={requireUppercase} onChange={e => setRequireUppercase(e.target.checked)} />
            Requerir mayúsculas
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={requireNumbers} onChange={e => setRequireNumbers(e.target.checked)} />
            Requerir números
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={requireSymbols} onChange={e => setRequireSymbols(e.target.checked)} />
            Requerir símbolos
          </label>
        </div>
      </div>

      {/* Política 2FA */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Política 2FA</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
          <input type="checkbox" checked={require2FAAll} onChange={e => setRequire2FAAll(e.target.checked)} />
          2FA obligatorio para todos
        </label>
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>2FA obligatorio por rol:</p>
          {(['superadmin', 'admin', 'viewer'] as const).map(roleKey => (
            <label key={roleKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                checked={require2FARoles[roleKey]}
                onChange={e => setRequire2FARoles(prev => ({ ...prev, [roleKey]: e.target.checked }))}
              />
              {roleKey}
            </label>
          ))}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="2fa-grace-period">Período de gracia tras login (horas)</label>
          <input
            id="2fa-grace-period"
            type="number"
            min={0}
            value={gracePeriodHours}
            onChange={e => setGracePeriodHours(Number(e.target.value))}
          />
        </div>
      </div>

      {/* IP Whitelist */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>IP Whitelist</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={whitelistEnabled} onChange={e => setWhitelistEnabled(e.target.checked)} />
            Habilitar whitelist
          </label>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>IP/CIDR</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Admin</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {ipEntries.map(entry => (
              <tr key={entry.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{entry.cidr}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{entry.description}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{entry.adminName}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                  <button
                    onClick={() => removeIpEntry(entry.id)}
                    style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className={styles.btnPrimary}
          style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}
          onClick={() => {}}
        >
          Agregar IP
        </button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('admins');
  const [show2FAModal, setShow2FAModal] = useState<Admin | null>(null);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Administración</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'admins' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('admins')}
        >
          Usuarios
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'activity' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Actividad
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'roles' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles y Permisos
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'seguridad' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('seguridad')}
        >
          Seguridad
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sesiones' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sesiones')}
        >
          Sesiones
        </button>
      </div>

      {activeTab === 'admins' && <RbacUsersBody />}

      {activeTab === 'activity' && <ActivityBody />}

      {activeTab === 'roles' && <RolesMatrixBody />}

      {activeTab === 'seguridad' && <SeguridadTab />}

      {activeTab === 'sesiones' && <SessionsBody />}

      {show2FAModal && (
        <TwoFAModal
          admin={show2FAModal}
          onClose={() => setShow2FAModal(null)}
        />
      )}
    </div>
  );
}
