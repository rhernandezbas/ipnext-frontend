import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useServiceInstalledItems, useAddInstalledItem } from '@/hooks/useServiceInventory';
import { useOnuWifiStatus, useSetWifiBand, useEnableTr069, useVerifyOnuWifi } from '@/hooks/useWifi';
import { isSmartOltNotConfigured, mapWifiError } from '@/api/wifi.api';
import type { WifiBand } from '@/types/wifi';
import { EnableTr069Modal } from './EnableTr069Modal';
import { ChangeWifiBandModal } from './ChangeWifiBandModal';
import { AssociateOnuModal } from './AssociateOnuModal';
import styles from './WifiCard.module.css';

interface WifiCardProps {
  contractId: string;
  /** Defer the underlying query until the card is actually shown (mirrors ServiceInventorySection). */
  enabled?: boolean;
}

type ModalState =
  | { mode: 'closed' }
  | { mode: 'enable-tr069' }
  | { mode: 'change-band'; band: WifiBand }
  | { mode: 'associate' };

const BAND_LABEL: Record<string, string> = { '2.4': '2.4 GHz', '5': '5 GHz' };

/**
 * wifi-staff-panel — card "WiFi" del detalle de contrato (proposal
 * wifi-self-service, F1 FE sobre el F0 de BE ya en prod). Gated wifi.read
 * entero: sin el permiso, la card no se renderiza (no un botón deshabilitado).
 *
 * El item ONU activo del contrato viene de `useServiceInstalledItems`, la
 * MISMA query key que usa `ServiceInventorySection` — TanStack Query dedupea
 * el fetch, ambas secciones comparten un solo GET.
 */
export function WifiCard({ contractId, enabled = true }: WifiCardProps) {
  const { data: items, isLoading: itemsLoading } = useServiceInstalledItems(contractId, enabled);
  const addItem = useAddInstalledItem(contractId);
  const { verify, isPending: verifying } = useVerifyOnuWifi();

  const onuItem = (items ?? []).find((it) => it.type === 'ONU' && it.status === 'active' && it.serialNumber) ?? null;
  const sn = onuItem?.serialNumber ?? null;

  const wifiQuery = useOnuWifiStatus(sn, enabled && !!sn);
  const setBand = useSetWifiBand(sn ?? '');
  const enableTr069 = useEnableTr069(sn ?? '');

  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [modalError, setModalError] = useState<string | null>(null);

  function closeModal() {
    setModal({ mode: 'closed' });
    setModalError(null);
  }

  async function handleEnableTr069(vlan: number, tr069Profile: string) {
    setModalError(null);
    try {
      await enableTr069.mutateAsync({ vlan, tr069Profile });
      closeModal();
    } catch (err) {
      setModalError(mapWifiError(err, 'wifi.manage'));
    }
  }

  async function handleChangeBand(ssid: string, password: string) {
    if (modal.mode !== 'change-band') return;
    setModalError(null);
    try {
      await setBand.mutateAsync({ port: modal.band.port, ssid, password });
      closeModal();
    } catch (err) {
      setModalError(mapWifiError(err, 'wifi.manage'));
    }
  }

  const data = wifiQuery.data;

  return (
    <Can permission="wifi.read">
      <div className={styles.section}>
        <div className={styles.header}>
          <strong className={styles.heading}>WiFi</strong>
        </div>

        {itemsLoading ? (
          <p className={styles.muted}>Cargando…</p>
        ) : !onuItem ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Sin ONU asociada</p>
            <Can permission="inventory.write">
              <button type="button" className={styles.emptyAction} onClick={() => setModal({ mode: 'associate' })}>
                Asociar ONU
              </button>
            </Can>
          </div>
        ) : wifiQuery.isLoading ? (
          <p className={styles.muted}>Cargando estado WiFi…</p>
        ) : wifiQuery.isError ? (
          isSmartOltNotConfigured(wifiQuery.error) ? (
            <p className={styles.warnBanner} role="status">SmartOLT no configurado — avisale al administrador.</p>
          ) : (
            <div className={styles.errorBanner} role="alert">
              <span>{mapWifiError(wifiQuery.error, 'wifi.read')}</span>
              <button type="button" className={styles.linkBtn} onClick={() => void wifiQuery.refetch()}>
                Reintentar
              </button>
            </div>
          )
        ) : data && !data.found ? (
          <p className={styles.warnBanner} role="status">
            El serial cargado no existe en SmartOLT ({onuItem.serialNumber}). Revisá el serial en «Equipos instalados».
          </p>
        ) : data ? (
          <>
            <div className={styles.statusRow}>
              <span className={data.online ? styles.chipOk : styles.chipWarn}>
                {data.online ? 'En línea' : 'Offline'}
              </span>
              {data.onuType && <span className={styles.chipMuted}>{data.onuType}</span>}
              <span className={data.tr069Enabled ? styles.chipOk : styles.chipMuted}>
                TR-069: {data.tr069Enabled ? 'Habilitado' : 'No habilitado'}
              </span>
            </div>

            {!data.tr069Enabled && (
              <Can permission="wifi.manage">
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => setModal({ mode: 'enable-tr069' })}
                >
                  Habilitar TR-069
                </button>
              </Can>
            )}

            {data.bands.length > 0 && (
              <ul className={styles.bandList}>
                {data.bands.map((band) => (
                  <li key={band.port} className={styles.bandRow}>
                    <span className={styles.bandName}>{BAND_LABEL[band.band] ?? band.band}</span>
                    <span className={styles.bandSsid}>
                      {band.ssid ?? '— sin configurar por Prominense'}
                    </span>
                    {data.tr069Enabled && (
                      <Can permission="wifi.manage">
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => setModal({ mode: 'change-band', band })}
                        >
                          Cambiar WiFi
                        </button>
                      </Can>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <details className={styles.devices}>
              <summary className={styles.devicesSummary}>
                Dispositivos conectados
                <span className={styles.count}>{data.hosts.filter((h) => h.active).length}</span>
              </summary>
              {data.hosts.length === 0 ? (
                <p className={styles.muted}>Sin dispositivos.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th><th>IP</th><th>MAC</th><th>Interfaz</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hosts.map((h, i) => (
                        <tr key={`${h.mac ?? h.ip ?? i}`}>
                          <td>{h.name ?? '—'}</td>
                          <td className={styles.mono}>{h.ip ?? '—'}</td>
                          <td className={styles.mono}>{h.mac ?? '—'}</td>
                          <td>{h.interface === 'wifi' ? 'WiFi' : 'Ethernet'}</td>
                          <td>{h.active ? 'Activo' : 'Inactivo'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          </>
        ) : null}
      </div>

      {modal.mode === 'enable-tr069' && sn && (
        <EnableTr069Modal
          sn={sn}
          saving={enableTr069.isPending}
          error={modalError}
          onConfirm={(vlan, profile) => void handleEnableTr069(vlan, profile)}
          onClose={closeModal}
        />
      )}

      {modal.mode === 'change-band' && sn && (
        <ChangeWifiBandModal
          sn={sn}
          band={modal.band}
          saving={setBand.isPending}
          error={modalError}
          onConfirm={(ssid, password) => void handleChangeBand(ssid, password)}
          onClose={closeModal}
        />
      )}

      {modal.mode === 'associate' && (
        <AssociateOnuModal
          onVerify={verify}
          verifying={verifying}
          onCreate={(input) => addItem.mutateAsync(input)}
          onAssociated={closeModal}
          onClose={closeModal}
        />
      )}
    </Can>
  );
}
