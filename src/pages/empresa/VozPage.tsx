import { useState } from 'react';
import { useVoipCategories, useCreateVoipCategory, useVoipCdrs, useVoipPlans, useCreateVoipPlan } from '@/hooks/useVoz';
import type { VoipCategory, VoipCdr, VoipPlan } from '@/types/voz';
import styles from './VozPage.module.css';

type Tab = 'categorias' | 'planes' | 'cdr';

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function cdrStatusClass(status: VoipCdr['status']): string {
  const map: Record<VoipCdr['status'], string> = {
    answered: styles.badgeAnswered,
    missed: styles.badgeMissed,
    busy: styles.badgeBusy,
    failed: styles.badgeFailed,
  };
  return `${styles.badge} ${map[status]}`;
}

function cdrStatusLabel(status: VoipCdr['status']): string {
  const map: Record<VoipCdr['status'], string> = {
    answered: 'Respondida',
    missed: 'Perdida',
    busy: 'Ocupado',
    failed: 'Fallida',
  };
  return map[status];
}

// ── Categorías Tab ────────────────────────────────────────────────────────

function CategoriasTab() {
  const { data: categories = [] } = useVoipCategories();
  const { mutate: createCategory } = useCreateVoipCategory();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<VoipCategory, 'id'>>({
    name: '',
    prefix: '',
    pricePerMinute: 0,
    freeMinutes: 0,
    status: 'active',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createCategory(form);
    setShowForm(false);
    setForm({ name: '', prefix: '', pricePerMinute: 0, freeMinutes: 0, status: 'active' });
  }

  return (
    <div>
      <div className={styles.sectionActions}>
        <span />
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          Nueva categoría
        </button>
      </div>

      {showForm && (
        <div className={styles.card} style={{ padding: 20, marginBottom: 16 }}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="cat-name">Nombre</label>
                <input
                  id="cat-name"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cat-prefix">Prefijo</label>
                <input
                  id="cat-prefix"
                  type="text"
                  value={form.prefix}
                  onChange={e => setForm(p => ({ ...p, prefix: e.target.value }))}
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="cat-price">Precio por minuto ($)</label>
                <input
                  id="cat-price"
                  type="number"
                  step="0.01"
                  value={form.pricePerMinute}
                  onChange={e => setForm(p => ({ ...p, pricePerMinute: Number(e.target.value) }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="cat-freeMinutes">Minutos gratuitos</label>
                <input
                  id="cat-freeMinutes"
                  type="number"
                  value={form.freeMinutes}
                  onChange={e => setForm(p => ({ ...p, freeMinutes: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="cat-status">Estado</label>
              <select
                id="cat-status"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as VoipCategory['status'] }))}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Prefijo</th>
              <th>Precio/min ($)</th>
              <th>Min. gratuitos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id}>
                <td>{cat.name}</td>
                <td>{cat.prefix}</td>
                <td>${cat.pricePerMinute.toFixed(2)}</td>
                <td>{cat.freeMinutes}</td>
                <td>
                  <span className={`${styles.badge} ${cat.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}>
                    {cat.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay categorías VoIP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Planes Tab ────────────────────────────────────────────────────────────

function PlanesTab() {
  const { data: plans = [] } = useVoipPlans();
  const { data: categories = [] } = useVoipCategories();
  const { mutate: createPlan } = useCreateVoipPlan();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<VoipPlan, 'id'>>({
    name: '',
    monthlyPrice: 0,
    includedMinutes: 0,
    categories: [],
    status: 'active',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createPlan(form);
    setShowForm(false);
    setForm({ name: '', monthlyPrice: 0, includedMinutes: 0, categories: [], status: 'active' });
  }

  function getCategoryName(id: string): string {
    return categories.find(c => c.id === id)?.name ?? id;
  }

  return (
    <div>
      <div className={styles.sectionActions}>
        <span />
        <button className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
          Nuevo plan
        </button>
      </div>

      {showForm && (
        <div className={styles.card} style={{ padding: 20, marginBottom: 16 }}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="plan-name">Nombre</label>
                <input
                  id="plan-name"
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="plan-price">Precio mensual ($)</label>
                <input
                  id="plan-price"
                  type="number"
                  value={form.monthlyPrice}
                  onChange={e => setForm(p => ({ ...p, monthlyPrice: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="plan-minutes">Minutos incluidos</label>
              <input
                id="plan-minutes"
                type="number"
                value={form.includedMinutes}
                onChange={e => setForm(p => ({ ...p, includedMinutes: Number(e.target.value) }))}
              />
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className={styles.btnPrimary}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio mensual</th>
              <th>Minutos incluidos</th>
              <th>Categorías</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(plan => (
              <tr key={plan.id}>
                <td>{plan.name}</td>
                <td>${plan.monthlyPrice.toLocaleString()}</td>
                <td>{plan.includedMinutes}</td>
                <td>
                  {plan.categories.map(cid => (
                    <span key={cid} className={styles.chip}>{getCategoryName(cid)}</span>
                  ))}
                </td>
                <td>
                  <span className={`${styles.badge} ${plan.status === 'active' ? styles.badgeActive : styles.badgeInactive}`}>
                    {plan.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay planes VoIP.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CDR Tab ───────────────────────────────────────────────────────────────

function CdrTab() {
  const { data: cdrs = [] } = useVoipCdrs();
  const [filterClient, setFilterClient] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const filtered = cdrs.filter(c => {
    if (filterClient && !c.clientName.toLowerCase().includes(filterClient.toLowerCase())) return false;
    if (filterFrom && c.startedAt < filterFrom) return false;
    if (filterTo && c.startedAt > filterTo + 'T23:59:59Z') return false;
    return true;
  });

  return (
    <div>
      <div className={styles.filterBar}>
        <input
          type="text"
          placeholder="Cliente..."
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          aria-label="Filtrar por cliente"
        />
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          aria-label="Desde"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          aria-label="Hasta"
        />
      </div>
      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Cliente</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Duración</th>
              <th>Categoría</th>
              <th>Costo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(cdr => (
              <tr key={cdr.id}>
                <td>{new Date(cdr.startedAt).toLocaleString('es-AR')}</td>
                <td>{cdr.clientName}</td>
                <td>{cdr.callerNumber}</td>
                <td>{cdr.calledNumber}</td>
                <td>{formatDuration(cdr.duration)}</td>
                <td>{cdr.categoryName}</td>
                <td>${cdr.cost.toFixed(2)}</td>
                <td>
                  <span className={cdrStatusClass(cdr.status)}>
                    {cdrStatusLabel(cdr.status)}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                  No hay registros de llamadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function VozPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categorias');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Voz / VoIP</h1>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'categorias' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('categorias')}
        >
          Categorías
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'planes' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('planes')}
        >
          Planes VoIP
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'cdr' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('cdr')}
        >
          CDR (Llamadas)
        </button>
      </div>

      {activeTab === 'categorias' && <CategoriasTab />}
      {activeTab === 'planes' && <PlanesTab />}
      {activeTab === 'cdr' && <CdrTab />}
    </div>
  );
}
