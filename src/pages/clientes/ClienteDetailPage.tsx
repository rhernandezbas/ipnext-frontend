import { useEffect, useRef, useState } from 'react';
import { useParams, Navigate, useNavigate, Link } from 'react-router-dom';
import { Tabs } from '../../components/molecules/Tabs/Tabs';
import { ConfirmModal } from '../../components/molecules/ConfirmModal/ConfirmModal';
import { Button } from '../../components/atoms/Button/Button';
import { useClientDetail, useToggleClientStatus, useDeleteCustomer } from '../../hooks/useClients';
import { InformacionTab } from './tabs/InformacionTab';
import { ServiciosTab } from './tabs/ServiciosTab';
import { FacturacionTab } from './tabs/FacturacionTab';
import { EstadisticasTab } from './tabs/EstadisticasTab';
import { DocumentosTab } from './tabs/DocumentosTab';
import { ArchivosTab } from './tabs/ArchivosTab';
import { LogsTab } from './tabs/LogsTab';
import { ActividadTab } from './tabs/ActividadTab';
import { ComentariosTab } from './tabs/ComentariosTab';
import styles from './ClienteDetailPage.module.css';

const TAB_IDS = ['information', 'services', 'billing', 'statistics', 'documents', 'files', 'logs', 'actividad', 'comentarios'];

function formatBalance(b: number | undefined | null) {
  if (b === undefined || b === null) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(b);
}

export default function ClienteDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'information';
  });

  const [accionesOpen, setAccionesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const accionesRef = useRef<HTMLDivElement>(null);

  const activatedTabs = useRef<Set<string>>(new Set([activeTab]));

  useEffect(() => {
    activatedTabs.current.add(activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (TAB_IDS.includes(hash)) setActiveTab(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!accionesOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (accionesRef.current && !accionesRef.current.contains(e.target as Node)) {
        setAccionesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accionesOpen]);

  const { data: customer, isLoading } = useClientDetail(id);
  const toggleStatus = useToggleClientStatus();
  const deleteCustomer = useDeleteCustomer();

  if (!id) {
    return <Navigate to="/admin/customers/list" replace />;
  }

  if (isLoading) return <div className={styles.loading}>Cargando...</div>;
  if (!customer) return <div className={styles.error}>Cliente no encontrado.</div>;

  const isBlocked = customer.status === 'blocked';

  const tabs = [
    {
      id: 'information',
      label: 'Información',
      content: (
        <InformacionTab
          customer={customer}
          active={activatedTabs.current.has('information')}
        />
      ),
    },
    {
      id: 'services',
      label: 'Servicios',
      content: <ServiciosTab clientId={String(id)} active={activatedTabs.current.has('services')} />,
    },
    {
      id: 'billing',
      label: 'Facturación',
      content: <FacturacionTab clientId={String(id)} active={activatedTabs.current.has('billing')} />,
    },
    {
      id: 'statistics',
      label: 'Estadísticas',
      content: <EstadisticasTab clientId={String(id)} active={activatedTabs.current.has('statistics')} />,
    },
    {
      id: 'documents',
      label: 'Documentos',
      content: <DocumentosTab clientId={String(id)} active={activatedTabs.current.has('documents')} />,
    },
    {
      id: 'files',
      label: 'Archivos',
      content: <ArchivosTab clientId={String(id)} active={activatedTabs.current.has('files')} />,
    },
    {
      id: 'logs',
      label: 'Logs',
      content: <LogsTab clientId={String(id)} active={activatedTabs.current.has('logs')} />,
    },
    {
      id: 'actividad',
      label: 'Actividad',
      content: <ActividadTab clientId={String(id)} />,
    },
    {
      id: 'comentarios',
      label: 'Comentarios',
      content: <ComentariosTab clientId={String(id)} />,
    },
  ];

  const splynxId = (customer as { splynxId?: string | null }).splynxId ?? null;
  const balance = (customer as { balance?: number }).balance;

  return (
    <div className={styles.page}>
      {/* Splynx-style top heading: icon + breadcrumb + "NAME (email - splynxId)" */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderIcon} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
          </svg>
        </div>
        <div className={styles.pageHeaderText}>
          <div className={styles.breadcrumb}>
            <Link to="/admin/customers/list">Customers</Link> / <Link to="/admin/customers/list">List</Link> /
          </div>
          <h1 className={styles.pageTitle}>
            {customer.name}{' '}
            <span className={styles.pageTitleMeta}>
              ({customer.email}{splynxId ? ` - ${splynxId}` : ''})
            </span>
          </h1>
        </div>
      </div>

      {/* Sub-header with Saldo + action buttons (Splynx layout) — between
          the page heading and the tabs, NOT after. */}
      <div className={styles.subHeader}>
        <div className={styles.subHeaderLeft}>
          <span className={styles.subHeaderName}>
            {customer.name} <span className={styles.subHeaderEmail}>({customer.email})</span>
          </span>
          <span className={styles.subHeaderBalance}>
            Saldo de la cuenta:
            <span className={styles.subHeaderBalanceValue}>{formatBalance(balance)}</span>
          </span>
        </div>
        <div className={styles.headerActions}>
          <div ref={accionesRef} style={{ position: 'relative' }}>
            <Button variant="secondary" size="sm" onClick={() => setAccionesOpen(o => !o)}>
              Acciones ▾
            </Button>
            {accionesOpen && (
              <div className={styles.dropdown}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    toggleStatus.mutate({ id, status: isBlocked ? 'active' : 'blocked' });
                    setAccionesOpen(false);
                  }}
                >
                  {isBlocked ? 'Desbloquear cliente' : 'Bloquear cliente'}
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { navigate('/admin/support/inbox'); setAccionesOpen(false); }}
                >
                  Enviar mensaje
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { navigate('/admin/tickets/new'); setAccionesOpen(false); }}
                >
                  Crear ticket
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                    setAccionesOpen(false);
                  }}
                >
                  Eliminar cliente
                </button>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/scheduling/tasks')}>Tareas ▾</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/tickets/opened')}>Tickets ▾</Button>
          <Button variant="primary" size="sm" onClick={() => navigate(`/admin/customers/view/${id}/edit`)}>Guardar</Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar cliente"
        message={
          deleteError
            ? deleteError
            : `¿Eliminar a "${customer.name}"? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        busy={deleteCustomer.isPending}
        onCancel={() => { setDeleteOpen(false); setDeleteError(null); }}
        onConfirm={() => {
          setDeleteError(null);
          deleteCustomer.mutate(id, {
            onSuccess: () => {
              setDeleteOpen(false);
              navigate('/admin/customers/list');
            },
            onError: (err: unknown) => {
              const e = err as { response?: { data?: { error?: string; code?: string } } };
              const code = e?.response?.data?.code;
              const msg = e?.response?.data?.error;
              if (code === 'CLIENT_HAS_REFERENCES') {
                setDeleteError(
                  'No se puede eliminar: el cliente tiene tareas, servicios o facturas asociadas. Desvinculalas primero.',
                );
              } else {
                setDeleteError(msg ?? 'No se pudo eliminar el cliente. Intentalo de nuevo.');
              }
            },
          });
        }}
      />
    </div>
  );
}
