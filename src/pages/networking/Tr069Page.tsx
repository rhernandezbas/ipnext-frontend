import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useTr069Profiles, useCreateTr069Profile, useUpdateTr069Profile, useDeleteTr069Profile, useTr069Devices, useProvisionDevice, useDeleteTr069Device } from '@/hooks/useTr069';
import type { Tr069Profile, Tr069Device } from '@/types/tr069';
import styles from './Tr069Page.module.css';

type Tab = 'perfiles' | 'dispositivos';

function DeviceStatusBadge({ status }: { status: Tr069Device['status'] }) {
  const cssMap: Record<Tr069Device['status'], string> = {
    active: styles.statusOnline,
    pending: styles.statusWarning,
    error: styles.statusOffline,
  };
  const labelMap: Record<Tr069Device['status'], string> = {
    active: 'Activo',
    pending: 'Pendiente',
    error: 'Error',
  };
  return <span className={cssMap[status]}>{labelMap[status]}</span>;
}

function ProfileStatusBadge({ status }: { status: Tr069Profile['status'] }) {
  return (
    <span className={status === 'active' ? styles.statusOnline : styles.statusOffline}>
      {status === 'active' ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface AddProfileModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<Tr069Profile, 'id'>) => void;
}

function AddProfileModal({ onClose, onSubmit }: AddProfileModalProps) {
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [acsUrl, setAcsUrl] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('');
  const [periodicInformInterval, setPeriodicInformInterval] = useState('300');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name, manufacturer, model, acsUrl,
      firmwareVersion: firmwareVersion || null,
      connectionRequestUrl: null,
      periodicInformInterval: Number(periodicInformInterval),
      deviceCount: 0,
      parameters: [],
      status: 'active',
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Nuevo perfil TR-069</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="tr-name">Nombre</label>
            <input id="tr-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="tr-manufacturer">Fabricante</label>
              <input id="tr-manufacturer" type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tr-model">Modelo</label>
              <input id="tr-model" type="text" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="tr-acs">ACS URL</label>
            <input id="tr-acs" type="text" value={acsUrl} onChange={e => setAcsUrl(e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="tr-firmware">Firmware</label>
              <input id="tr-firmware" type="text" value={firmwareVersion} onChange={e => setFirmwareVersion(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tr-interval">Intervalo inform (seg)</label>
              <input id="tr-interval" type="number" value={periodicInformInterval} onChange={e => setPeriodicInformInterval(e.target.value)} />
            </div>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditProfileModalProps {
  profile: Tr069Profile;
  onClose: () => void;
  onSubmit: (data: Partial<Tr069Profile>) => void;
}

function EditProfileModal({ profile, onClose, onSubmit }: EditProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [manufacturer, setManufacturer] = useState(profile.manufacturer);
  const [model, setModel] = useState(profile.model);
  const [acsUrl, setAcsUrl] = useState(profile.acsUrl);
  const [firmwareVersion, setFirmwareVersion] = useState(profile.firmwareVersion ?? '');
  const [periodicInformInterval, setPeriodicInformInterval] = useState(String(profile.periodicInformInterval));
  const [status, setStatus] = useState<Tr069Profile['status']>(profile.status);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, manufacturer, model, acsUrl, firmwareVersion: firmwareVersion || null, periodicInformInterval: Number(periodicInformInterval), status });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Editar perfil TR-069</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="edit-tr-name">Nombre</label>
            <input id="edit-tr-name" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-tr-manufacturer">Fabricante</label>
              <input id="edit-tr-manufacturer" type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-tr-model">Modelo</label>
              <input id="edit-tr-model" type="text" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-tr-acs">ACS URL</label>
            <input id="edit-tr-acs" type="text" value={acsUrl} onChange={e => setAcsUrl(e.target.value)} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="edit-tr-firmware">Firmware</label>
              <input id="edit-tr-firmware" type="text" value={firmwareVersion} onChange={e => setFirmwareVersion(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-tr-interval">Intervalo inform (seg)</label>
              <input id="edit-tr-interval" type="number" value={periodicInformInterval} onChange={e => setPeriodicInformInterval(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="edit-tr-status">Estado</label>
            <select id="edit-tr-status" value={status} onChange={e => setStatus(e.target.value as Tr069Profile['status'])}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeviceParamsModalProps {
  device: Tr069Device;
  onClose: () => void;
}

function DeviceParamsModal({ device, onClose }: DeviceParamsModalProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>Parámetros — {device.serialNumber}</h2>
        {device.parameters.length === 0 ? (
          <p style={{ color: '#6b7280', textAlign: 'center', margin: '1.5rem 0' }}>
            No hay parámetros configurados para este dispositivo.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Clave</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {device.parameters.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.key}</td>
                  <td style={{ padding: '0.5rem' }}>{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const profileColumns = [
  { label: 'Nombre', key: 'name' as keyof Tr069Profile },
  { label: 'Fabricante', key: 'manufacturer' as keyof Tr069Profile },
  { label: 'Modelo', key: 'model' as keyof Tr069Profile },
  { label: 'ACS URL', key: 'acsUrl' as keyof Tr069Profile },
  { label: 'Firmware', key: 'firmwareVersion' as keyof Tr069Profile, render: (row: Tr069Profile) => row.firmwareVersion ?? '—' },
  { label: 'Dispositivos', key: 'deviceCount' as keyof Tr069Profile },
  {
    label: 'Estado',
    key: 'status' as keyof Tr069Profile,
    render: (row: Tr069Profile) => <ProfileStatusBadge status={row.status} />,
  },
];

export default function Tr069Page() {
  const [activeTab, setActiveTab] = useState<Tab>('perfiles');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Tr069Profile | null>(null);
  const [viewParams, setViewParams] = useState<Tr069Device | null>(null);

  const { data: profiles = [], isLoading: profilesLoading } = useTr069Profiles();
  const { mutate: createProfile } = useCreateTr069Profile();
  const { mutate: updateProfile } = useUpdateTr069Profile();
  const { mutate: deleteProfile } = useDeleteTr069Profile();
  const { data: devices = [], isLoading: devicesLoading } = useTr069Devices();
  const { mutate: provision } = useProvisionDevice();
  const { mutate: deleteDevice } = useDeleteTr069Device();

  function handleDeleteProfile(row: Tr069Profile) {
    if (window.confirm(`¿Eliminar perfil "${row.name}"?`)) {
      deleteProfile(row.id);
    }
  }

  function handleDeleteDevice(row: Tr069Device) {
    if (window.confirm(`¿Eliminar dispositivo "${row.serialNumber}"?`)) {
      deleteDevice(row.id);
    }
  }

  const deviceColumns = [
    { label: 'Nro. Serie', key: 'serialNumber' as keyof Tr069Device },
    { label: 'Perfil', key: 'profileName' as keyof Tr069Device },
    { label: 'Cliente', key: 'clientName' as keyof Tr069Device, render: (row: Tr069Device) => row.clientName ?? '—' },
    {
      label: 'Estado',
      key: 'status' as keyof Tr069Device,
      render: (row: Tr069Device) => <DeviceStatusBadge status={row.status} />,
    },
    { label: 'Último contacto', key: 'lastContact' as keyof Tr069Device, render: (row: Tr069Device) => formatDate(row.lastContact) },
    { label: 'Firmware', key: 'firmwareVersion' as keyof Tr069Device },
  ];

  const deviceActions = [
    { label: 'Provisionar', onClick: (row: Tr069Device) => provision(row.id) },
    { label: 'Ver parámetros', onClick: (row: Tr069Device) => setViewParams(row) },
    { label: 'Eliminar', onClick: handleDeleteDevice },
  ];

  const profileActions = [
    { label: 'Editar', onClick: (row: Tr069Profile) => setEditingProfile(row) },
    { label: 'Eliminar', onClick: handleDeleteProfile },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>TR-069</h1>
        {activeTab === 'perfiles' && (
          <button className={styles.btnPrimary} onClick={() => setShowProfileModal(true)}>
            Nuevo perfil
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        {[
          { key: 'perfiles' as Tab, label: 'Perfiles' },
          { key: 'dispositivos' as Tab, label: 'Dispositivos' },
        ].map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'perfiles' && (
        <DataTable
          columns={profileColumns}
          data={profiles}
          loading={profilesLoading}
          actions={profileActions}
          emptyMessage="No se encontraron perfiles TR-069."
        />
      )}

      {activeTab === 'dispositivos' && (
        <DataTable
          columns={deviceColumns}
          data={devices}
          loading={devicesLoading}
          actions={deviceActions}
          emptyMessage="No se encontraron dispositivos TR-069."
        />
      )}

      {showProfileModal && (
        <AddProfileModal
          onClose={() => setShowProfileModal(false)}
          onSubmit={data => { createProfile(data); setShowProfileModal(false); }}
        />
      )}

      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSubmit={data => { updateProfile({ id: editingProfile.id, data }); setEditingProfile(null); }}
        />
      )}

      {viewParams && (
        <DeviceParamsModal device={viewParams} onClose={() => setViewParams(null)} />
      )}
    </div>
  );
}
