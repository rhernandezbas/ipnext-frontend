import { useState } from 'react';
import { useOnlineSessions, useDisconnectSession } from '@/hooks/useClients';
import type { OnlineSession } from '@/hooks/useClients';
import styles from './ClientesOnlinePage.module.css';

function calcTotalTrafficGB(sessions: OnlineSession[]): number {
  const totalMbps = sessions.reduce((sum, s) => sum + s.downloadMbps + s.uploadMbps, 0);
  // rough estimate: assume average over 1 hour
  return Math.round((totalMbps * 3600) / 8 / 1024);
}

export default function ClientesOnlinePage() {
  const [search, setSearch] = useState('');
  const { data: sessions = [], isLoading } = useOnlineSessions();
  const disconnect = useDisconnectSession();

  const filtered = sessions.filter(
    (s) =>
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.ip.includes(search)
  );

  const downloading = filtered.filter((s) => s.downloadMbps > 0).length;
  const totalTrafficGB = calcTotalTrafficGB(filtered);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Clientes Online</h1>

      <div className={styles.summaryCards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Total online</span>
          <span className={styles.cardValue}>{filtered.length}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Descargando</span>
          <span className={styles.cardValue}>{downloading}</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Tráfico total</span>
          <span className={styles.cardValue}>{totalTrafficGB} GB</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar por nombre o IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className={styles.loading}>Cargando sesiones...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Cliente</th>
              <th scope="col">IP</th>
              <th scope="col">MAC</th>
              <th scope="col">Conectado desde</th>
              <th scope="col">Descarga</th>
              <th scope="col">Carga</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyRow}>
                  No hay clientes online.
                </td>
              </tr>
            ) : (
              filtered.map((session) => (
                <tr key={session.id}>
                  <td>{session.id}</td>
                  <td>{session.clientName}</td>
                  <td>{session.ip}</td>
                  <td>{session.mac}</td>
                  <td>{session.connectedSince}</td>
                  <td>{session.downloadMbps} Mbps</td>
                  <td>{session.uploadMbps} Mbps</td>
                  <td>
                    <button
                      className={styles.disconnectBtn}
                      onClick={() => disconnect.mutate(session.id)}
                    >
                      Desconectar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
