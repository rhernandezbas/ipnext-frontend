import { useState, useRef } from 'react';
import {
  useSystemSettings,
  useUpdateSystemSettings,
  useEmailSettings,
  useUpdateEmailSettings,
  useSendTestEmail,
  useTemplates,
  useUpdateTemplate,
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
  useFinanceSettings,
  useUpdateFinanceSettings,
  usePaymentMethods,
  useCreatePaymentMethod,
  useWebhooks,
  useCreateWebhook,
  useTestWebhook,
  useBackups,
  useCreateBackup,
  useClientPortalSettings,
  useUpdateClientPortalSettings,
} from '@/hooks/useSettings';
import type { SystemSettings, EmailSettings, MessageTemplate, PaymentMethod, TemplateVariable, Webhook, WebhookEvent, ClientPortalSettings } from '@/types/settings';
import styles from './ConfiguracionPage.module.css';

type Tab = 'sistema' | 'correo' | 'plantillas' | 'tokens' | 'finanzas' | 'webhooks' | 'respaldo' | 'portal-cliente' | 'notificaciones' | 'politicas-red' | 'addons' | 'system-logs' | 'scheduled-tasks' | 'integraciones';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function typeBadgeClass(type: MessageTemplate['type']): string {
  const map: Record<MessageTemplate['type'], string> = {
    welcome: styles.typeWelcome,
    invoice: styles.typeInvoice,
    payment: styles.typePayment,
    overdue: styles.typeOverdue,
    custom: styles.typeCustom,
  };
  return map[type] ?? styles.typeCustom;
}

function typeLabel(type: MessageTemplate['type']): string {
  const map: Record<MessageTemplate['type'], string> = {
    welcome: 'Bienvenida',
    invoice: 'Factura',
    payment: 'Pago',
    overdue: 'Vencido',
    custom: 'Personalizado',
  };
  return map[type] ?? type;
}

// ── Sistema Tab ────────────────────────────────────────────────────────────

function SistemaTab() {
  const { data } = useSystemSettings();
  const { mutate } = useUpdateSystemSettings();

  const [form, setForm] = useState<SystemSettings>({
    companyName: data?.companyName ?? '',
    timezone: data?.timezone ?? '',
    currency: data?.currency ?? 'ARS',
    language: data?.language ?? 'es',
    dateFormat: data?.dateFormat ?? 'DD/MM/YYYY',
    invoicePrefix: data?.invoicePrefix ?? '',
    supportEmail: data?.supportEmail ?? '',
    website: data?.website ?? '',
  });

  // Sync when data arrives (data is seeded, so usually immediate in tests)
  const effectiveForm: SystemSettings = data
    ? { ...data, ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '') ) }
    : form;

  function handleChange(field: keyof SystemSettings, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(effectiveForm);
  }

  const displayForm = data ?? form;

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-companyName">Nombre de empresa</label>
            <input
              id="cfg-companyName"
              type="text"
              value={displayForm.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-timezone">Zona horaria</label>
            <select
              id="cfg-timezone"
              value={displayForm.timezone}
              onChange={e => handleChange('timezone', e.target.value)}
            >
              <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/Madrid">Europe/Madrid</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-currency">Moneda</label>
            <select
              id="cfg-currency"
              value={displayForm.currency}
              onChange={e => handleChange('currency', e.target.value)}
            >
              <option value="ARS">ARS — Peso Argentino</option>
              <option value="USD">USD — Dólar Estadounidense</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-language">Idioma</label>
            <select
              id="cfg-language"
              value={displayForm.language}
              onChange={e => handleChange('language', e.target.value)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-dateFormat">Formato de fecha</label>
            <select
              id="cfg-dateFormat"
              value={displayForm.dateFormat}
              onChange={e => handleChange('dateFormat', e.target.value)}
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-invoicePrefix">Prefijo de factura</label>
            <input
              id="cfg-invoicePrefix"
              type="text"
              value={displayForm.invoicePrefix}
              onChange={e => handleChange('invoicePrefix', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-supportEmail">Email de soporte</label>
            <input
              id="cfg-supportEmail"
              type="email"
              value={displayForm.supportEmail}
              onChange={e => handleChange('supportEmail', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-website">Sitio web</label>
            <input
              id="cfg-website"
              type="url"
              value={displayForm.website}
              onChange={e => handleChange('website', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary}>
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Correo Tab ─────────────────────────────────────────────────────────────

function CorreoTab() {
  const { data } = useEmailSettings();
  const { mutate } = useUpdateEmailSettings();
  const { mutate: sendTest, isPending: sendingTest } = useSendTestEmail();

  const [form, setForm] = useState<EmailSettings>({
    smtpHost: data?.smtpHost ?? '',
    smtpPort: data?.smtpPort ?? 587,
    smtpUser: data?.smtpUser ?? '',
    smtpPassword: data?.smtpPassword ?? '',
    fromName: data?.fromName ?? '',
    fromEmail: data?.fromEmail ?? '',
    useTls: data?.useTls ?? true,
  });

  const displayForm = data ?? form;

  function handleChange(field: keyof EmailSettings, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(displayForm);
  }

  function handleTestEmail() {
    sendTest(undefined, {
      onSuccess: (res) => window.alert(res.message),
      onError: () => window.alert('Error al enviar correo de prueba.'),
    });
  }

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-smtpHost">Servidor SMTP</label>
            <input
              id="cfg-smtpHost"
              type="text"
              value={displayForm.smtpHost}
              onChange={e => handleChange('smtpHost', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-smtpPort">Puerto</label>
            <input
              id="cfg-smtpPort"
              type="number"
              value={displayForm.smtpPort}
              onChange={e => handleChange('smtpPort', Number(e.target.value))}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-smtpUser">Usuario</label>
            <input
              id="cfg-smtpUser"
              type="text"
              value={displayForm.smtpUser}
              onChange={e => handleChange('smtpUser', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-smtpPassword">Contraseña</label>
            <input
              id="cfg-smtpPassword"
              type="password"
              value={displayForm.smtpPassword}
              onChange={e => handleChange('smtpPassword', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-fromName">Nombre del remitente</label>
            <input
              id="cfg-fromName"
              type="text"
              value={displayForm.fromName}
              onChange={e => handleChange('fromName', e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cfg-fromEmail">Email del remitente</label>
            <input
              id="cfg-fromEmail"
              type="email"
              value={displayForm.fromEmail}
              onChange={e => handleChange('fromEmail', e.target.value)}
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              id="cfg-useTls"
              type="checkbox"
              checked={displayForm.useTls}
              onChange={e => handleChange('useTls', e.target.checked)}
            />
            <label htmlFor="cfg-useTls">Usar TLS</label>
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.btnPrimary}>
            Guardar configuración de correo
          </button>
          <button type="button" className={styles.btnSecondary} onClick={handleTestEmail} disabled={sendingTest}>
            {sendingTest ? 'Enviando...' : 'Enviar correo de prueba'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Plantillas Tab ─────────────────────────────────────────────────────────

function PreviewModal({
  body,
  variables,
  onClose,
}: {
  body: string;
  variables: TemplateVariable[];
  onClose: () => void;
}) {
  let preview = body;
  variables.forEach(v => {
    preview = preview.replaceAll(`{{${v.key}}}`, v.example);
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '0.75rem', padding: '2rem',
        maxWidth: '560px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} role="dialog" aria-modal="true">
        <h3 style={{ margin: '0 0 1rem', fontWeight: 700 }}>Vista previa</h3>
        <pre style={{
          whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '1rem',
          borderRadius: '0.5rem', fontSize: '0.875rem', color: '#374151',
          border: '1px solid #e5e7eb',
        }}>
          {preview}
        </pre>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function PlantillasTab() {
  const { data: templates = [] } = useTemplates();
  const { mutate } = useUpdateTemplate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const variables: TemplateVariable[] = selectedTemplate?.variables ?? [];

  function handleSelect(tpl: MessageTemplate) {
    setSelectedId(tpl.id);
    setEditSubject(tpl.subject);
    setEditBody(tpl.body);
    setShowPreview(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    mutate({ id: selectedId, data: { subject: editSubject, body: editBody } });
  }

  function insertVariable(key: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setEditBody(prev => prev + `{{${key}}}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insertion = `{{${key}}}`;
    const newBody = editBody.slice(0, start) + insertion + editBody.slice(end);
    setEditBody(newBody);
    // Restore cursor position after insertion
    requestAnimationFrame(() => {
      textarea.selectionStart = start + insertion.length;
      textarea.selectionEnd = start + insertion.length;
      textarea.focus();
    });
  }

  return (
    <div>
      <div className={styles.templateList}>
        {templates.map(tpl => (
          <div
            key={tpl.id}
            className={`${styles.templateRow} ${selectedId === tpl.id ? styles.templateRowActive : ''}`}
            onClick={() => handleSelect(tpl)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleSelect(tpl)}
          >
            <span className={styles.templateName}>{tpl.name}</span>
            <div className={styles.templateMeta}>
              <span className={`${styles.typeBadge} ${typeBadgeClass(tpl.type)}`}>
                {typeLabel(tpl.type)}
              </span>
              <span>{formatDate(tpl.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedId && (
        <div className={styles.templateEditor} style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <p className={styles.templateEditorTitle}>
              Editar: {selectedTemplate?.name}
            </p>
            <form className={styles.form} onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label htmlFor="tpl-subject">Asunto</label>
                <input
                  id="tpl-subject"
                  type="text"
                  value={editSubject}
                  onChange={e => setEditSubject(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="tpl-body">Cuerpo</label>
                <textarea
                  id="tpl-body"
                  ref={textareaRef}
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary}>
                  Guardar plantilla
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowPreview(true)}
                >
                  Vista previa
                </button>
              </div>
            </form>
          </div>

          {variables.length > 0 && (
            <div style={{
              width: '220px', flexShrink: 0, background: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: '0.5rem',
              padding: '1rem', height: 'fit-content',
            }} data-testid="variables-panel">
              <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                Variables disponibles
              </p>
              {variables.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  title={v.description}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '0.375rem 0.5rem', marginBottom: '0.25rem',
                    background: '#fff', border: '1px solid #d1d5db',
                    borderRadius: '0.375rem', cursor: 'pointer',
                    fontSize: '0.75rem', fontFamily: 'monospace',
                    color: '#2563eb',
                  }}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showPreview && selectedTemplate && (
        <PreviewModal
          body={editBody}
          variables={variables}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// ── Tokens API Tab ─────────────────────────────────────────────────────────

const ALL_PERMISSIONS = ['read:clients', 'write:invoices', 'read:tickets', 'write:tickets'];

function TokensTab() {
  const { data: tokens = [] } = useApiTokens();
  const { mutate: createToken } = useCreateApiToken();
  const { mutate: revokeToken } = useRevokeApiToken();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  function togglePerm(perm: string) {
    setSelectedPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm],
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createToken({ name: newName, permissions: selectedPerms });
    setNewName('');
    setSelectedPerms([]);
    setShowForm(false);
  }

  return (
    <div>
      <div className={styles.sectionActions}>
        <span />
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          Nuevo token
        </button>
      </div>

      {showForm && (
        <div className={styles.newTokenSection}>
          <p className={styles.newTokenTitle}>Generar nuevo token</p>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.formGroup}>
              <label htmlFor="tok-name">Nombre</label>
              <input
                id="tok-name"
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Permisos</label>
              <div className={styles.permissionsGrid}>
                {ALL_PERMISSIONS.map(perm => (
                  <label key={perm} className={styles.permCheckbox}>
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm)}
                      onChange={() => togglePerm(perm)}
                    />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary}>
                Generar token
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Token</th>
              <th>Permisos</th>
              <th>Creado</th>
              <th>Último uso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(tok => (
              <tr key={tok.id}>
                <td>{tok.name}</td>
                <td className={styles.tokenCode}>{tok.token}</td>
                <td>
                  <div className={styles.permissionsList}>
                    {tok.permissions.map(p => (
                      <span key={p} className={styles.permBadge}>
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{formatDate(tok.createdAt)}</td>
                <td>{formatDate(tok.lastUsed)}</td>
                <td>
                  <button
                    className={styles.btnDanger}
                    onClick={() => revokeToken(tok.id)}
                  >
                    Revocar
                  </button>
                </td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay tokens API.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Finanzas Tab ───────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<PaymentMethod['type'], string> = {
  bank_transfer: 'Transferencia bancaria',
  mercadopago: 'Mercado Pago',
  cash: 'Efectivo',
  card: 'Tarjeta',
  other: 'Otro',
};

function FinanzasTab() {
  const { data: finance } = useFinanceSettings();
  const { mutate: updateFinance } = useUpdateFinanceSettings();
  const { data: methods = [] } = usePaymentMethods();
  const { mutate: createMethod } = useCreatePaymentMethod();

  const [showMethodForm, setShowMethodForm] = useState(false);
  const [newMethod, setNewMethod] = useState<Omit<PaymentMethod, 'id'>>({
    name: '',
    type: 'cash',
    enabled: true,
    config: {},
  });

  function handleMethodCreate(e: React.FormEvent) {
    e.preventDefault();
    createMethod(newMethod);
    setShowMethodForm(false);
    setNewMethod({ name: '', type: 'cash', enabled: true, config: {} });
  }

  const displayFinance = finance ?? {
    invoiceDueDays: 10,
    taxName: 'IVA',
    taxRate: 21,
    taxIncluded: false,
    autoGenerateInvoices: true,
    invoiceDay: 1,
    lateFeeEnabled: true,
    lateFeeAmount: 500,
    lateFeeDays: 5,
    reminderDays: [3, 7],
    currency: 'ARS',
    currencySymbol: '$',
    paymentMethods: [],
  };

  return (
    <div>
      <div className={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Facturación</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="fin-dueDays">Días vencimiento factura</label>
            <input
              id="fin-dueDays"
              type="number"
              defaultValue={displayFinance.invoiceDueDays}
              onBlur={e => updateFinance({ invoiceDueDays: Number(e.target.value) })}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="fin-invoiceDay">Día del mes para generar</label>
            <input
              id="fin-invoiceDay"
              type="number"
              min={1}
              max={28}
              defaultValue={displayFinance.invoiceDay}
              onBlur={e => updateFinance({ invoiceDay: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              id="fin-autoGenerate"
              type="checkbox"
              defaultChecked={displayFinance.autoGenerateInvoices}
              onChange={e => updateFinance({ autoGenerateInvoices: e.target.checked })}
            />
            <label htmlFor="fin-autoGenerate">Generar automáticamente</label>
          </div>
        </div>

        <h4 style={{ margin: '16px 0 12px', fontSize: 14, fontWeight: 600 }}>Recargo por mora</h4>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <div className={styles.checkboxGroup}>
              <input
                id="fin-lateFeeEnabled"
                type="checkbox"
                defaultChecked={displayFinance.lateFeeEnabled}
                onChange={e => updateFinance({ lateFeeEnabled: e.target.checked })}
              />
              <label htmlFor="fin-lateFeeEnabled">Habilitado</label>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="fin-lateFeeAmount">Monto ($)</label>
            <input
              id="fin-lateFeeAmount"
              type="number"
              defaultValue={displayFinance.lateFeeAmount}
              onBlur={e => updateFinance({ lateFeeAmount: Number(e.target.value) })}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="fin-lateFeeDays">Días tras vencimiento</label>
            <input
              id="fin-lateFeeDays"
              type="number"
              defaultValue={displayFinance.lateFeeDays}
              onBlur={e => updateFinance({ lateFeeDays: Number(e.target.value) })}
            />
          </div>
        </div>

        <h4 style={{ margin: '16px 0 12px', fontSize: 14, fontWeight: 600 }}>Recordatorios</h4>
        <div className={styles.formGroup}>
          {[3, 7, 14].map(days => (
            <div key={days} className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id={`fin-reminder-${days}`}
                defaultChecked={displayFinance.reminderDays.includes(days)}
                onChange={e => {
                  const current = displayFinance.reminderDays;
                  const next = e.target.checked
                    ? [...current, days].sort((a, b) => a - b)
                    : current.filter(d => d !== days);
                  updateFinance({ reminderDays: next });
                }}
              />
              <label htmlFor={`fin-reminder-${days}`}>{days} días antes</label>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Impuestos</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="fin-taxName">Nombre del impuesto</label>
            <input
              id="fin-taxName"
              type="text"
              defaultValue={displayFinance.taxName}
              onBlur={e => updateFinance({ taxName: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="fin-taxRate">Tasa %</label>
            <input
              id="fin-taxRate"
              type="number"
              defaultValue={displayFinance.taxRate}
              onBlur={e => updateFinance({ taxRate: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <div className={styles.checkboxGroup}>
            <input
              id="fin-taxIncluded"
              type="checkbox"
              defaultChecked={displayFinance.taxIncluded}
              onChange={e => updateFinance({ taxIncluded: e.target.checked })}
            />
            <label htmlFor="fin-taxIncluded">Precio incluye impuesto</label>
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 16 }}>
        <div className={styles.sectionActions}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Métodos de pago</h3>
          <button className={styles.btnPrimary} onClick={() => setShowMethodForm(v => !v)}>
            Agregar método de pago
          </button>
        </div>

        {showMethodForm && (
          <form className={styles.form} onSubmit={handleMethodCreate} style={{ marginTop: 16 }}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="pm-name">Nombre</label>
                <input
                  id="pm-name"
                  type="text"
                  value={newMethod.name}
                  onChange={e => setNewMethod(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pm-type">Tipo</label>
                <select
                  id="pm-type"
                  value={newMethod.type}
                  onChange={e => setNewMethod(prev => ({ ...prev, type: e.target.value as PaymentMethod['type'], config: {} }))}
                >
                  <option value="bank_transfer">Transferencia bancaria</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            {newMethod.type === 'bank_transfer' && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="pm-cbu">CBU</label>
                  <input
                    id="pm-cbu"
                    type="text"
                    value={newMethod.config['cbu'] ?? ''}
                    onChange={e => setNewMethod(prev => ({ ...prev, config: { ...prev.config, cbu: e.target.value } }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="pm-alias">Alias</label>
                  <input
                    id="pm-alias"
                    type="text"
                    value={newMethod.config['alias'] ?? ''}
                    onChange={e => setNewMethod(prev => ({ ...prev, config: { ...prev.config, alias: e.target.value } }))}
                  />
                </div>
              </div>
            )}
            {newMethod.type === 'mercadopago' && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="pm-publicKey">Public Key</label>
                  <input
                    id="pm-publicKey"
                    type="text"
                    value={newMethod.config['publicKey'] ?? ''}
                    onChange={e => setNewMethod(prev => ({ ...prev, config: { ...prev.config, publicKey: e.target.value } }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="pm-accessToken">Access Token</label>
                  <input
                    id="pm-accessToken"
                    type="text"
                    value={newMethod.config['accessToken'] ?? ''}
                    onChange={e => setNewMethod(prev => ({ ...prev, config: { ...prev.config, accessToken: e.target.value } }))}
                  />
                </div>
              </div>
            )}
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary}>Guardar</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowMethodForm(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <table className={styles.table} style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {methods.map(m => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td><span className={styles.permBadge}>{PAYMENT_TYPE_LABELS[m.type]}</span></td>
                <td>{m.enabled ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
            {methods.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay métodos de pago configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Webhooks Tab ───────────────────────────────────────────────────────────

const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'client.created', 'client.updated', 'client.deleted',
  'invoice.created', 'invoice.paid', 'payment.received',
  'ticket.created', 'ticket.resolved',
  'device.offline', 'device.recovered',
];

function WebhooksTab() {
  const { data: webhooks = [] } = useWebhooks();
  const { mutate: createWebhook } = useCreateWebhook();
  const { mutate: testWebhook } = useTestWebhook();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);

  function toggleEvent(ev: WebhookEvent) {
    setSelectedEvents(prev =>
      prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev],
    );
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createWebhook({ name: newName, url: newUrl, events: selectedEvents, secret: newSecret, status: 'active' });
    setShowForm(false);
    setNewName('');
    setNewUrl('');
    setNewSecret('');
    setSelectedEvents([]);
  }

  function handleTest(wh: Webhook) {
    testWebhook(wh.id, {
      onSuccess: (result) => {
        setTestResult(result.success ? `Webhook "${wh.name}" probado exitosamente` : `Error al probar "${wh.name}"`);
        setTimeout(() => setTestResult(null), 3000);
      },
    });
  }

  return (
    <div>
      <div className={styles.sectionActions}>
        <span />
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          Nuevo webhook
        </button>
      </div>

      {testResult && (
        <div style={{ padding: '0.75rem 1rem', background: '#d1fae5', borderRadius: '0.5rem', marginBottom: '1rem', color: '#065f46' }}>
          {testResult}
        </div>
      )}

      {showForm && (
        <div className={styles.newTokenSection}>
          <p className={styles.newTokenTitle}>Nuevo webhook</p>
          <form className={styles.form} onSubmit={handleCreate}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="wh-name">Nombre</label>
                <input id="wh-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="wh-url">URL</label>
                <input id="wh-url" type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} required />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="wh-secret">Secret</label>
              <input id="wh-secret" type="text" value={newSecret} onChange={e => setNewSecret(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Eventos</label>
              <div className={styles.permissionsGrid}>
                {ALL_WEBHOOK_EVENTS.map(ev => (
                  <label key={ev} className={styles.permCheckbox}>
                    <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary}>Crear webhook</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL</th>
              <th>Eventos</th>
              <th>Estado</th>
              <th>Último disparo</th>
              <th>Último estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map(wh => (
              <tr key={wh.id}>
                <td>{wh.name}</td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wh.url}</td>
                <td>
                  <span className={styles.permBadge}>{wh.events.length} eventos</span>
                </td>
                <td>
                  <span style={{ color: wh.status === 'active' ? '#059669' : '#6b7280', fontWeight: 600 }}>
                    {wh.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{formatDate(wh.lastTriggered)}</td>
                <td>
                  {wh.lastStatus ? (
                    <span style={{ color: wh.lastStatus === 'success' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                      {wh.lastStatus === 'success' ? 'OK' : 'Error'}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <button className={styles.btnSecondary} onClick={() => handleTest(wh)} style={{ fontSize: '0.75rem' }}>
                    Probar
                  </button>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay webhooks configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Respaldo Tab ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function RespaldoTab() {
  const { data: backups = [] } = useBackups();
  const { mutate: createBackup, isPending } = useCreateBackup();

  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Respaldos automáticos</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <div className={styles.checkboxGroup}>
              <input id="backup-auto-enabled" type="checkbox" defaultChecked />
              <label htmlFor="backup-auto-enabled">Habilitado</label>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="backup-freq">Frecuencia</label>
            <select id="backup-freq" defaultValue="semanal">
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="backup-hour">Hora</label>
            <input id="backup-hour" type="time" defaultValue="03:00" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="backup-retention">Retención (días)</label>
            <input id="backup-retention" type="number" defaultValue={30} min={1} />
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Respaldos manuales</h3>
        <button
          className={styles.btnPrimary}
          onClick={() => createBackup()}
          disabled={isPending}
        >
          {isPending ? 'Creando...' : 'Crear respaldo ahora'}
        </button>
      </div>

      <div className={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Historial de respaldos</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tamaño</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {backups.map(bk => (
              <tr key={bk.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{bk.filename}</td>
                <td>{formatBytes(bk.size)}</td>
                <td>
                  <span className={bk.type === 'manual' ? styles.permBadge : styles.typeBadge}>
                    {bk.type === 'manual' ? 'Manual' : 'Programado'}
                  </span>
                </td>
                <td>
                  <span style={{
                    color: bk.status === 'completed' ? '#059669' : bk.status === 'in_progress' ? '#d97706' : '#dc2626',
                    fontWeight: 600,
                  }}>
                    {bk.status === 'completed' ? 'Completado' : bk.status === 'in_progress' ? 'En progreso' : 'Error'}
                  </span>
                </td>
                <td>{formatDate(bk.createdAt)}</td>
                <td>
                  <a href={bk.downloadUrl} className={styles.btnSecondary} style={{ fontSize: '0.75rem' }}>
                    Descargar
                  </a>
                </td>
              </tr>
            ))}
            {backups.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay respaldos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Portal Cliente Tab ──────────────────────────────────────────────────────

function PortalClienteTab() {
  const { data: portal } = useClientPortalSettings();
  const { mutate: updatePortal } = useUpdateClientPortalSettings();

  const displayPortal: ClientPortalSettings = portal ?? {
    enabled: false,
    portalUrl: '',
    allowSelfRegistration: false,
    requireEmailVerification: true,
    allowPaymentOnline: false,
    allowTicketCreation: false,
    allowServiceManagement: false,
    welcomeMessage: '',
    logoUrl: null,
    primaryColor: '#2563eb',
    customCss: '',
  };

  return (
    <div className={styles.card}>
      <div className={styles.formGroup}>
        <div className={styles.checkboxGroup}>
          <input
            id="portal-enabled"
            type="checkbox"
            checked={displayPortal.enabled}
            onChange={e => updatePortal({ enabled: e.target.checked })}
          />
          <label htmlFor="portal-enabled">Habilitar portal</label>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="portal-url">URL del portal</label>
        <input
          id="portal-url"
          type="url"
          defaultValue={displayPortal.portalUrl}
          onBlur={e => updatePortal({ portalUrl: e.target.value })}
        />
      </div>

      <h4 style={{ margin: '16px 0 12px', fontSize: 14, fontWeight: 600 }}>Funcionalidades</h4>
      {([
        { id: 'portal-self-reg', field: 'allowSelfRegistration' as const, label: 'Permitir auto-registro' },
        { id: 'portal-email-verify', field: 'requireEmailVerification' as const, label: 'Verificación de email' },
        { id: 'portal-payments', field: 'allowPaymentOnline' as const, label: 'Pagos online' },
        { id: 'portal-tickets', field: 'allowTicketCreation' as const, label: 'Crear tickets' },
        { id: 'portal-services', field: 'allowServiceManagement' as const, label: 'Gestionar servicios' },
      ] as const).map(({ id, field, label }) => (
        <div key={id} className={styles.checkboxGroup}>
          <input
            id={id}
            type="checkbox"
            checked={displayPortal[field]}
            onChange={e => updatePortal({ [field]: e.target.checked })}
          />
          <label htmlFor={id}>{label}</label>
        </div>
      ))}

      <h4 style={{ margin: '16px 0 12px', fontSize: 14, fontWeight: 600 }}>Apariencia</h4>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label htmlFor="portal-color">Color primario</label>
          <input
            id="portal-color"
            type="color"
            defaultValue={displayPortal.primaryColor}
            onBlur={e => updatePortal({ primaryColor: e.target.value })}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="portal-logo">Logo</label>
          <input id="portal-logo" type="file" accept="image/*" />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="portal-welcome">Mensaje de bienvenida</label>
        <textarea
          id="portal-welcome"
          defaultValue={displayPortal.welcomeMessage}
          onBlur={e => updatePortal({ welcomeMessage: e.target.value })}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="portal-css">CSS personalizado</label>
        <textarea
          id="portal-css"
          style={{ fontFamily: 'monospace' }}
          defaultValue={displayPortal.customCss}
          onBlur={e => updatePortal({ customCss: e.target.value })}
        />
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => updatePortal(displayPortal)}
        >
          Guardar configuración
        </button>
      </div>
    </div>
  );
}

// ── Notificaciones Tab ──────────────────────────────────────────────────────

function NotificacionesTab() {
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsProvider, setSmsProvider] = useState<'twilio' | 'custom'>('twilio');
  const [smsAccountSid, setSmsAccountSid] = useState('');
  const [smsAuthToken, setSmsAuthToken] = useState('');
  const [smsFrom, setSmsFrom] = useState('');

  const [waEnabled, setWaEnabled] = useState(false);
  const [waApiUrl, setWaApiUrl] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waFrom, setWaFrom] = useState('');

  const [pushEnabled, setPushEnabled] = useState(false);
  const [fcmKey, setFcmKey] = useState('');

  return (
    <div>
      {/* SMS */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>SMS</h3>
          <div className={styles.checkboxGroup}>
            <input
              id="sms-enabled"
              type="checkbox"
              checked={smsEnabled}
              onChange={e => setSmsEnabled(e.target.checked)}
            />
            <label htmlFor="sms-enabled">Habilitado</label>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="sms-provider">Proveedor</label>
            <select
              id="sms-provider"
              value={smsProvider}
              onChange={e => setSmsProvider(e.target.value as 'twilio' | 'custom')}
            >
              <option value="twilio">Twilio</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="sms-from">Número origen</label>
            <input
              id="sms-from"
              type="text"
              value={smsFrom}
              onChange={e => setSmsFrom(e.target.value)}
              placeholder="+549..."
            />
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="sms-sid">Account SID</label>
            <input
              id="sms-sid"
              type="text"
              value={smsAccountSid}
              onChange={e => setSmsAccountSid(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="sms-token">Auth Token</label>
            <input
              id="sms-token"
              type="password"
              value={smsAuthToken}
              onChange={e => setSmsAuthToken(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>WhatsApp</h3>
          <div className={styles.checkboxGroup}>
            <input
              id="wa-enabled"
              type="checkbox"
              checked={waEnabled}
              onChange={e => setWaEnabled(e.target.checked)}
            />
            <label htmlFor="wa-enabled">Habilitado</label>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="wa-api-url">API URL</label>
            <input
              id="wa-api-url"
              type="url"
              value={waApiUrl}
              onChange={e => setWaApiUrl(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="wa-token">Token</label>
            <input
              id="wa-token"
              type="password"
              value={waToken}
              onChange={e => setWaToken(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="wa-from">Número origen</label>
          <input
            id="wa-from"
            type="text"
            value={waFrom}
            onChange={e => setWaFrom(e.target.value)}
            placeholder="+549..."
          />
        </div>
      </div>

      {/* Push Notifications */}
      <div className={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Push Notifications</h3>
          <div className={styles.checkboxGroup}>
            <input
              id="push-enabled"
              type="checkbox"
              checked={pushEnabled}
              onChange={e => setPushEnabled(e.target.checked)}
            />
            <label htmlFor="push-enabled">Habilitado</label>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="fcm-key">FCM Server Key</label>
          <input
            id="fcm-key"
            type="password"
            value={fcmKey}
            onChange={e => setFcmKey(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Políticas de Red Tab ────────────────────────────────────────────────────

interface IpPool {
  id: string;
  name: string;
  range: string;
  gateway: string;
  dns: string;
  type: 'PPPoE' | 'Static' | 'DHCP';
}

function PoliticasRedTab() {
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [maxSessions, setMaxSessions] = useState(1);
  const [reconnectPolicy, setReconnectPolicy] = useState<'allow' | 'block' | 'redirect'>('allow');

  const [ipPools, setIpPools] = useState<IpPool[]>([]);
  const [showPoolForm, setShowPoolForm] = useState(false);
  const [newPool, setNewPool] = useState<Omit<IpPool, 'id'>>({ name: '', range: '', gateway: '', dns: '', type: 'PPPoE' });

  const [burstRate, setBurstRate] = useState('');
  const [cirResidential, setCirResidential] = useState('');
  const [cirBusiness, setCirBusiness] = useState('');

  const [radiusCoaPort, setRadiusCoaPort] = useState(3799);
  const [radiusDiscPort, setRadiusDiscPort] = useState(3799);
  const [radiusTimeout, setRadiusTimeout] = useState(5);

  function addPool(e: React.FormEvent) {
    e.preventDefault();
    setIpPools(prev => [...prev, { ...newPool, id: String(Date.now()) }]);
    setNewPool({ name: '', range: '', gateway: '', dns: '', type: 'PPPoE' });
    setShowPoolForm(false);
  }

  return (
    <div>
      {/* Session management */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Gestión de sesiones</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="session-timeout">Timeout de sesión (minutos)</label>
            <input
              id="session-timeout"
              type="number"
              value={sessionTimeout}
              onChange={e => setSessionTimeout(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="max-sessions">Máximo de sesiones por usuario</label>
            <input
              id="max-sessions"
              type="number"
              value={maxSessions}
              onChange={e => setMaxSessions(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="reconnect-policy">Política de reconexión</label>
            <select
              id="reconnect-policy"
              value={reconnectPolicy}
              onChange={e => setReconnectPolicy(e.target.value as typeof reconnectPolicy)}
            >
              <option value="allow">Permitir</option>
              <option value="block">Bloquear</option>
              <option value="redirect">Redirigir</option>
            </select>
          </div>
        </div>
      </div>

      {/* IP Pools */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.sectionActions}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>IP Pools</h3>
          <button className={styles.btnPrimary} onClick={() => setShowPoolForm(v => !v)}>
            Agregar pool
          </button>
        </div>

        {showPoolForm && (
          <form className={styles.form} onSubmit={addPool} style={{ marginTop: 16 }}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="pool-name">Nombre</label>
                <input
                  id="pool-name"
                  type="text"
                  value={newPool.name}
                  onChange={e => setNewPool(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pool-range">Rango</label>
                <input
                  id="pool-range"
                  type="text"
                  value={newPool.range}
                  onChange={e => setNewPool(p => ({ ...p, range: e.target.value }))}
                  placeholder="192.168.1.0/24"
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="pool-gateway">Gateway</label>
                <input
                  id="pool-gateway"
                  type="text"
                  value={newPool.gateway}
                  onChange={e => setNewPool(p => ({ ...p, gateway: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pool-dns">DNS</label>
                <input
                  id="pool-dns"
                  type="text"
                  value={newPool.dns}
                  onChange={e => setNewPool(p => ({ ...p, dns: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pool-type">Tipo</label>
                <select
                  id="pool-type"
                  value={newPool.type}
                  onChange={e => setNewPool(p => ({ ...p, type: e.target.value as IpPool['type'] }))}
                >
                  <option value="PPPoE">PPPoE</option>
                  <option value="Static">Static</option>
                  <option value="DHCP">DHCP</option>
                </select>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary}>Guardar</button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowPoolForm(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <table className={styles.table} style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rango</th>
              <th>Gateway</th>
              <th>DNS</th>
              <th>Tipo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ipPools.map(pool => (
              <tr key={pool.id}>
                <td>{pool.name}</td>
                <td>{pool.range}</td>
                <td>{pool.gateway}</td>
                <td>{pool.dns}</td>
                <td><span className={styles.permBadge}>{pool.type}</span></td>
                <td>
                  <button
                    className={styles.btnDanger}
                    onClick={() => setIpPools(prev => prev.filter(p => p.id !== pool.id))}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {ipPools.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay pools configurados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rate limiting */}
      <div className={styles.card} style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Rate Limiting</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="burst-rate">Burst rate global</label>
            <input
              id="burst-rate"
              type="text"
              value={burstRate}
              onChange={e => setBurstRate(e.target.value)}
              placeholder="10M"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cir-residential">CIR residencial por defecto</label>
            <input
              id="cir-residential"
              type="text"
              value={cirResidential}
              onChange={e => setCirResidential(e.target.value)}
              placeholder="5M"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="cir-business">CIR empresarial por defecto</label>
            <input
              id="cir-business"
              type="text"
              value={cirBusiness}
              onChange={e => setCirBusiness(e.target.value)}
              placeholder="20M"
            />
          </div>
        </div>
      </div>

      {/* RADIUS */}
      <div className={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>RADIUS</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="radius-coa-port">Puerto CoA</label>
            <input
              id="radius-coa-port"
              type="number"
              value={radiusCoaPort}
              onChange={e => setRadiusCoaPort(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-disc-port">Puerto Disconnect</label>
            <input
              id="radius-disc-port"
              type="number"
              value={radiusDiscPort}
              onChange={e => setRadiusDiscPort(Number(e.target.value))}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="radius-timeout">Timeout (segundos)</label>
            <input
              id="radius-timeout"
              type="number"
              value={radiusTimeout}
              onChange={e => setRadiusTimeout(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add-ons Tab ────────────────────────────────────────────────────────────

interface AddonModule {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  isCore: boolean;
}

const ADDON_MODULES: AddonModule[] = [
  { id: 'billing', name: 'Facturación', description: 'Gestión de facturas y cobros', version: '3.2.1', enabled: true, isCore: true },
  { id: 'tickets', name: 'Tickets', description: 'Sistema de soporte y tickets', version: '2.1.0', enabled: true, isCore: true },
  { id: 'network', name: 'Red', description: 'Gestión de infraestructura de red', version: '4.0.0', enabled: true, isCore: true },
  { id: 'crm', name: 'CRM', description: 'Gestión de clientes y relaciones', version: '1.5.0', enabled: true, isCore: true },
  { id: 'scheduling', name: 'Scheduling', description: 'Agendamiento y tareas programadas', version: '1.3.0', enabled: true, isCore: false },
  { id: 'inventario', name: 'Inventario', description: 'Control de stock y equipos', version: '2.0.0', enabled: true, isCore: false },
  { id: 'voz', name: 'Voz', description: 'Servicios VoIP y telefonía', version: '1.1.0', enabled: true, isCore: false },
  { id: 'portal-cliente', name: 'Portal Cliente', description: 'Portal de autoservicio para clientes', version: '3.0.0', enabled: true, isCore: false },
  { id: 'reportes', name: 'Reportes avanzados', description: 'Reportes y dashboards personalizados', version: '2.2.0', enabled: false, isCore: false },
  { id: 'api-externa', name: 'API externa', description: 'Acceso API REST para integraciones', version: '1.0.0', enabled: false, isCore: false },
  { id: 'snmp', name: 'SNMP Manager', description: 'Monitoreo de dispositivos vía SNMP', version: '1.4.0', enabled: false, isCore: false },
  { id: 'backup', name: 'Backup automático', description: 'Respaldo automático programado', version: '2.1.0', enabled: true, isCore: false },
];

function AddonsTab() {
  const [modules, setModules] = useState<AddonModule[]>(ADDON_MODULES);

  function toggleModule(id: string) {
    setModules(prev => prev.map(m => m.id === id && !m.isCore ? { ...m, enabled: !m.enabled } : m));
  }

  const coreModules = modules.filter(m => m.isCore);
  const optionalModules = modules.filter(m => !m.isCore);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Módulos principales</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {coreModules.map(module => (
            <div key={module.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{module.name}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>{module.description}</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '0.25rem' }}>v{module.version}</p>
                </div>
                <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>
                  Activo
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Módulos opcionales</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {optionalModules.map(module => (
            <div key={module.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{module.name}</p>
                  <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>{module.description}</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.7rem', marginTop: '0.25rem' }}>v{module.version}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span style={{
                    background: module.enabled ? '#d1fae5' : '#f3f4f6',
                    color: module.enabled ? '#065f46' : '#6b7280',
                    fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: '9999px',
                  }}>
                    {module.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={module.enabled}
                      onChange={() => toggleModule(module.id)}
                    />
                    Habilitar
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── System Logs Tab ────────────────────────────────────────────────────────

type LogLevel = 'error' | 'warning' | 'info' | 'debug';
type LogComponent = 'auth' | 'billing' | 'network' | 'scheduler' | 'api' | 'portal';

interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  message: string;
  stackTrace?: string;
}

const MOCK_SYSTEM_LOGS: SystemLogEntry[] = [
  { id: 'l1', timestamp: '2026-04-28T08:30:00Z', level: 'error', component: 'billing', message: 'Failed to generate invoice for client 1042: timeout exceeded connecting to payment gateway', stackTrace: 'Error: Connection timeout\n  at PaymentGateway.connect (payment.js:45)\n  at BillingService.createInvoice (billing.js:120)' },
  { id: 'l2', timestamp: '2026-04-28T08:25:00Z', level: 'warning', component: 'network', message: 'Device 192.168.100.50 did not respond to SNMP poll — marking as unreachable' },
  { id: 'l3', timestamp: '2026-04-28T08:20:00Z', level: 'info', component: 'auth', message: 'Admin Super Admin logged in from 192.168.1.1' },
  { id: 'l4', timestamp: '2026-04-28T08:15:00Z', level: 'debug', component: 'api', message: 'GET /api/v1/clients responded in 42ms with 200 OK' },
  { id: 'l5', timestamp: '2026-04-28T08:10:00Z', level: 'info', component: 'scheduler', message: 'Scheduled task "Backup automático" completed successfully in 3m 42s' },
  { id: 'l6', timestamp: '2026-04-28T08:05:00Z', level: 'error', component: 'portal', message: 'Client portal SSO handshake failed for user client@ejemplo.com' },
  { id: 'l7', timestamp: '2026-04-28T08:00:00Z', level: 'warning', component: 'billing', message: 'Invoice generation delayed — queue backlog 45 items' },
  { id: 'l8', timestamp: '2026-04-28T07:55:00Z', level: 'info', component: 'auth', message: 'Failed login attempt for admin carlos@ipnext.com.ar from IP 10.0.0.5' },
  { id: 'l9', timestamp: '2026-04-28T07:50:00Z', level: 'debug', component: 'network', message: 'RADIUS accounting start received for session aabbcc112233' },
  { id: 'l10', timestamp: '2026-04-28T07:45:00Z', level: 'info', component: 'api', message: 'API token "Integración ERP" used — endpoint /api/v1/invoices' },
  { id: 'l11', timestamp: '2026-04-28T07:40:00Z', level: 'error', component: 'scheduler', message: 'Task "Sync de dispositivos" failed — SNMP timeout on 15 devices' },
  { id: 'l12', timestamp: '2026-04-28T07:35:00Z', level: 'warning', component: 'auth', message: 'Admin session for Carlos López approaching idle timeout (25 min remaining)' },
  { id: 'l13', timestamp: '2026-04-28T07:30:00Z', level: 'info', component: 'billing', message: 'Payment recorded for client 1001 — $5.200 ARS via MercadoPago' },
  { id: 'l14', timestamp: '2026-04-28T07:25:00Z', level: 'debug', component: 'portal', message: 'Client portal page rendered for client 1001 in 89ms' },
  { id: 'l15', timestamp: '2026-04-28T07:20:00Z', level: 'info', component: 'network', message: 'IP pool "192.168.100.0/24" utilization reached 80%' },
  { id: 'l16', timestamp: '2026-04-28T07:15:00Z', level: 'error', component: 'api', message: 'Rate limit exceeded for token "Integración ERP" — 1000 req/min threshold' },
  { id: 'l17', timestamp: '2026-04-28T07:10:00Z', level: 'warning', component: 'scheduler', message: 'Scheduled task "Renovar certificados SSL" — certificate expires in 15 days' },
  { id: 'l18', timestamp: '2026-04-28T07:05:00Z', level: 'info', component: 'auth', message: 'New admin account created: viewer@ipnext.com.ar' },
  { id: 'l19', timestamp: '2026-04-28T07:00:00Z', level: 'debug', component: 'billing', message: 'Auto-invoice cron started — processing 120 clients' },
  { id: 'l20', timestamp: '2026-04-28T06:55:00Z', level: 'info', component: 'portal', message: 'Client portal enabled globally by Super Admin' },
  { id: 'l21', timestamp: '2026-04-28T06:50:00Z', level: 'error', component: 'network', message: 'BGP session with peer 203.0.113.1 dropped — attempting reconnect' },
  { id: 'l22', timestamp: '2026-04-28T06:45:00Z', level: 'warning', component: 'api', message: 'Deprecated endpoint /api/v0/clients called — will be removed in v2.0' },
  { id: 'l23', timestamp: '2026-04-28T06:40:00Z', level: 'info', component: 'scheduler', message: 'Weekly report generated — emailed to admin@ipnext.com.ar' },
  { id: 'l24', timestamp: '2026-04-28T06:35:00Z', level: 'debug', component: 'auth', message: '2FA verification successful for Super Admin' },
  { id: 'l25', timestamp: '2026-04-28T06:30:00Z', level: 'info', component: 'billing', message: 'Late fee applied to 8 overdue invoices' },
  { id: 'l26', timestamp: '2026-04-28T06:25:00Z', level: 'error', component: 'portal', message: 'SSL certificate renewal failed — ACME challenge verification error' },
  { id: 'l27', timestamp: '2026-04-28T06:20:00Z', level: 'warning', component: 'network', message: 'DHCP pool "10.0.0.0/24" has only 12 addresses remaining' },
  { id: 'l28', timestamp: '2026-04-28T06:15:00Z', level: 'info', component: 'api', message: 'Webhook delivery to https://erp.ipnext.com.ar succeeded — 200 OK' },
  { id: 'l29', timestamp: '2026-04-28T06:10:00Z', level: 'debug', component: 'scheduler', message: 'Expired sessions cleanup removed 42 stale records' },
  { id: 'l30', timestamp: '2026-04-28T06:05:00Z', level: 'info', component: 'auth', message: 'System restarted after configuration update' },
];

const LOG_LEVEL_COLORS: Record<LogLevel, { bg: string; color: string }> = {
  error: { bg: '#fee2e2', color: '#991b1b' },
  warning: { bg: '#fef3c7', color: '#92400e' },
  info: { bg: '#dbeafe', color: '#1e40af' },
  debug: { bg: '#f3f4f6', color: '#374151' },
};

function SystemLogsTab() {
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [componentFilter, setComponentFilter] = useState<LogComponent | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = MOCK_SYSTEM_LOGS.filter(entry => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
    if (componentFilter !== 'all' && entry.component !== componentFilter) return false;
    if (dateFrom && entry.timestamp < dateFrom) return false;
    if (dateTo && entry.timestamp > dateTo + 'T23:59:59Z') return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter bar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="log-level-filter" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Nivel</label>
          <select
            id="log-level-filter"
            value={levelFilter}
            onChange={e => { setLevelFilter(e.target.value as LogLevel | 'all'); setPage(1); }}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          >
            <option value="all">Todos</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="log-component-filter" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Componente</label>
          <select
            id="log-component-filter"
            value={componentFilter}
            onChange={e => { setComponentFilter(e.target.value as LogComponent | 'all'); setPage(1); }}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          >
            <option value="all">Todos</option>
            <option value="auth">auth</option>
            <option value="billing">billing</option>
            <option value="network">network</option>
            <option value="scheduler">scheduler</option>
            <option value="api">api</option>
            <option value="portal">portal</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="log-date-from" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Desde</label>
          <input id="log-date-from" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="log-date-to" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Hasta</label>
          <input id="log-date-to" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }} />
        </div>
      </div>

      {/* Log table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Timestamp</th>
              <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Nivel</th>
              <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Componente</th>
              <th style={{ textAlign: 'left', padding: '0.625rem 0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Mensaje</th>
              <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(entry => {
              const levelStyle = LOG_LEVEL_COLORS[entry.level];
              return (
                <>
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      {new Date(entry.timestamp).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.4rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700, background: levelStyle.bg, color: levelStyle.color, textTransform: 'uppercase' }}>
                        {entry.level}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280', fontSize: '0.75rem' }}>{entry.component}</td>
                    <td style={{ padding: '0.5rem 0.75rem', maxWidth: '400px' }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.message.slice(0, 80)}{entry.message.length > 80 ? '…' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {entry.stackTrace && (
                        <button
                          onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                          style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          {expandedId === entry.id ? 'Ocultar' : 'Detalles'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === entry.id && entry.stackTrace && (
                    <tr key={`${entry.id}-detail`}>
                      <td colSpan={5} style={{ padding: '0.75rem', background: '#1f2937', color: '#d1fae5', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                        {entry.message}{'\n\n'}{entry.stackTrace}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scheduled Tasks Tab ────────────────────────────────────────────────────

type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'hourly' | 'custom';
type TaskStatus = 'active' | 'inactive' | 'error';

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  frequency: TaskFrequency;
  frequencyLabel: string;
  nextRun: string;
  lastRun: string | null;
  status: TaskStatus;
}

const MOCK_SCHEDULED_TASKS: ScheduledTask[] = [
  { id: 'st1', name: 'Generar facturas', description: 'Genera facturas automáticas para todos los clientes activos', frequency: 'monthly', frequencyLabel: 'Mensual (día 1)', nextRun: '2026-05-01T00:00:00Z', lastRun: '2026-04-01T00:00:00Z', status: 'active' },
  { id: 'st2', name: 'Enviar recordatorios de pago', description: 'Envía recordatorios de vencimiento de facturas por email', frequency: 'daily', frequencyLabel: 'Diaria (8:00)', nextRun: '2026-04-29T08:00:00Z', lastRun: '2026-04-28T08:00:00Z', status: 'active' },
  { id: 'st3', name: 'Backup automático', description: 'Realiza respaldo completo de la base de datos', frequency: 'daily', frequencyLabel: 'Diaria (2:00)', nextRun: '2026-04-29T02:00:00Z', lastRun: '2026-04-28T02:00:00Z', status: 'active' },
  { id: 'st4', name: 'Sync de dispositivos', description: 'Sincroniza estado de dispositivos de red via SNMP', frequency: 'custom', frequencyLabel: 'Cada 15 min', nextRun: '2026-04-28T08:45:00Z', lastRun: '2026-04-28T08:30:00Z', status: 'error' },
  { id: 'st5', name: 'Purgar logs antiguos', description: 'Elimina registros de logs con más de 90 días de antigüedad', frequency: 'weekly', frequencyLabel: 'Semanal (domingo)', nextRun: '2026-05-03T03:00:00Z', lastRun: '2026-04-27T03:00:00Z', status: 'active' },
  { id: 'st6', name: 'Renovar certificados SSL', description: 'Verifica y renueva certificados SSL próximos a vencer', frequency: 'monthly', frequencyLabel: 'Mensual', nextRun: '2026-05-01T04:00:00Z', lastRun: '2026-04-01T04:00:00Z', status: 'active' },
  { id: 'st7', name: 'Reporte semanal', description: 'Genera y envía reporte semanal de actividad al administrador', frequency: 'weekly', frequencyLabel: 'Semanal (lunes)', nextRun: '2026-05-04T07:00:00Z', lastRun: '2026-04-28T07:00:00Z', status: 'active' },
  { id: 'st8', name: 'Cleanup sesiones expiradas', description: 'Elimina registros de sesiones expiradas de la base de datos', frequency: 'hourly', frequencyLabel: 'Cada hora', nextRun: '2026-04-28T09:00:00Z', lastRun: '2026-04-28T08:00:00Z', status: 'active' },
];

const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; color: string }> = {
  active: { bg: '#d1fae5', color: '#065f46' },
  inactive: { bg: '#f3f4f6', color: '#6b7280' },
  error: { bg: '#fee2e2', color: '#991b1b' },
};

function ScheduledTasksTab() {
  const [tasks, setTasks] = useState<ScheduledTask[]>(MOCK_SCHEDULED_TASKS);

  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' as TaskStatus }
      : t
    ));
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Nombre</th>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Descripción</th>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Frecuencia</th>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Próxima ejecución</th>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Última ejecución</th>
            <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Estado</th>
            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => {
            const statusStyle = TASK_STATUS_COLORS[task.status];
            return (
              <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{task.name}</td>
                <td style={{ padding: '0.75rem', color: '#6b7280', maxWidth: '220px' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.description}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{task.frequencyLabel}</td>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {new Date(task.nextRun).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {task.lastRun ? new Date(task.lastRun).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, background: statusStyle.bg, color: statusStyle.color }}>
                    {task.status === 'active' ? 'Activo' : task.status === 'inactive' ? 'Inactivo' : 'Error'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => toggleTask(task.id)}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', background: '#fff' }}
                    >
                      {task.status === 'active' ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => {}}
                      style={{ padding: '0.25rem 0.5rem', border: '1px solid #2563eb', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb' }}
                    >
                      Ejecutar ahora
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Integraciones Tab ──────────────────────────────────────────────────────

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  connected: boolean;
}

function IntegrationStatusBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.7rem',
      fontWeight: 700,
      background: connected ? '#d1fae5' : '#f3f4f6',
      color: connected ? '#065f46' : '#6b7280',
    }}>
      {connected ? 'Conectado' : 'Desconectado'}
    </span>
  );
}

function IntegrationSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem' }}>
      <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );
}

function IntegrationCardUI({ name, connected, children }: { name: string; connected: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</p>
        <IntegrationStatusBadge connected={connected} />
      </div>
      {children}
      <button
        style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', border: '1px solid #2563eb', borderRadius: '0.375rem', color: '#2563eb', background: '#eff6ff', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
      >
        Configurar
      </button>
    </div>
  );
}

function IntegracionesTab() {
  const [quickbooksConnected] = useState(false);
  const [afipKey, setAfipKey] = useState('');
  const [xeroConnected] = useState(false);
  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeTestMode, setStripeTestMode] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [sendgridKey, setSendgridKey] = useState('');
  const [sendgridFromEmail, setSendgridFromEmail] = useState('');
  const [mailchimpKey, setMailchimpKey] = useState('');
  const [mailchimpListId, setMailchimpListId] = useState('');
  const [zabbixUrl, setZabbixUrl] = useState('');
  const [zabbixToken, setZabbixToken] = useState('');
  const [prometheusUrl, setPrometheusUrl] = useState('');
  const [grafanaUrl, setGrafanaUrl] = useState('');
  const [grafanaKey, setGrafanaKey] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <IntegrationSection title="Contabilidad">
        <IntegrationCardUI name="QuickBooks" connected={quickbooksConnected}>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sincronización de facturas y pagos con QuickBooks Online</p>
        </IntegrationCardUI>
        <IntegrationCardUI name="AFIP" connected={!!afipKey}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="afip-api-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>API Key AFIP</label>
            <input
              id="afip-api-key"
              type="text"
              value={afipKey}
              onChange={e => setAfipKey(e.target.value)}
              placeholder="Clave de acceso AFIP"
              style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }}
            />
          </div>
        </IntegrationCardUI>
        <IntegrationCardUI name="Xero" connected={xeroConnected}>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>Conectar con Xero via OAuth 2.0</p>
        </IntegrationCardUI>
      </IntegrationSection>

      <IntegrationSection title="Pagos">
        <IntegrationCardUI name="Stripe" connected={!!stripePublicKey && !!stripeSecretKey}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="stripe-public-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Clave pública</label>
              <input id="stripe-public-key" type="text" value={stripePublicKey} onChange={e => setStripePublicKey(e.target.value)} placeholder="pk_..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <div>
              <label htmlFor="stripe-secret-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Clave secreta</label>
              <input id="stripe-secret-key" type="password" value={stripeSecretKey} onChange={e => setStripeSecretKey(e.target.value)} placeholder="sk_..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={stripeTestMode} onChange={e => setStripeTestMode(e.target.checked)} />
              Modo de prueba
            </label>
          </div>
        </IntegrationCardUI>
        <IntegrationCardUI name="PayPal" connected={!!paypalClientId}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="paypal-client-id" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Client ID</label>
            <input id="paypal-client-id" type="text" value={paypalClientId} onChange={e => setPaypalClientId(e.target.value)} placeholder="AXxx..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
          </div>
        </IntegrationCardUI>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>MercadoPago</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            MercadoPago se configura en la sección <a href="#" style={{ color: '#2563eb' }}>Finanzas → Métodos de pago</a>.
          </p>
        </div>
      </IntegrationSection>

      <IntegrationSection title="Mensajería">
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Twilio</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            Twilio se configura en la sección <a href="#" style={{ color: '#2563eb' }}>Notificaciones → SMS</a>.
          </p>
        </div>
        <IntegrationCardUI name="SendGrid" connected={!!sendgridKey}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="sendgrid-api-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>API Key</label>
              <input id="sendgrid-api-key" type="password" value={sendgridKey} onChange={e => setSendgridKey(e.target.value)} placeholder="SG...." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <div>
              <label htmlFor="sendgrid-from-email" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Email remitente</label>
              <input id="sendgrid-from-email" type="email" value={sendgridFromEmail} onChange={e => setSendgridFromEmail(e.target.value)} placeholder="noreply@empresa.com" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
          </div>
        </IntegrationCardUI>
        <IntegrationCardUI name="Mailchimp" connected={!!mailchimpKey}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="mailchimp-api-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>API Key</label>
              <input id="mailchimp-api-key" type="password" value={mailchimpKey} onChange={e => setMailchimpKey(e.target.value)} placeholder="xxxxxxxx-us1" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <div>
              <label htmlFor="mailchimp-list-id" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>List ID</label>
              <input id="mailchimp-list-id" type="text" value={mailchimpListId} onChange={e => setMailchimpListId(e.target.value)} placeholder="abc123..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
          </div>
        </IntegrationCardUI>
      </IntegrationSection>

      <IntegrationSection title="Monitoreo">
        <IntegrationCardUI name="Zabbix" connected={!!zabbixUrl && !!zabbixToken}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="zabbix-url" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>URL</label>
              <input id="zabbix-url" type="url" value={zabbixUrl} onChange={e => setZabbixUrl(e.target.value)} placeholder="https://zabbix.empresa.com" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <div>
              <label htmlFor="zabbix-token" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>API Token</label>
              <input id="zabbix-token" type="password" value={zabbixToken} onChange={e => setZabbixToken(e.target.value)} placeholder="token..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
          </div>
        </IntegrationCardUI>
        <IntegrationCardUI name="Prometheus" connected={!!prometheusUrl}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label htmlFor="prometheus-url" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Scrape URL</label>
            <input id="prometheus-url" type="url" value={prometheusUrl} onChange={e => setPrometheusUrl(e.target.value)} placeholder="http://prometheus:9090" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
          </div>
        </IntegrationCardUI>
        <IntegrationCardUI name="Grafana" connected={!!grafanaUrl && !!grafanaKey}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label htmlFor="grafana-url" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>URL</label>
              <input id="grafana-url" type="url" value={grafanaUrl} onChange={e => setGrafanaUrl(e.target.value)} placeholder="https://grafana.empresa.com" style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
            <div>
              <label htmlFor="grafana-api-key" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>API Key</label>
              <input id="grafana-api-key" type="password" value={grafanaKey} onChange={e => setGrafanaKey(e.target.value)} placeholder="glsa_..." style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.75rem' }} />
            </div>
          </div>
        </IntegrationCardUI>
      </IntegrationSection>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sistema');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'sistema' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sistema')}
        >
          Sistema
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'correo' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('correo')}
        >
          Correo
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'plantillas' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('plantillas')}
        >
          Plantillas
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'tokens' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          Tokens API
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'finanzas' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('finanzas')}
        >
          Finanzas
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'webhooks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'respaldo' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('respaldo')}
        >
          Respaldo
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'portal-cliente' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('portal-cliente')}
        >
          Portal Cliente
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'notificaciones' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('notificaciones')}
        >
          Notificaciones
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'politicas-red' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('politicas-red')}
        >
          Políticas de Red
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'addons' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          Add-ons
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'system-logs' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('system-logs')}
        >
          Logs del sistema
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'scheduled-tasks' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('scheduled-tasks')}
        >
          Tareas programadas
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'integraciones' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('integraciones')}
        >
          Integraciones
        </button>
      </div>

      {activeTab === 'sistema' && <SistemaTab />}
      {activeTab === 'correo' && <CorreoTab />}
      {activeTab === 'plantillas' && <PlantillasTab />}
      {activeTab === 'tokens' && <TokensTab />}
      {activeTab === 'finanzas' && <FinanzasTab />}
      {activeTab === 'webhooks' && <WebhooksTab />}
      {activeTab === 'respaldo' && <RespaldoTab />}
      {activeTab === 'portal-cliente' && <PortalClienteTab />}
      {activeTab === 'notificaciones' && <NotificacionesTab />}
      {activeTab === 'politicas-red' && <PoliticasRedTab />}
      {activeTab === 'addons' && <AddonsTab />}
      {activeTab === 'system-logs' && <SystemLogsTab />}
      {activeTab === 'scheduled-tasks' && <ScheduledTasksTab />}
      {activeTab === 'integraciones' && <IntegracionesTab />}
    </div>
  );
}
