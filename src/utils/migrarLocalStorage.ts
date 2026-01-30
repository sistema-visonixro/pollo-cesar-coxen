/**
 * Script de migración: localStorage -> IndexedDB
 * 
 * Este script migra los pagos pendientes del sistema antiguo (localStorage)
 * al nuevo sistema de IndexedDB.
 * 
 * Ejecutar en la consola del navegador (F12) después de cargar el punto de ventas
 */

import {
  guardarPagosLocal,
  obtenerContadorPendientes,
} from "./offlineSync";

/**
 * Migra los pagos pendientes de localStorage a IndexedDB
 */
export async function migrarPagosDesdeLocalStorage(): Promise<void> {
  try {
    console.log("Iniciando migración de localStorage a IndexedDB...");

    // Obtener pagos pendientes del localStorage
    const pendingPaymentsStr = localStorage.getItem("pendingPayments");

    if (!pendingPaymentsStr) {
      console.log("✓ No hay pagos pendientes en localStorage");
      return;
    }

    const pendingPayments = JSON.parse(pendingPaymentsStr);

    if (!Array.isArray(pendingPayments) || pendingPayments.length === 0) {
      console.log("✓ No hay pagos pendientes para migrar");
      // Limpiar localStorage
      localStorage.removeItem("pendingPayments");
      return;
    }

    console.log(`Encontrados ${pendingPayments.length} pagos pendientes`);

    // Guardar cada pago en IndexedDB
    const idsGuardados = await guardarPagosLocal(pendingPayments);

    console.log(
      `✓ ${idsGuardados.length} pagos migrados exitosamente a IndexedDB`
    );

    // Limpiar localStorage después de migración exitosa
    localStorage.removeItem("pendingPayments");
    console.log("✓ localStorage limpiado");

    // Mostrar contador actualizado
    const contador = await obtenerContadorPendientes();
    console.log(
      `📊 Total pendientes: ${contador.facturas} facturas, ${contador.pagos} pagos`
    );

    alert(
      `Migración exitosa: ${idsGuardados.length} pagos migrados a IndexedDB`
    );
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    alert(
      "Error al migrar datos. Por favor, contacte al administrador.\nError: " +
        (error as Error).message
    );
  }
}

/**
 * Función auxiliar para ejecutar la migración manualmente desde la consola
 */
(window as any).migrarPagosDesdeLocalStorage = migrarPagosDesdeLocalStorage;

console.log(
  "💡 Para migrar pagos de localStorage a IndexedDB, ejecuta: migrarPagosDesdeLocalStorage()"
);
