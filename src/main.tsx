import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Escuchar mensajes desde el service worker para recargar automáticamente
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    try {
      const data = event.data;
      if (data && data.type === 'NEW_VERSION_AVAILABLE') {
        // Forzar recarga para obtener la nueva versión desplegada
        // Nota: recargar automáticamente puede interrumpir acciones en curso.
        window.location.reload();
      }
    } catch (e) {
      // ignorar
    }
  });
}
