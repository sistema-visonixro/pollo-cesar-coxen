/**
 * Sistema de sincronización offline usando IndexedDB
 * Almacena facturas y pagos localmente y los sincroniza con Supabase automáticamente
 */

import { supabase } from "../supabaseClient";

// Nombre de la base de datos
const DB_NAME = "PuntoVentaOfflineDB";
const DB_VERSION = 1;

// Nombres de las tablas (stores)
const FACTURAS_STORE = "facturas_pendientes";
const PAGOS_STORE = "pagos_pendientes";

// Tipos
export interface FacturaPendiente {
  id?: number;
  fecha_hora: string;
  cajero: string;
  cajero_id: string | null;
  caja: string;
  cai: string;
  factura: string;
  cliente: string;
  productos: string;
  sub_total: string;
  isv_15: string;
  isv_18: string;
  total: string;
  timestamp: number;
  intentos: number;
}

export interface PagoPendiente {
  id?: number;
  tipo: string;
  monto: number;
  banco: string | null;
  tarjeta: string | null;
  factura: string | null;
  autorizador: string | null;
  referencia: string | null;
  usd_monto: number | null;
  fecha_hora: string;
  cajero: string;
  cajero_id: string | null;
  cliente: string;
  factura_venta: string;
  recibido: number;
  cambio: number;
  timestamp: number;
  intentos: number;
}

// Variable global para la conexión DB
let db: IDBDatabase | null = null;

/**
 * Inicializa la base de datos IndexedDB
 */
export async function initIndexedDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Error al abrir IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log("IndexedDB inicializada correctamente");
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Crear store para facturas pendientes
      if (!database.objectStoreNames.contains(FACTURAS_STORE)) {
        const facturasStore = database.createObjectStore(FACTURAS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        facturasStore.createIndex("timestamp", "timestamp", { unique: false });
        facturasStore.createIndex("factura", "factura", { unique: false });
        console.log("Store de facturas creado");
      }

      // Crear store para pagos pendientes
      if (!database.objectStoreNames.contains(PAGOS_STORE)) {
        const pagosStore = database.createObjectStore(PAGOS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        pagosStore.createIndex("timestamp", "timestamp", { unique: false });
        pagosStore.createIndex("factura_venta", "factura_venta", {
          unique: false,
        });
        console.log("Store de pagos creado");
      }
    };
  });
}

/**
 * Guarda una factura en IndexedDB
 */
export async function guardarFacturaLocal(
  factura: Omit<FacturaPendiente, "id" | "timestamp" | "intentos">
): Promise<number> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);

    const facturaConMetadata: Omit<FacturaPendiente, "id"> = {
      ...factura,
      timestamp: Date.now(),
      intentos: 0,
    };

    const request = store.add(facturaConMetadata);

    request.onsuccess = () => {
      console.log("Factura guardada en IndexedDB:", request.result);
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error("Error guardando factura en IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Guarda pagos en IndexedDB
 */
export async function guardarPagosLocal(
  pagos: Omit<PagoPendiente, "id" | "timestamp" | "intentos">[]
): Promise<number[]> {
  const database = await initIndexedDB();
  const ids: number[] = [];

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);

    let completados = 0;
    const total = pagos.length;

    pagos.forEach((pago) => {
      const pagoConMetadata: Omit<PagoPendiente, "id"> = {
        ...pago,
        timestamp: Date.now(),
        intentos: 0,
      };

      const request = store.add(pagoConMetadata);

      request.onsuccess = () => {
        ids.push(request.result as number);
        completados++;
        if (completados === total) {
          console.log(`${total} pagos guardados en IndexedDB`);
          resolve(ids);
        }
      };

      request.onerror = () => {
        console.error("Error guardando pago en IndexedDB:", request.error);
        reject(request.error);
      };
    });
  });
}

/**
 * Obtiene todas las facturas pendientes de sincronización
 */
export async function obtenerFacturasPendientes(): Promise<
  FacturaPendiente[]
> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readonly");
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as FacturaPendiente[]);
    };

    request.onerror = () => {
      console.error(
        "Error obteniendo facturas pendientes:",
        request.error
      );
      reject(request.error);
    };
  });
}

/**
 * Obtiene todos los pagos pendientes de sincronización
 */
export async function obtenerPagosPendientes(): Promise<PagoPendiente[]> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readonly");
    const store = transaction.objectStore(PAGOS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as PagoPendiente[]);
    };

    request.onerror = () => {
      console.error("Error obteniendo pagos pendientes:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina una factura de IndexedDB después de sincronizarla
 */
export async function eliminarFacturaLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Factura ${id} eliminada de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando factura de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Elimina un pago de IndexedDB después de sincronizarlo
 */
export async function eliminarPagoLocal(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`Pago ${id} eliminado de IndexedDB`);
      resolve();
    };

    request.onerror = () => {
      console.error("Error eliminando pago de IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Incrementa el contador de intentos de una factura
 */
async function incrementarIntentosFactura(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([FACTURAS_STORE], "readwrite");
    const store = transaction.objectStore(FACTURAS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const factura = getRequest.result as FacturaPendiente;
      if (factura) {
        factura.intentos = (factura.intentos || 0) + 1;
        const updateRequest = store.put(factura);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Incrementa el contador de intentos de un pago
 */
async function incrementarIntentosPago(id: number): Promise<void> {
  const database = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PAGOS_STORE], "readwrite");
    const store = transaction.objectStore(PAGOS_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const pago = getRequest.result as PagoPendiente;
      if (pago) {
        pago.intentos = (pago.intentos || 0) + 1;
        const updateRequest = store.put(pago);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sincroniza las facturas pendientes con Supabase
 */
export async function sincronizarFacturas(): Promise<{
  exitosas: number;
  fallidas: number;
}> {
  const facturasPendientes = await obtenerFacturasPendientes();

  if (facturasPendientes.length === 0) {
    return { exitosas: 0, fallidas: 0 };
  }

  console.log(
    `Sincronizando ${facturasPendientes.length} facturas pendientes...`
  );

  let exitosas = 0;
  let fallidas = 0;

  for (const factura of facturasPendientes) {
    try {
      // Preparar datos para insertar (sin id, timestamp, intentos)
      const { id, timestamp, intentos, ...facturaData } = factura;

      const { error } = await supabase.from("facturas").insert([facturaData]);

      if (error) {
        console.error(`Error sincronizando factura ${factura.factura}:`, error);
        await incrementarIntentosFactura(factura.id!);
        fallidas++;
        
        // Si ha fallado más de 5 veces, notificar
        if (intentos >= 5) {
          console.error(
            `Factura ${factura.factura} ha fallado ${intentos} veces`
          );
        }
      } else {
        console.log(`Factura ${factura.factura} sincronizada exitosamente`);
        await eliminarFacturaLocal(factura.id!);
        exitosas++;
      }
    } catch (error) {
      console.error(`Error sincronizando factura ${factura.factura}:`, error);
      await incrementarIntentosFactura(factura.id!);
      fallidas++;
    }
  }

  return { exitosas, fallidas };
}

/**
 * Sincroniza los pagos pendientes con Supabase
 */
export async function sincronizarPagos(): Promise<{
  exitosos: number;
  fallidos: number;
}> {
  const pagosPendientes = await obtenerPagosPendientes();

  if (pagosPendientes.length === 0) {
    return { exitosos: 0, fallidos: 0 };
  }

  console.log(`Sincronizando ${pagosPendientes.length} pagos pendientes...`);

  let exitosos = 0;
  let fallidos = 0;

  for (const pago of pagosPendientes) {
    try {
      // Preparar datos para insertar (sin id, timestamp, intentos)
      const { id, timestamp, intentos, ...pagoData } = pago;

      const { error } = await supabase.from("pagos").insert([pagoData]);

      if (error) {
        console.error(`Error sincronizando pago ${id}:`, error);
        await incrementarIntentosPago(pago.id!);
        fallidos++;

        // Si ha fallado más de 5 veces, notificar
        if (intentos >= 5) {
          console.error(`Pago ${id} ha fallado ${intentos} veces`);
        }
      } else {
        console.log(`Pago ${id} sincronizado exitosamente`);
        await eliminarPagoLocal(pago.id!);
        exitosos++;
      }
    } catch (error) {
      console.error(`Error sincronizando pago ${pago.id}:`, error);
      await incrementarIntentosPago(pago.id!);
      fallidos++;
    }
  }

  return { exitosos, fallidos };
}

/**
 * Sincroniza todos los datos pendientes (facturas y pagos)
 */
export async function sincronizarTodo(): Promise<{
  facturas: { exitosas: number; fallidas: number };
  pagos: { exitosos: number; fallidos: number };
}> {
  console.log("Iniciando sincronización completa...");

  const facturas = await sincronizarFacturas();
  const pagos = await sincronizarPagos();

  console.log(
    `Sincronización completa: ${facturas.exitosas} facturas y ${pagos.exitosos} pagos sincronizados`
  );

  return { facturas, pagos };
}

/**
 * Obtiene el conteo de registros pendientes
 */
export async function obtenerContadorPendientes(): Promise<{
  facturas: number;
  pagos: number;
}> {
  const facturas = await obtenerFacturasPendientes();
  const pagos = await obtenerPagosPendientes();

  return {
    facturas: facturas.length,
    pagos: pagos.length,
  };
}

/**
 * Configura la sincronización automática cuando se detecta conexión
 */
export function configurarSincronizacionAutomatica(): void {
  // Sincronizar cada 30 segundos si hay conexión
  setInterval(async () => {
    if (navigator.onLine) {
      const pendientes = await obtenerContadorPendientes();
      if (pendientes.facturas > 0 || pendientes.pagos > 0) {
        console.log("Sincronización automática iniciada...");
        await sincronizarTodo();
      }
    }
  }, 30000); // 30 segundos

  // Sincronizar cuando se recupere la conexión
  window.addEventListener("online", async () => {
    console.log("Conexión restaurada. Sincronizando datos pendientes...");
    const resultado = await sincronizarTodo();
    
    const totalSincronizados =
      resultado.facturas.exitosas + resultado.pagos.exitosos;
    
    if (totalSincronizados > 0) {
      console.log(
        `✓ ${resultado.facturas.exitosas} facturas y ${resultado.pagos.exitosos} pagos sincronizados exitosamente`
      );
    }
  });

  // Notificar cuando se pierde la conexión
  window.addEventListener("offline", () => {
    console.warn(
      "⚠ Conexión perdida. Los datos se guardarán localmente y se sincronizarán cuando se restaure la conexión."
    );
  });
}

/**
 * Inicializa el sistema completo de sincronización offline
 */
export async function inicializarSistemaOffline(): Promise<void> {
  try {
    await initIndexedDB();
    configurarSincronizacionAutomatica();
    
    // Intentar sincronizar datos pendientes al iniciar
    if (navigator.onLine) {
      const pendientes = await obtenerContadorPendientes();
      if (pendientes.facturas > 0 || pendientes.pagos > 0) {
        console.log(
          `Hay ${pendientes.facturas} facturas y ${pendientes.pagos} pagos pendientes de sincronización`
        );
        await sincronizarTodo();
      }
    }
    
    console.log("✓ Sistema de sincronización offline inicializado");
  } catch (error) {
    console.error("Error inicializando sistema offline:", error);
  }
}
