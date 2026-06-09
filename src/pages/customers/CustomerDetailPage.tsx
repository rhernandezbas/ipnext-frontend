import { useEffect, useRef, useState } from 'react';
import { useParams, Navigate, useNavigate, Link } from 'react-router-dom';
import { Tabs } from '../../components/molecules/Tabs/Tabs';
import { ConfirmModal } from '../../components/molecules/ConfirmModal/ConfirmModal';
import { Button } from '../../components/atoms/Button/Button';
import { Can } from '../../components/auth/Can';
import { useCan } from '../../hooks/useMyPermissions';
import { useClientDetail, useToggleClientStatus, useDeleteCustomer } from '../../hooks/useCustomers';
import { useTasksByCustomer } from '../../hooks/useScheduling';
import { useTicketsByCustomer } from '../../hooks/useTickets';
import { InfoTab } from './tabs/InfoTab';
import { ContractsTab } from './tabs/ContractsTab';
import { BillingTab } from './tabs/BillingTab';
import { StatsTab } from './tabs/StatsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { FilesTab } from './tabs/FilesTab';
import { LogsTab } from './tabs/LogsTab';
import { ActivityTab } from './tabs/ActivityTab';
import { CommentsTab } from './tabs/CommentsTab';
import { ClientEquipmentTab } from './tabs/ClientEquipmentTab';
import styles from './CustomerDetailPage.module.css';

const TAB_IDS = ['information', 'contracts', 'billing', 'statistics', 'documents', 'files', 'logs', 'equipos', 'actividad', 'comentarios'];
const HASH_ALIASES: Record<string, string> = { services: 'contracts' };

function formatBalance(b: number | undefined | null) {
  if (b === undefined || b === null) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(b);
}

export default function CustomerDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const resolved = HASH_ALIASES[hash] ?? hash;
    return TAB_IDS.includes(resolved) ? resolved : 'information';
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
      const resolved = HASH_ALIASES[hash] ?? hash;
      if (TAB_IDS.includes(resolved)) setActiveTab(resolved);
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

  const canViewEquipment = useCan('inventory.read');
  const { data: customer, isLoading } = useClientDetail(id);
  const toggleStatus = useToggleClientStatus();
  const deleteCustomer = useDeleteCustomer();
  const { data: customerTasks = [] } = useTasksByCustomer(id || undefined);
  const taskCount = customerTasks.length;
  const { data: customerTicketsData } = useTicketsByCustomer(id || undefined);
  const ticketCount = customerTicketsData?.total ?? 0;

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
        <InfoTab
          customer={customer}
          active={activatedTabs.current.has('information')}
        />
      ),
    },
    {
      id: 'contracts',
      label: 'Contratos',
      content: <ContractsTab clientId={String(id)} active={activatedTabs.current.has('contracts')} />,
    },
    {
      id: 'billing',
      label: 'Facturación',
      content: <BillingTab clientId={String(id)} active={activatedTabs.current.has('billing')} />,
    },
    {
      id: 'statistics',
      label: 'Estadísticas',
      content: <StatsTab clientId={String(id)} active={activatedTabs.current.has('statistics')} />,
    },
    {
      id: 'documents',
      label: 'Documentos',
      content: <DocumentsTab clientId={String(id)} active={activatedTabs.current.has('documents')} />,
    },
    {
      id: 'files',
      label: 'Archivos',
      content: <FilesTab clientId={String(id)} active={activatedTabs.current.has('files')} />,
    },
    {
      id: 'logs',
      label: 'Logs',
      content: <LogsTab clientId={String(id)} active={activatedTabs.current.has('logs')} />,
    },
    ...(canViewEquipment
      ? [
          {
            id: 'equipos',
            label: 'Equipos',
            content: (
              <ClientEquipmentTab clientId={String(id)} active={activatedTabs.current.has('equipos')} />
            ),
          },
        ]
      : []),
    {
      id: 'actividad',
      label: 'Actividad',
      content: <ActivityTab clientId={String(id)} />,
    },
    {
      id: 'comentarios',
      label: 'Comentarios',
      content: <CommentsTab clientId={String(id)} />,
    },
  ];

  const splynxId = (customer as { splynxId?: string | null }).splynxId ?? null;
  // Account balance from the GR-synced debt (balanceDue). A debtor owes money,
  // so the account saldo is shown NEGATIVE — consistent with the "Saldo deudor"
  // card on the Info tab. Non-debtors have no debt → $ 0,00.
  const balanceDue = (customer as { balanceDue?: number | null }).balanceDue ?? null;
  const balance = balanceDue && balanceDue > 0 ? -balanceDue : balanceDue;

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
                <Can permission="clients.write">
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      toggleStatus.mutate({ id, status: isBlocked ? 'active' : 'blocked' });
                      setAccionesOpen(false);
                    }}
                  >
                    {isBlocked ? 'Desbloquear cliente' : 'Bloquear cliente'}
                  </button>
                </Can>
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
                <Can permission="clients.delete">
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
                </Can>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/scheduling/tasks?customerId=${id}`)}>Tareas ({taskCount}) ▾</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/admin/tickets/opened?customerId=${id}`)}>Tickets ({ticketCount}) ▾</Button>
          <Can permission="clients.write">
            <Button variant="primary" size="sm" onClick={() => navigate(`/admin/customers/view/${id}/edit`)}>Guardar</Button>
          </Can>
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
