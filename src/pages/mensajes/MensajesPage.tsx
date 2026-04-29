import { useState } from 'react';
import { useMessages, useCreateMessage } from '@/hooks/useMessages';
import type { Message, MessageChannel } from '@/types/message';
import styles from './MensajesPage.module.css';

type Tab = 'inbox' | 'sent' | 'draft';

const TAB_LABELS: Record<Tab, string> = {
  inbox: 'Recibidos',
  sent: 'Enviados',
  draft: 'Borradores',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
}

interface ComposeFormProps {
  onClose: () => void;
}

function ComposeForm({ onClose }: ComposeFormProps) {
  const [para, setPara] = useState('');
  const [canal, setCanal] = useState<MessageChannel>('internal');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { mutate: createMessage } = useCreateMessage();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMessage({
      subject: asunto,
      body: mensaje,
      toId: para || null,
      toName: para || null,
      clientId: null,
      channel: canal,
    });
    onClose();
  }

  return (
    <form className={styles.composeForm} onSubmit={handleSubmit}>
      <h2 className={styles.composeTitle}>Nuevo mensaje</h2>
      <div className={styles.formGroup}>
        <label htmlFor="msg-para">Para</label>
        <input
          id="msg-para"
          type="text"
          value={para}
          onChange={e => setPara(e.target.value)}
          placeholder="Nombre del destinatario"
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="msg-canal">Canal</label>
        <select
          id="msg-canal"
          value={canal}
          onChange={e => setCanal(e.target.value as MessageChannel)}
        >
          <option value="internal">Interno</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="msg-asunto">Asunto</label>
        <input
          id="msg-asunto"
          type="text"
          value={asunto}
          onChange={e => setAsunto(e.target.value)}
          placeholder="Asunto del mensaje"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="msg-mensaje">Mensaje</label>
        <textarea
          id="msg-mensaje"
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          placeholder="Escribí tu mensaje aquí..."
          required
        />
      </div>
      <button type="submit" className={styles.sendBtn}>Enviar</button>
    </form>
  );
}

export default function MensajesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  const { data: messages = [] } = useMessages(activeTab);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Mensajes</h1>

      <div className={styles.layout}>
        {/* Left panel */}
        <div className={styles.leftPanel}>
          <button
            className={styles.newMsgBtn}
            onClick={() => { setShowCompose(true); setSelectedMessage(null); }}
          >
            Nuevo mensaje
          </button>

          <div className={styles.tabs}>
            {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => { setActiveTab(tab); setSelectedMessage(null); setShowCompose(false); }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div className={styles.messageList}>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`${styles.messageItem} ${selectedMessage?.id === msg.id ? styles.messageItemSelected : ''}`}
                onClick={() => { setSelectedMessage(msg); setShowCompose(false); }}
              >
                {msg.status === 'unread' && <span className={styles.unreadBadge} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.messageFrom}>{msg.fromName}</p>
                  <p className={styles.messageSubject}>{msg.subject}</p>
                </div>
                <span className={styles.messageDate}>{formatDate(msg.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className={styles.rightPanel}>
          {showCompose ? (
            <ComposeForm onClose={() => setShowCompose(false)} />
          ) : selectedMessage ? (
            <div className={styles.messageDetail}>
              <h2 className={styles.messageDetailSubject}>{selectedMessage.subject}</h2>
              <p className={styles.messageDetailMeta}>
                De: {selectedMessage.fromName} &mdash; {formatDate(selectedMessage.createdAt)}
              </p>
              <p className={styles.messageDetailBody}>{selectedMessage.body}</p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <p>Seleccioná un mensaje</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
