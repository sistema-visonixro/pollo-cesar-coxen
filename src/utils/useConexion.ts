/**
 * Hook personalizado para detectar el estado de conexión a internet
 * Usa tanto navigator.onLine como verificación real a Supabase
 */

import { useState, useEffect, useRef } from "react";

// Variable global para cachear el estado de conexión real
let ultimaVerificacionReal = {
  timestamp: 0,
  conectado: true,
};

const CACHE_DURATION = 3000; // 3 segundos de cache

/**
 * Verifica conexión real haciendo ping a un servicio confiable
 */
async function verificarConexionRealConTimeout(): Promise<boolean> {
  // Si no hay navigator.onLine, definitivamente sin internet
  if (!navigator.onLine) {
    console.log("❌ navigator.onLine = false");
    return false;
  }

  // Usar cache reciente para evitar checks excesivos
  const ahora = Date.now();
  if (ahora - ultimaVerificacionReal.timestamp < CACHE_DURATION) {
    console.log(`📦 Usando cache: ${ultimaVerificacionReal.conectado ? "CONECTADO" : "DESCONECTADO"}`);
    return ultimaVerificacionReal.conectado;
  }

  try {
    // Timeout de 4 segundos para la verificación
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Intentar conectar a un endpoint confiable (Google)
    // Usamos mode: 'no-cors' para evitar problemas de CORS
    await fetch("https://www.google.com/favicon.ico", {
      method: "GET",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // Si llegamos aquí sin error, hay conexión
    ultimaVerificacionReal = { timestamp: ahora, conectado: true };
    console.log("✅ Verificación exitosa → CONECTADO");
    return true;
  } catch (error) {
    // Si falla (timeout, network error, etc), asumir sin conexión
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn("⚠️ Error verificando conexión:", errorMsg);
    ultimaVerificacionReal = { timestamp: ahora, conectado: false };
    return false;
  }
}

export function useConexion() {
  const [conectado, setConectado] = useState<boolean>(navigator.onLine);
  const [intentandoReconectar, setIntentandoReconectar] =
    useState<boolean>(false);
  const verificacionIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Verificar conexión real inicialmente
    verificarConexionRealConTimeout().then(setConectado);

    function manejarOnline() {
      console.log("📡 Navigator detectó conexión, verificando...");
      // Verificar conexión real antes de confirmar
      verificarConexionRealConTimeout().then((real) => {
        if (real) {
          console.log("✓ Conexión real confirmada");
          setConectado(true);
          setIntentandoReconectar(false);
        } else {
          console.warn("⚠ Navigator.onLine true pero sin acceso real");
          setConectado(false);
        }
      });
    }

    function manejarOffline() {
      console.warn("⚠ Conexión perdida (navigator.onLine)");
      setConectado(false);
      setIntentandoReconectar(true);
    }

    window.addEventListener("online", manejarOnline);
    window.addEventListener("offline", manejarOffline);

    // Verificar conexión real cada 5 segundos
    verificacionIntervalRef.current = setInterval(() => {
      verificarConexionRealConTimeout().then((real) => {
        if (real !== conectado) {
          console.log(
            `🔄 Estado de conexión cambió: ${real ? "CONECTADO" : "DESCONECTADO"}`,
          );
          setConectado(real);
          setIntentandoReconectar(!real);
        }
      });
    }, 5000);

    return () => {
      window.removeEventListener("online", manejarOnline);
      window.removeEventListener("offline", manejarOffline);
      if (verificacionIntervalRef.current) {
        clearInterval(verificacionIntervalRef.current);
      }
    };
  }, [conectado]);

  return { conectado, intentandoReconectar };
}

/**
 * Verifica si hay conexión a internet (función standalone)
 * MEJORADO: Ya no solo verifica navigator.onLine, también hace check real
 */
export async function estaConectadoReal(): Promise<boolean> {
  return await verificarConexionRealConTimeout();
}

/**
 * Verifica conexión rápidamente (solo navigator.onLine)
 * Usar solo cuando no importa la precisión
 */
export function verificarConexion(): boolean {
  return navigator.onLine;
}

/**
 * Intenta hacer un ping a Supabase para verificar conexión real
 */
export async function verificarConexionReal(
  supabaseUrl: string,
): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    await fetch(supabaseUrl, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}
