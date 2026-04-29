import { useEffect, useRef, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/molecules/Tabs/Tabs';
import { StatusBadge } from '../../components/atoms/StatusBadge/StatusBadge';
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

function toStatusBadge(status: string): 'active' | 'late' | 'blocked' | 'inactive' {
  if (status === 'new') return 'inactive';
  if (status === 'late') return 'late';
  if (status === 'blocked') return 'blocked';
  if (status === 'inactive') return 'inactive';
  return 'active';
}

export default function ClienteDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(hash) ? hash : 'information';
  });

  const [accionesOpen, setAccionesOpen] = useState(false);
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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.name}>{customer.name}</h1>
          <span className={styles.id}>ID: {customer.id}</span>
        </div>
        <div className={styles.headerRight}>
          <StatusBadge status={toStatusBadge(customer.status)} />
          <div className={styles.contactInfo}>
            <span>{customer.email}</span>
            <span>{customer.phone}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div ref={accionesRef} style={{ position: 'relative' }}>
            <Button variant="secondary" size="sm" onClick={() => setAccionesOpen(o => !o)}>
              Acciones
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
                    if (window.confirm('¿Estás seguro de que querés eliminar este cliente?')) {
                      deleteCustomer.mutate(id, {
                        onSuccess: () => navigate('/admin/customers/list'),
                      });
                    }
                    setAccionesOpen(false);
                  }}
                >
                  Eliminar cliente
                </button>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/scheduling')}>Tareas</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/tickets/opened')}>Tickets</Button>
          <Button variant="primary" size="sm" onClick={() => navigate(`/admin/customers/view/${id}/edit`)}>Guardar</Button>
        </div>
      </div>
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
