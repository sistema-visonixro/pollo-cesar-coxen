import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import UpdateModal from './UpdateModal'

function Root() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        const ver = String(j.version || j?.ver || j?.v || '');
        setCurrentVersion((prev) => prev || ver);
      } catch (e) {
        // ignore
      }
    };
    load();

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        const ver = String(j.version || j?.ver || j?.v || '');
        if (ver && ver !== currentVersion) {
          setAvailableVersion(ver);
          setShowModal(true);
        }
      } catch (e) {
        // ignore
      }
    }, 60 * 1000); // check every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentVersion]);

  const confirmUpdate = async () => {
    // try to unregister service workers to ensure fresh files are loaded
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          try { await r.unregister(); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore
    }
    // do a hard reload
    window.location.reload();
  };

  const cancelUpdate = () => {
    // dismiss until next check
    setShowModal(false);
  };

  return (
    <StrictMode>
      <App />
      <UpdateModal open={showModal} version={availableVersion} onConfirm={confirmUpdate} onCancel={cancelUpdate} />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(
  <Root />
)

// Keep existing SW message listener but do not auto-reload: instead show modal via interval check.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    try {
      const data = event.data;
      if (data && data.type === 'NEW_VERSION_AVAILABLE') {
        // show a browser confirm as fallback; user may have different UI
        if (window.confirm('Nueva versión disponible. ¿Desea recargar para actualizar?')) {
          window.location.reload();
        }
      }
    } catch (e) {
      // ignore
    }
  });
}
