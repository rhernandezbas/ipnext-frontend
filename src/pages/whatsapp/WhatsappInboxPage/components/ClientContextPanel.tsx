import { useState, type ReactNode } from 'react';
import { useInboxClientContext } from '@/hooks/useWhatsapp';
import type { WhatsappClientContext } from '@/types/whatsapp';
import { ContextNeutral } from './clientContext/ContextNeutral';
import { CandidatePicker } from './clientContext/CandidatePicker';
import { ContextSkeleton } from './clientContext/ContextSkeleton';
import { ContextError } from './clientContext/ContextError';
import { MatchedClientView } from './clientContext/MatchedClientView';
import { PreviousConversationsSection } from './clientContext/PreviousConversationsSection';
import styles from './ClientContextPanel.module.css';

interface ClientContextPanelProps {
  conversationId?: string | null;
  /** `undefined`/`null` cuando el detalle todavía no trae `clientContext`
   * (contexto ausente). Contexto LIGHT (F1) — instantáneo, ya resuelto por
   * `useWhatsappConversation`. Distinto del contexto RICO (F1.5) que este
   * container pide bajo demanda vía `useInboxClientContext`. */
  lightContext?: WhatsappClientContext | null;
  /**
   * Ola 6 (conversaciones previas) — saltar a otra conversación del mismo
   * contacto desde la sección "Conversaciones previas" (la page mapea a
   * `setSelectedId`). Ausente → la sección NO se monta (cero regresión para
   * call sites/tests previos que no la pasan). Es del CONTACTO, no del cliente
   * matcheado: se muestra siempre que haya una conversación abierta, sin
   * importar el estado del contexto (matched/unknown/ambiguous).
   */
  onNavigateConversation?: (id: string) => void;
}

const HEADING_ID = 'wa-context-heading';

function Heading() {
  return (
    <h2 id={HEADING_ID} className={styles.title}>
      Cliente
    </h2>
  );
}

/**
 * ClientContextPanel — CONTAINER FINO (messaging-inbox-v2 F1.5, design §1).
 * Reescritura de F1 (histórico: presentacional puro sobre `clientContext`
 * plano). Deriva el estado del panel de `lightContext.status` (instantáneo)
 * + un estado local `chosenId` para desambiguar `ambiguous`. El fetch RICO
 * (`useInboxClientContext`) SOLO se dispara cuando hay un candidato resuelto
 * (`matched`, o `ambiguous` ya elegido) — nunca en `ambiguous` sin elección
 * (CTX-1: no se agregan datos de nadie hasta que el agente elige).
 *
 * `status==='matched'` con `lightContext.clients` vacío es un dato
 * malformado (el BE no debería mandarlo) — cae a neutro sin intentar el
 * fetch rico, preservando el contrato histórico de F1.
 */
export function ClientContextPanel({ conversationId, lightContext, onNavigateConversation }: ClientContextPanelProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);

  const status = lightContext?.status;
  const hasCandidates = (lightContext?.clients.length ?? 0) > 0;
  const isAmbiguousUnchosen = status === 'ambiguous' && chosenId === null;
  const shouldFetchRich = (status === 'matched' && hasCandidates) || (status === 'ambiguous' && chosenId !== null);

  const richQuery = useInboxClientContext(
    shouldFetchRich ? conversationId ?? null : null,
    status === 'ambiguous' ? chosenId : null,
  );

  let content: ReactNode;
  if (!lightContext) {
    content = <ContextNeutral message="Sin información de contexto disponible." />;
  } else if (status === 'unknown') {
    content = <ContextNeutral message="Contacto desconocido — sin cliente asociado." />;
  } else if (status === 'matched' && !hasCandidates) {
    content = <ContextNeutral message="Sin información de contexto disponible." />;
  } else if (isAmbiguousUnchosen) {
    content = <CandidatePicker clients={lightContext.clients} onChoose={setChosenId} />;
  } else if (richQuery.isLoading) {
    content = <ContextSkeleton />;
  } else if (richQuery.isError && !richQuery.data) {
    content = <ContextError onRetry={() => { void richQuery.refetch(); }} />;
  } else if (richQuery.data?.client) {
    content = (
      <MatchedClientView
        client={richQuery.data.client}
        isRefreshingBalance={richQuery.isRefreshingBalance}
        // Bug #2 fix (post-review-adversarial): el chip "no se pudo
        // actualizar" es del refresh de BALANCE (2da query, en background),
        // no de la query PRIMARIA — `richQuery.isError` es de la primaria y
        // dispara falsos positivos/negativos cruzados.
        hasStaleError={richQuery.balanceRefreshFailed}
        // Contador de conversaciones — TOP-LEVEL del contexto (sibling de
        // `client`, no un campo suyo). Opcional/backcompat: puede faltar si
        // el FE deployó antes que el BE lo agregue.
        conversations={richQuery.data.conversations}
      />
    );
  } else {
    content = <ContextNeutral message="Sin información de contexto disponible." />;
  }

  return (
    // Fix bug ALTO a11y (review adversarial, design §10): `aria-busy` faltaba
    // — un lector de pantalla no tenía forma de saber que el panel está
    // recargando contenido cuando cambia de cliente/candidato.
    <section className={styles.panel} aria-labelledby={HEADING_ID} aria-busy={richQuery.isLoading}>
      <Heading />
      {content}
      {/* Ola 6 (conversaciones previas) — sección colapsable con las OTRAS
          conversaciones del mismo contacto. Del CONTACTO (no del cliente
          matcheado): se muestra siempre que haya conversación abierta + un
          `onNavigateConversation`, ortogonal a la rama de contexto de arriba. */}
      {conversationId && onNavigateConversation && (
        <PreviousConversationsSection conversationId={conversationId} onNavigate={onNavigateConversation} />
      )}
    </section>
  );
}
