/**
 * Hook personalizado para detectar el estado de conexión a internet
 */

import { useState, useEffect } from 'react';

export function useConexion() {
  const [conectado, setConectado] = useState<boolean>(navigator.onLine);
  const [intentandoReconectar, setIntentandoReconectar] = useState<boolean>(false);

  useEffect(() => {
    function manejarOnline() {
      console.log("✓ Conexión restaurada");
      setConectado(true);
      setIntentandoReconectar(false);
    }

    function manejarOffline() {
      console.warn("⚠ Conexión perdida");
      setConectado(false);
      setIntentandoReconectar(true);
      
      // Intentar verificar conexión cada 5 segundos
      const intervalo = setInterval(() => {
        if (navigator.onLine) {
          clearInterval(intervalo);
          setIntentandoReconectar(false);
        }
      }, 5000);
    }

    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);

    // Verificar estado inicial
    setConectado(navigator.onLine);

    return () => {
      window.removeEventListener('online', manejarOnline);
      window.removeEventListener('offline', manejarOffline);
    };
  }, []);

  return { conectado, intentandoReconectar };
}

/**
 * Verifica si hay conexión a internet (función standalone)
 */
export function verificarConexion(): boolean {
  return navigator.onLine;
}

/**
 * Intenta hacer un ping a Supabase para verificar conexión real
 */
export async function verificarConexionReal(supabaseUrl: string): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    await fetch(supabaseUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
    });
    return true;
  } catch (error) {
    console.error("Error verificando conexión real:", error);
    return false;
  }
}
