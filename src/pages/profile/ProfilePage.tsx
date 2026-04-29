import { useState } from 'react';
import { useProfile, useUpdateProfile, useChangePassword, useToggle2FA } from '@/hooks/useProfile';
import styles from './ProfilePage.module.css';

type Tab = 'perfil' | 'seguridad' | 'preferencias';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const toggle2FA = useToggle2FA();

  // Perfil form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Security form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Preferences form state
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [prefSuccess, setPrefSuccess] = useState('');

  // Sync form state with profile data when loaded
  const [initialized, setInitialized] = useState(false);
  if (profile && !initialized) {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
    setLanguage(profile.language);
    setTimezone(profile.timezone);
    setInitialized(true);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    updateProfile.mutate(
      { name, email, phone },
      {
        onSuccess: () => setProfileSuccess('Cambios guardados correctamente'),
        onError: () => setProfileError('Error al guardar los cambios'),
      }
    );
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordSuccess('Contraseña actualizada correctamente');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: () => setPasswordError('Contraseña actual incorrecta'),
      }
    );
  }

  function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setPrefSuccess('');
    updateProfile.mutate(
      { language, timezone },
      { onSuccess: () => setPrefSuccess('Preferencias guardadas correctamente') }
    );
  }

  function handleToggle2FA() {
    if (!profile) return;
    toggle2FA.mutate(!profile.twoFactorEnabled);
  }

  if (isLoading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  if (!profile) {
    return <div className={styles.error}>Error al cargar el perfil</div>;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Mi perfil</h1>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'perfil' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('perfil')}
        >
          Perfil
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'seguridad' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('seguridad')}
        >
          Seguridad
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'preferencias' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('preferencias')}
        >
          Preferencias
        </button>
      </div>

      {activeTab === 'perfil' && (
        <div className={styles.tabContent}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>{profile.avatarInitials}</div>
          </div>

          <form onSubmit={handleSaveProfile} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="name">Nombre completo</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="phone">Teléfono</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Rol</label>
              <span className={styles.readOnly}>{profile.role}</span>
            </div>
            <div className={styles.field}>
              <label>Fecha de creación</label>
              <span className={styles.readOnly}>{profile.createdAt}</span>
            </div>
            <div className={styles.field}>
              <label>Último inicio de sesión</label>
              <span className={styles.readOnly}>{profile.lastLogin}</span>
            </div>

            {profileSuccess && <p className={styles.success}>{profileSuccess}</p>}
            {profileError && <p className={styles.error}>{profileError}</p>}

            <button type="submit" className={styles.submitBtn}>
              Guardar cambios
            </button>
          </form>
        </div>
      )}

      {activeTab === 'seguridad' && (
        <div className={styles.tabContent}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Cambiar contraseña</h2>
            <form onSubmit={handleChangePassword} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="currentPassword">Contraseña actual</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="newPassword">Nueva contraseña</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>

              {passwordSuccess && <p className={styles.success}>{passwordSuccess}</p>}
              {passwordError && <p className={styles.error}>{passwordError}</p>}

              <button type="submit" className={styles.submitBtn}>
                Cambiar contraseña
              </button>
            </form>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Autenticación de dos factores</h2>
            <p className={styles.description}>
              La autenticación de dos factores agrega una capa adicional de seguridad a tu cuenta.
              Al activarla, necesitarás un código adicional además de tu contraseña para iniciar sesión.
            </p>
            <div className={styles.twoFaStatus}>
              <span className={`${styles.badge} ${profile.twoFactorEnabled ? styles.badgeActive : styles.badgeInactive}`}>
                {profile.twoFactorEnabled ? 'Activo' : 'Inactivo'}
              </span>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleToggle2FA}
              >
                {profile.twoFactorEnabled ? 'Desactivar 2FA' : 'Activar 2FA'}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'preferencias' && (
        <div className={styles.tabContent}>
          <form onSubmit={handleSavePreferences} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="language">Idioma</label>
              <select
                id="language"
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="timezone">Zona horaria</label>
              <select
                id="timezone"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              >
                <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/Madrid">Europe/Madrid</option>
              </select>
            </div>

            {prefSuccess && <p className={styles.success}>{prefSuccess}</p>}

            <button type="submit" className={styles.submitBtn}>
              Guardar preferencias
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
