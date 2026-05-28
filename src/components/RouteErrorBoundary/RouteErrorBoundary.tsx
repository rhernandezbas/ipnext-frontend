import { Component, ErrorInfo, ReactNode } from 'react';
import styles from './RouteErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Injectable for tests; defaults to a real full-page reload. */
  reload?: () => void;
}

interface State {
  error: Error | null;
}

/** sessionStorage key + window (ms) that guards against reload loops when a
 *  freshly-deployed chunk is genuinely broken (don't reload forever). */
const RELOAD_TS_KEY = 'route-chunk-reload-ts';
const RELOAD_GUARD_MS = 10_000;

/** A dynamic-import / code-split chunk failure — typically a stale chunk after a
 *  deploy (the hashed file the open tab references no longer exists on the server). */
function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Loading chunk\b|ChunkLoadError|Importing a module script failed/i.test(msg);
}

/**
 * Wraps the lazy route tree. Without it, a rejected lazy import() (stale chunk
 * after a deploy) bubbles up uncaught and blanks the whole app — the user has to
 * refresh manually. Here we auto-reload ONCE on a chunk error (so the fresh
 * index.html + new chunk hashes load transparently), and fall back to a
 * recoverable message for any other runtime error instead of a white screen.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (!isChunkLoadError(error)) return;
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
    // Only auto-reload if we haven't just done so — otherwise a truly broken
    // deploy would loop forever; show the manual fallback instead.
    if (Date.now() - last > RELOAD_GUARD_MS) {
      sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
      (this.props.reload ?? (() => window.location.reload()))();
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      const reload = this.props.reload ?? (() => window.location.reload());
      return (
        <div className={styles.wrapper} role="alert">
          <h1 className={styles.title}>No se pudo cargar la página</h1>
          <p className={styles.message}>
            Puede ser una versión vieja en caché. Recargá para obtener la última.
          </p>
          <button type="button" className={styles.button} onClick={() => reload()}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
