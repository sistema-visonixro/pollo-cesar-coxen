import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function Root() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  // Función para aplicar la actualización automáticamente
  const applyUpdate = async () => {
    console.log('🔄 Aplicando actualización automática...');
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
    // Force a full navigation bypassing browser cache by adding a cache-buster query param.
    // This avoids cases where a simple F5 or reload returns a cached index.html.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_cb', String(Date.now()));
      window.location.href = url.toString();
    } catch (e) {
      // fallback
      window.location.reload();
    }
  };

  // comprobar ahora: expuesto a window via evento
  const checkNow = async (): Promise<string | null> => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      const ver = String(j.version || j?.ver || j?.v || '');
      if (!ver) return null;
      if (!currentVersion) {
        // first load wasn't set; set current and do not prompt
        setCurrentVersion(ver);
        return null;
      }
      if (ver && ver !== currentVersion) {
        return ver;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

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
        const ver = await checkNow();
        if (ver) {
          console.log(`✨ Nueva versión detectada: ${ver}. Actualizando automáticamente...`);
          // Aplicar la actualización automáticamente sin pedir confirmación
          await applyUpdate();
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

  // Listen for manual check events from the page
  useEffect(() => {
    const onCheck = async () => {
      const ver = await checkNow();
      if (ver) {
        console.log(`✨ Nueva versión detectada manualmente: ${ver}. Actualizando automáticamente...`);
        await applyUpdate();
        window.dispatchEvent(new CustomEvent('app:check-update-result', { detail: { updated: true, availableVersion: ver } }));
      } else {
        window.dispatchEvent(new CustomEvent('app:check-update-result', { detail: { updated: false } }));
      }
    };
    window.addEventListener('app:check-update', onCheck as EventListener);
    return () => window.removeEventListener('app:check-update', onCheck as EventListener);
  }, [currentVersion]);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(
  <Root />
)

// Auto-update on service worker messages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    try {
      const data = event.data;
      if (data && data.type === 'NEW_VERSION_AVAILABLE') {
        console.log('🔄 Service Worker detectó nueva versión. Recargando automáticamente...');
        // Recargar automáticamente sin pedir confirmación
        window.location.reload();
      }
    } catch (e) {
      // ignore
    }
  });
}
