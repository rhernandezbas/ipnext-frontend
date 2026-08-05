import { useEffect, useRef, useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { KebabMenu } from '@/components/atoms/KebabMenu/KebabMenu';
import { Pagination } from '@/components/molecules/Pagination/Pagination';
import { ConfirmModal } from '@/components/molecules/ConfirmModal/ConfirmModal';
import { PortalPasswordModal } from '@/components/portal/PortalPasswordModal';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  usePortalAccountsList,
  useSetPortalAccountStatus,
  useRegeneratePortalPassword,
  useDeletePortalAccount,
} from '@/hooks/usePortalAccounts';
import type { PortalAccountAdminDto } from '@/types/portalAccount';
import { formatDateTimeShort } from '@/utils/formatDate';
import styles from './PortalUsersPage.module.css';

const PAGE_SIZE = 20;

/** Estado de los diálogos. Un SOLO `ConfirmModal` se deriva de este estado —
 *  nunca hay dos abiertos a la vez (evita conflictos de focus-trap). */
type Modal =
  | { kind: 'none' }
  | { kind: 'disable'; account: PortalAccountAdminDto }
  | { kind: 'regen1'; account: PortalAccountAdminDto }
  | { kind: 'regen2'; account: PortalAccountAdminDto }
  | { kind: 'delete1'; account: PortalAccountAdminDto }
  | { kind: 'delete2'; account: PortalAccountAdminDto }
  | { kind: 'password'; clientName: string; password: string };

const CLOSED: Modal = { kind: 'none' };

/** Último acceso: fecha+hora en horario AR (helper canónico) o "Nunca" si nunca entró. */
function formatLastLogin(iso: string | null): string {
  return iso ? formatDateTimeShort(iso) : 'Nunca';
}

export default function PortalUsersPage() {
  const { can } = useMyPermissions();
  const canManage = can('portal.manage');

  const [pageNum, setPageNum] = useState(1);
  const [modal, setModal] = useState<Modal>(CLOSED);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El endpoint EXIGE portal.manage — sin el permiso ni siquiera se dispara la
  // llamada (sería un 403 seguro). El resto de la página degrada a un aviso.
  const { data, isLoading, isError, refetch } = usePortalAccountsList(pageNum, PAGE_SIZE, canManage);

  const setStatus = useSetPortalAccountStatus();
  const regenerate = useRegeneratePortalPassword();
  const remove = useDeletePortalAccount();

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const accounts = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showEmpty = !isLoading && !isError && accounts.length === 0;

  function enable(account: PortalAccountAdminDto) {
    setStatus.mutate(
      { id: account.id, status: 'active' },
      {
        onSuccess: () => showToast(`Cuenta de ${account.clientName} habilitada.`),
        onError: () => showToast('No se pudo habilitar la cuenta. Reintentá.'),
      },
    );
  }

  function confirmDisable() {
    if (modal.kind !== 'disable') return;
    const { account } = modal;
    setStatus.mutate(
      { id: account.id, status: 'disabled' },
      {
        onSuccess: () => {
          showToast(`Cuenta de ${account.clientName} deshabilitada. Se revocaron sus sesiones.`);
          setModal(CLOSED);
        },
        onError: () => {
          showToast('No se pudo deshabilitar la cuenta. Reintentá.');
          setModal(CLOSED);
        },
      },
    );
  }

  function confirmRegenerate() {
    if (modal.kind !== 'regen2') return;
    const { account } = modal;
    regenerate.mutate(account.id, {
      onSuccess: (result) => setModal({ kind: 'password', clientName: account.clientName, password: result.password }),
      onError: () => {
        showToast('No se pudo regenerar la contraseña. Reintentá.');
        setModal(CLOSED);
      },
    });
  }

  function confirmDelete() {
    if (modal.kind !== 'delete2') return;
    const { account } = modal;
    remove.mutate(account.id, {
      onSuccess: () => {
        showToast(`Cuenta de ${account.clientName} eliminada.`);
        setModal(CLOSED);
      },
      onError: () => {
        showToast('No se pudo eliminar la cuenta. Reintentá.');
        setModal(CLOSED);
      },
    });
  }

  // Acciones POR FILA — el label del toggle depende del estado de la cuenta,
  // así que armamos un `KebabMenu` propio por fila (el `actions` del DataTable
  // usa una lista fija de labels, no sirve acá).
  const rowItems = (row: PortalAccountAdminDto) => [
    {
      label: 'Regenerar contraseña',
      onClick: () => setModal({ kind: 'regen1', account: row }),
    },
    row.status === 'active'
      ? { label: 'Deshabilitar', onClick: () => setModal({ kind: 'disable', account: row }) }
      : { label: 'Habilitar', onClick: () => enable(row) },
    {
      label: 'Borrar',
      onClick: () => setModal({ kind: 'delete1', account: row }),
    },
  ];

  const columns = [
    { label: 'Cliente', key: 'clientName' },
    { label: 'DNI', key: 'dni' },
    {
      label: 'Estado',
      key: 'status',
      render: (row: PortalAccountAdminDto) => (
        <span
          className={[styles.badge, row.status === 'active' ? styles.badgeActive : styles.badgeDisabled].join(' ')}
        >
          {row.status === 'active' ? 'Activa' : 'Deshabilitada'}
        </span>
      ),
    },
    {
      label: 'Último acceso',
      key: 'lastLoginAt',
      render: (row: PortalAccountAdminDto) => <span>{formatLastLogin(row.lastLoginAt)}</span>,
    },
    // Columna de acciones — sólo con `portal.manage`. Sin el permiso ni siquiera
    // se llega acá (el endpoint 403ea), pero además la escondemos por las dudas.
    ...(canManage
      ? [
          {
            label: '',
            key: '__actions',
            render: (row: PortalAccountAdminDto) => (
              <div className={styles.actionsCell}>
                <KebabMenu items={rowItems(row)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Usuarios de la app</h1>
        <p className={styles.subtitle}>
          Cuentas con las que los clientes entran a la app. Habilitá, deshabilitá, regenerá la contraseña
          o eliminá cada cuenta.
        </p>
      </header>

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {!canManage ? (
        <div className={styles.notice} role="note">
          <p className={styles.noticeTitle}>No tenés permiso para gestionar las cuentas de la app.</p>
          <p className={styles.noticeText}>
            Esta sección requiere el permiso <code>portal.manage</code>. Pedíselo a un administrador.
          </p>
        </div>
      ) : isError ? (
        <div className={styles.errorState} role="alert">
          <p className={styles.errorText}>No se pudieron cargar las cuentas. Intentá nuevamente.</p>
          <button type="button" className={styles.retryBtn} onClick={() => void refetch()}>
            Reintentar
          </button>
        </div>
      ) : showEmpty ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No hay cuentas de la app todavía.</p>
          <p className={styles.emptyText}>
            Cuando un cliente tenga usuario para entrar a la app, aparecerá acá.
          </p>
        </div>
      ) : (
        <>
          <DataTable<PortalAccountAdminDto>
            columns={columns}
            data={accounts}
            loading={isLoading}
            emptyMessage="No hay cuentas de la app todavía."
          />
          <div className={styles.paginationRow}>
            <Pagination currentPage={pageNum} totalPages={totalPages} onPageChange={setPageNum} />
          </div>
        </>
      )}

      <ConfirmModal
        open={modal.kind === 'disable'}
        title="Deshabilitar cuenta"
        message={
          modal.kind === 'disable'
            ? `Vas a deshabilitar la cuenta de ${modal.account.clientName}. El cliente no podrá entrar y se revocarán sus sesiones activas.`
            : ''
        }
        confirmLabel="Deshabilitar"
        tone="danger"
        busy={setStatus.isPending}
        onConfirm={confirmDisable}
        onCancel={() => setModal(CLOSED)}
      />

      <ConfirmModal
        open={modal.kind === 'regen1'}
        title="Regenerar contraseña"
        message={
          modal.kind === 'regen1'
            ? `Vas a generar una contraseña nueva para ${modal.account.clientName}. Esto REVOCA todas sus sesiones activas y el cliente deberá volver a entrar.`
            : ''
        }
        confirmLabel="Continuar"
        tone="danger"
        onConfirm={() => modal.kind === 'regen1' && setModal({ kind: 'regen2', account: modal.account })}
        onCancel={() => setModal(CLOSED)}
      />

      <ConfirmModal
        open={modal.kind === 'regen2'}
        title="Segunda confirmación"
        message={
          modal.kind === 'regen2'
            ? `Confirmá de nuevo: se generará una contraseña temporal para ${modal.account.clientName} y se mostrará UNA sola vez.`
            : ''
        }
        confirmLabel="Regenerar ahora"
        tone="danger"
        busy={regenerate.isPending}
        onConfirm={confirmRegenerate}
        onCancel={() => setModal(CLOSED)}
      />

      <ConfirmModal
        open={modal.kind === 'delete1'}
        title="Eliminar cuenta"
        message={
          modal.kind === 'delete1'
            ? `Vas a eliminar la cuenta de ${modal.account.clientName}. El cliente perderá el acceso a la app. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Continuar"
        tone="danger"
        onConfirm={() => modal.kind === 'delete1' && setModal({ kind: 'delete2', account: modal.account })}
        onCancel={() => setModal(CLOSED)}
      />

      <ConfirmModal
        open={modal.kind === 'delete2'}
        title="Segunda confirmación"
        message={
          modal.kind === 'delete2'
            ? `Confirmá de nuevo: la cuenta de ${modal.account.clientName} se eliminará definitivamente.`
            : ''
        }
        confirmLabel="Eliminar definitivamente"
        tone="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setModal(CLOSED)}
      />

      <PortalPasswordModal
        open={modal.kind === 'password'}
        clientName={modal.kind === 'password' ? modal.clientName : ''}
        password={modal.kind === 'password' ? modal.password : ''}
        title="Contraseña regenerada"
        onClose={() => setModal(CLOSED)}
      />
    </div>
  );
}
