import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { FilterBar } from '@/components/molecules/FilterBar/FilterBar';
import { useAdmins, useAdminActivityLog, useCreateAdmin, useUpdateAdmin, useDeleteAdmin, useRoles, useCreateRole, useUpdateRole, useEnable2FA, useDisable2FA, useAdmin2FAStatus } from '@/hooks/useAdmins';
import type { Admin, AdminActivityLog, ActivityCategory } from '@/types/admin';
import type { AdminRole_Definition } from '@/types/role';
import styles from './AdministracionPage.module.css';

type Tab = 'admins' | 'activity' | 'roles' | 'seguridad' | 'sesiones';

function RoleBadge({ role }: { role: Admin['role'] }) {
  const classMap: Record<Admin['role'], string> = {
    superadmin: styles.roleSuperadmin,
    admin: styles.roleAdmin,
    viewer: styles.roleViewer,
  };
  const labelMap: Record<Admin['role'], string> = {
    superadmin: 'Superadmin',
    admin: 'Admin',
    viewer: 'Viewer',
  };
  return <span className={`${styles.roleBadge} ${classMap[role]}`}>{labelMap[role]}</span>;
}

function StatusBadge({ status }: { status: Admin['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusActive : styles.statusInactive}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function TwoFABadge({ adminId }: { adminId: string }) {
  const { data: status } = useAdmin2FAStatus(adminId);
  if (!status) return <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>—</span>;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#fff',
      background: status.enabled ? '#059669' : '#6b7280',
    }}>
      {status.enabled ? 'Habilitado' : 'Deshabilitado'}
    </span>
  );
}

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
              <button
                className={styles.btnDanger ?? styles.btnPrimary}
                onClick={handleDisable}
                disabled={disabling}
              >
                {disabling ? 'Desactivando...' : 'Desactivar 2FA'}
              </button>
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
              <button className={styles.btnPrimary} onClick={handleEnable} disabled={enabling}>
                {enabling ? 'Activando...' : 'Activar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: ActivityCategory }) {
  const colorMap: Record<ActivityCategory, string> = {
    auth: '#dbeafe',
    clients: '#d1fae5',
    billing: '#fef3c7',
    network: '#ede9fe',
    scheduling: '#fce7f3',
    settings: '#f3f4f6',
    admins: '#fee2e2',
    api: '#e0f2fe',
    system: '#f1f5f9',
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: colorMap[category] ?? '#f3f4f6',
      color: '#374151',
    }}>
      {category}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Admin form modal ────────────────────────────────────────────────────────

interface AdminFormProps {
  initialData?: Partial<Admin>;
  title: string;
  onClose: () => void;
  onSubmit: (data: Omit<Admin, 'id' | 'createdAt' | 'lastLogin'>) => void;
}

function AdminFormModal({ initialData, title, onClose, onSubmit }: AdminFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [role, setRole] = useState<Admin['role']>(initialData?.role ?? 'admin');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, email, role, status: initialData?.status ?? 'active' });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="admin-name">Nombre</label>
            <input
              id="admin-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="admin-role">Rol</label>
            <select
              id="admin-role"
              value={role}
              onChange={e => setRole(e.target.value as Admin['role'])}
            >
              <option value="superadmin">Superadmin</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnPrimary}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Activity category filter ────────────────────────────────────────────────

const CATEGORY_FILTERS: { value: ActivityCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'auth', label: 'Auth' },
  { value: 'clients', label: 'Clientes' },
  { value: 'billing', label: 'Facturación' },
  { value: 'network', label: 'Red' },
  { value: 'settings', label: 'Configuración' },
  { value: 'admins', label: 'Admins' },
];

// ── Roles tab ───────────────────────────────────────────────────────────────

const ALL_MODULES = ['clients', 'billing', 'tickets', 'network', 'settings', 'admins'];
const MODULE_LABELS: Record<string, string> = {
  clients: 'Clientes',
  billing: 'Facturación',
  tickets: 'Tickets',
  network: 'Red',
  settings: 'Configuración',
  admins: 'Administradores',
};

function RolesTab({ roles, onSave }: { roles: AdminRole_Definition[]; onSave: (role: AdminRole_Definition) => void }) {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<AdminRole_Definition['permissions']>([]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  function handleSelectRole(role: AdminRole_Definition) {
    setSelectedRoleId(role.id);
    setEditingPermissions([...role.permissions]);
  }

  function hasAction(module: string, action: 'read' | 'write' | 'delete'): boolean {
    return editingPermissions.some(p => p.module === module && p.actions.includes(action));
  }

  function toggleAction(module: string, action: 'read' | 'write' | 'delete') {
    setEditingPermissions(prev => {
      const existing = prev.find(p => p.module === module);
      if (existing) {
        const actions = existing.actions.includes(action)
          ? existing.actions.filter(a => a !== action)
          : [...existing.actions, action];
        return prev.map(p => p.module === module ? { ...p, actions } : p);
      }
      return [...prev, { module, actions: [action] }];
    });
  }

  function handleSave() {
    if (!selectedRole) return;
    onSave({ ...selectedRole, permissions: editingPermissions });
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {/* Role list */}
      <div style={{ width: '220px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Roles</span>
          <button className={styles.btnPrimary} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
            Nuevo rol
          </button>
        </div>
        {roles.map(role => (
          <div
            key={role.id}
            onClick={() => handleSelectRole(role)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleSelectRole(role)}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: selectedRoleId === role.id ? '#2563eb' : '#e5e7eb',
              background: selectedRoleId === role.id ? '#eff6ff' : '#fff',
              marginBottom: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{role.name}</div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{role.description}</div>
          </div>
        ))}
        {roles.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No hay roles definidos.</p>
        )}
      </div>

      {/* Permission matrix */}
      {selectedRole && (
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Permisos: {selectedRole.name}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Módulo</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Leer</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Escribir</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {ALL_MODULES.map(module => (
                <tr key={module}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    {MODULE_LABELS[module] ?? module}
                  </td>
                  {(['read', 'write', 'delete'] as const).map(action => (
                    <td key={action} style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                      <input
                        type="checkbox"
                        checked={hasAction(module, action)}
                        onChange={() => toggleAction(module, action)}
                        disabled={selectedRole.isSystem}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={selectedRole.isSystem}>
              Guardar cambios
            </button>
          </div>
        </div>
      )}
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

// ── Sesiones Tab ────────────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  adminName: string;
  ip: string;
  browser: string;
  loginTime: string;
  lastActivity: string;
  location: string;
}

interface AccessHistoryEntry {
  id: string;
  admin: string;
  ip: string;
  result: 'success' | 'failed';
  browser: string;
  timestamp: string;
}

const MOCK_ACTIVE_SESSIONS: ActiveSession[] = [
  { id: 's1', adminName: 'Super Admin', ip: '192.168.1.1', browser: 'Chrome 124', loginTime: '2026-04-28T07:00:00Z', lastActivity: '2026-04-28T08:30:00Z', location: 'Buenos Aires, AR' },
  { id: 's2', adminName: 'Carlos López', ip: '192.168.1.20', browser: 'Firefox 125', loginTime: '2026-04-28T06:00:00Z', lastActivity: '2026-04-28T08:25:00Z', location: 'Córdoba, AR' },
];

const MOCK_ACCESS_HISTORY: AccessHistoryEntry[] = [
  { id: 'h1', admin: 'Super Admin', ip: '192.168.1.1', result: 'success', browser: 'Chrome 124', timestamp: '2026-04-28T07:00:00Z' },
  { id: 'h2', admin: 'Carlos López', ip: '10.0.0.5', result: 'failed', browser: 'Firefox 125', timestamp: '2026-04-27T22:15:00Z' },
  { id: 'h3', admin: 'Super Admin', ip: '192.168.1.1', result: 'success', browser: 'Chrome 124', timestamp: '2026-04-27T09:00:00Z' },
];

function SesionesTab() {
  const [sessions, setSessions] = useState<ActiveSession[]>(MOCK_ACTIVE_SESSIONS);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [historyAdminFilter, setHistoryAdminFilter] = useState('');
  const [maxDurationHours, setMaxDurationHours] = useState(8);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(30);
  const [concurrentLimit, setConcurrentLimit] = useState(3);

  function forceLogout(sessionId: string) {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }

  const filteredHistory = MOCK_ACCESS_HISTORY.filter(entry => {
    if (historyFilter !== 'all' && entry.result !== historyFilter) return false;
    if (historyAdminFilter && !entry.admin.toLowerCase().includes(historyAdminFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Sesiones activas */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Sesiones activas</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Admin</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>IP</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Navegador</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Inicio sesión</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Última actividad</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Ubicación</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{session.adminName}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{session.ip}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{session.browser}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{formatDate(session.loginTime)}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{formatDate(session.lastActivity)}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{session.location}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                  <button
                    onClick={() => forceLogout(session.id)}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    Forzar logout
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>No hay sesiones activas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Historial de acceso */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Historial de acceso</h2>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Filtrar por admin..."
            value={historyAdminFilter}
            onChange={e => setHistoryAdminFilter(e.target.value)}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          />
          <select
            value={historyFilter}
            onChange={e => setHistoryFilter(e.target.value as 'all' | 'success' | 'failed')}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          >
            <option value="all">Todos</option>
            <option value="success">Exitoso</option>
            <option value="failed">Fallido</option>
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Admin</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>IP</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Resultado</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Navegador</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map(entry => (
              <tr key={entry.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{entry.admin}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>{entry.ip}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: entry.result === 'success' ? '#d1fae5' : '#fee2e2',
                    color: entry.result === 'success' ? '#065f46' : '#991b1b',
                  }}>
                    {entry.result === 'success' ? 'Exitoso' : 'Fallido'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{entry.browser}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f3f4f6' }}>{formatDate(entry.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Configuración de sesión */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Configuración de sesión</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className={styles.formGroup}>
            <label htmlFor="session-max-duration">Duración máxima (horas)</label>
            <input
              id="session-max-duration"
              type="number"
              min={1}
              value={maxDurationHours}
              onChange={e => setMaxDurationHours(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="session-idle-timeout">Timeout inactividad (minutos)</label>
            <input
              id="session-idle-timeout"
              type="number"
              min={1}
              value={idleTimeoutMinutes}
              onChange={e => setIdleTimeoutMinutes(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="session-concurrent">Sesiones simultáneas por admin</label>
            <input
              id="session-concurrent"
              type="number"
              min={1}
              value={concurrentLimit}
              onChange={e => setConcurrentLimit(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Column definitions ──────────────────────────────────────────────────────

const adminColumns = [
  { label: 'Nombre', key: 'name' as keyof Admin },
  { label: 'Email', key: 'email' as keyof Admin },
  {
    label: 'Rol',
    key: 'role' as keyof Admin,
    render: (row: Admin) => <RoleBadge role={row.role} />,
  },
  {
    label: 'Estado',
    key: 'status' as keyof Admin,
    render: (row: Admin) => <StatusBadge status={row.status} />,
  },
  {
    label: '2FA',
    key: 'id' as keyof Admin,
    render: (row: Admin) => <TwoFABadge adminId={row.id} />,
  },
  {
    label: 'Último acceso',
    key: 'lastLogin' as keyof Admin,
    render: (row: Admin) => formatDate(row.lastLogin),
  },
];

const activityColumns = [
  { label: 'Administrador', key: 'adminName' as keyof AdminActivityLog },
  {
    label: 'Categoría',
    key: 'category' as keyof AdminActivityLog,
    render: (row: AdminActivityLog) => <CategoryBadge category={row.category} />,
  },
  { label: 'Acción', key: 'action' as keyof AdminActivityLog },
  { label: 'Detalles', key: 'details' as keyof AdminActivityLog },
  { label: 'IP', key: 'ip' as keyof AdminActivityLog },
  {
    label: 'Fecha/Hora',
    key: 'timestamp' as keyof AdminActivityLog,
    render: (row: AdminActivityLog) => formatDate(row.timestamp),
  },
];

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AdministracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('admins');
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [show2FAModal, setShow2FAModal] = useState<Admin | null>(null);
  const [activityCategory, setActivityCategory] = useState<ActivityCategory | 'all'>('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');

  const { data: admins = [], isLoading: loadingAdmins } = useAdmins();
  const { data: activityLog = [], isLoading: loadingActivity } = useAdminActivityLog();
  const { data: roles = [] } = useRoles();
  const { mutate: createAdmin } = useCreateAdmin();
  const { mutate: updateAdmin } = useUpdateAdmin();
  const { mutate: deleteAdmin } = useDeleteAdmin();
  useCreateRole();
  const { mutate: updateRole } = useUpdateRole();

  function handleCreate(data: Omit<Admin, 'id' | 'createdAt' | 'lastLogin'>) {
    createAdmin(data);
    setShowModal(false);
  }

  function handleEdit(data: Omit<Admin, 'id' | 'createdAt' | 'lastLogin'>) {
    if (!editingAdmin) return;
    updateAdmin({ id: editingAdmin.id, data });
    setEditingAdmin(null);
  }

  const filteredAdmins = adminSearch.trim()
    ? admins.filter(a => {
        const q = adminSearch.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
      })
    : admins;

  const filteredActivity = (() => {
    let list = activityCategory === 'all' ? activityLog : activityLog.filter(l => l.category === activityCategory);
    if (activityDateFrom) {
      list = list.filter(l => l.timestamp >= activityDateFrom);
    }
    if (activityDateTo) {
      // Include the whole "to" day
      const toEnd = activityDateTo + 'T23:59:59Z';
      list = list.filter(l => l.timestamp <= toEnd);
    }
    return list;
  })();

  const adminActions = [
    {
      label: 'Editar',
      onClick: (row: Admin) => {
        setEditingAdmin(row);
      },
    },
    {
      label: 'Configurar 2FA',
      onClick: (row: Admin) => {
        setShow2FAModal(row);
      },
    },
    {
      label: 'Desactivar',
      onClick: (row: Admin) => {
        updateAdmin({ id: row.id, data: { status: 'inactive' } });
      },
    },
    {
      label: 'Eliminar',
      onClick: (row: Admin) => {
        deleteAdmin(row.id);
      },
    },
  ];

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
          Administradores
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

      {activeTab === 'admins' && (
        <>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
              Nuevo administrador
            </button>
          </div>
          <FilterBar
            searchPlaceholder="Buscar por nombre o email..."
            onSearch={setAdminSearch}
          />
          <DataTable
            columns={adminColumns}
            data={filteredAdmins}
            loading={loadingAdmins}
            actions={adminActions}
            emptyMessage="No hay administradores."
          />
        </>
      )}

      {activeTab === 'activity' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} data-testid="category-filter-tabs">
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setActivityCategory(f.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  background: activityCategory === f.value ? '#2563eb' : '#fff',
                  color: activityCategory === f.value ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '0.75rem 0' }}>
            <label htmlFor="activity-date-from" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Desde</label>
            <input
              id="activity-date-from"
              type="date"
              value={activityDateFrom}
              onChange={e => setActivityDateFrom(e.target.value)}
              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
            <label htmlFor="activity-date-to" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Hasta</label>
            <input
              id="activity-date-to"
              type="date"
              value={activityDateTo}
              onChange={e => setActivityDateTo(e.target.value)}
              style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
          </div>
          <DataTable
            columns={activityColumns}
            data={filteredActivity}
            loading={loadingActivity}
            emptyMessage="No hay actividad registrada."
          />
        </>
      )}

      {activeTab === 'roles' && (
        <RolesTab roles={roles} onSave={(role) => updateRole({ id: role.id, data: role })} />
      )}

      {activeTab === 'seguridad' && <SeguridadTab />}

      {activeTab === 'sesiones' && <SesionesTab />}

      {showModal && (
        <AdminFormModal
          title="Nuevo administrador"
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingAdmin && (
        <AdminFormModal
          title="Editar administrador"
          initialData={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSubmit={handleEdit}
        />
      )}

      {show2FAModal && (
        <TwoFAModal
          admin={show2FAModal}
          onClose={() => setShow2FAModal(null)}
        />
      )}
    </div>
  );
}
