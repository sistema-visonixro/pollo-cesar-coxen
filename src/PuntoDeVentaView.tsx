import { useEffect, useState } from "react";
import { NOMBRE_NEGOCIO } from "./empresa";
import PagoModal from "./PagoModal";
import RegistroCierreView from "./RegistroCierreView";
import { supabase } from "./supabaseClient";
import { getLocalDayRange, formatToHondurasLocal } from "./utils/fechas";
import { useDatosNegocio } from "./useDatosNegocio";
import {
  inicializarSistemaOffline,
  guardarFacturaLocal,
  guardarPagosLocal,
  guardarGastoLocal,
  guardarEnvioLocal,
  obtenerContadorPendientes,
  sincronizarTodo,
  eliminarFacturaLocal,
  eliminarPagoLocal,
  eliminarGastoLocal,
  eliminarEnvioLocal,
  actualizarCacheProductos,
  obtenerProductosCache,
  guardarProductosCache,
  estaConectado,
  guardarAperturaCache,
  obtenerAperturaCache,
  limpiarAperturaCache,
  guardarCaiCache,
  obtenerCaiCache,
} from "./utils/offlineSync";
import { migrarPagosDesdeLocalStorage } from "./utils/migrarLocalStorage";
import { useConexion } from "./utils/useConexion";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  tipo: "comida" | "bebida" | "complemento";
  tipo_impuesto?: string;
  imagen?: string;
  subcategoria?: string;
}

interface Seleccion {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo: "comida" | "bebida" | "complemento";
  complementos?: string; // "CON TODO", "SIN SALSAS", etc.
  piezas?: string; // "PIEZAS VARIAS", "PECHUGA", "ALA, CADERA", etc.
}

// use centralized supabase client from src/supabaseClient.ts
// use centralized supabase client from src/supabaseClient.ts
// Obtener usuario actual de localStorage
const usuarioActual = (() => {
  try {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
})();

export default function PuntoDeVentaView({
  setView,
}: {
  setView?: (
    view:
      | "home"
      | "puntoDeVenta"
      | "admin"
      | "usuarios"
      | "inventario"
      | "cai"
      | "resultados"
      | "gastos"
      | "facturasEmitidas"
      | "apertura"
      | "resultadosCaja"
      | "cajaOperada",
  ) => void;
}) {
  const [showCierre, setShowCierre] = useState(false);
  const [showResumen, setShowResumen] = useState(false);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenData, setResumenData] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    dolares: number;
    dolares_usd?: number;
    dolares_convertidos?: number;
    tasa_dolar?: number;
    gastos: number;
  } | null>(null);

  // Función para obtener resumen de caja del día (EFECTIVO/TARJETA/TRANSFERENCIA)
  async function fetchResumenCaja() {
    setShowResumen(true);
    setResumenLoading(true);
    try {
      // Buscar la fecha de apertura del día actual para filtrar desde ese momento
      const { end: dayEnd, day } = getLocalDayRange();

      // Obtener caja asignada
      let cajaAsignada = caiInfo?.caja_asignada;
      if (!cajaAsignada) {
        const { data: caiData } = await supabase
          .from("cai_facturas")
          .select("caja_asignada")
          .eq("cajero_id", usuarioActual?.id)
          .single();
        cajaAsignada = caiData?.caja_asignada || "";
      }

      // Buscar la última apertura (estado='APERTURA') sin importar el día
      // Esta será la apertura del turno actual
      const { data: aperturaActual } = await supabase
        .from("cierres")
        .select("fecha, estado")
        .eq("cajero_id", usuarioActual?.id)
        .eq("caja", cajaAsignada)
        .eq("estado", "APERTURA")
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Si no hay apertura registrada, mostrar advertencia y salir
      if (!aperturaActual) {
        setResumenLoading(false);
        alert(
          "No hay apertura de caja registrada. Por favor, registra primero una apertura.",
        );
        setShowResumen(false);
        return;
      }

      // Usar la fecha EXACTA de apertura (con hora, minutos, segundos) como inicio
      const start = aperturaActual.fecha;
      const end = dayEnd;

      console.log("Resumen de caja - Rango:", {
        start,
        end,
        day,
        cajeroId: usuarioActual?.id,
        cajaAsignada,
        usandoFechaApertura: !!aperturaActual,
        fechaApertura: aperturaActual?.fecha,
      });

      const [
        { data: pagosEfectivo, error: errorEfectivo },
        { data: pagosTarjeta, error: errorTarjeta },
        { data: pagosTrans, error: errorTrans },
        { data: pagosDolares, error: errorDolares },
        { data: gastosDia },
      ] = await Promise.all([
        supabase
          .from("pagos")
          .select("monto, tipo, cajero_id, fecha_hora")
          .eq("tipo", "efectivo")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        supabase
          .from("pagos")
          .select("monto, tipo, cajero_id, fecha_hora")
          .eq("tipo", "tarjeta")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        supabase
          .from("pagos")
          .select("monto, tipo, cajero_id, fecha_hora")
          .eq("tipo", "transferencia")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        supabase
          .from("pagos")
          .select("monto, tipo, cajero_id, fecha_hora, usd_monto")
          .eq("tipo", "dolares")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        // Obtener gastos: ahora usa fecha_hora (timestamp) para filtrar desde apertura exacta
        (async () => {
          if (!cajaAsignada) return Promise.resolve({ data: [] });
          return supabase
            .from("gastos")
            .select("monto")
            .gte("fecha_hora", start)
            .lte("fecha_hora", end)
            .eq("cajero_id", usuarioActual?.id)
            .eq("caja", cajaAsignada);
        })(),
      ]);

      console.log("Resultados consultas:", {
        efectivo: {
          data: pagosEfectivo,
          error: errorEfectivo,
          count: pagosEfectivo?.length,
        },
        tarjeta: {
          data: pagosTarjeta,
          error: errorTarjeta,
          count: pagosTarjeta?.length,
        },
        transferencia: {
          data: pagosTrans,
          error: errorTrans,
          count: pagosTrans?.length,
        },
        dolares: {
          data: pagosDolares,
          error: errorDolares,
          count: pagosDolares?.length,
        },
      });

      const efectivoSum = (pagosEfectivo || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const tarjetaSum = (pagosTarjeta || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const transSum = (pagosTrans || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );
      const dolaresSum = (pagosDolares || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0,
      );

      const dolaresSumUsd = (pagosDolares || []).reduce(
        (s: number, p: any) => s + parseFloat(p.usd_monto || 0),
        0,
      );

      // obtener tasa del dolar (singleton)
      let tasa = 0;
      try {
        const { data: tasaData } = await supabase
          .from("precio_dolar")
          .select("valor")
          .eq("id", "singleton")
          .limit(1)
          .single();
        if (tasaData && typeof tasaData.valor !== "undefined") {
          tasa = Number(tasaData.valor) || 0;
        }
      } catch (e) {
        console.warn("No se pudo obtener tasa de precio_dolar:", e);
      }

      const dolaresConvertidos = Number((dolaresSumUsd * tasa).toFixed(2));

      const gastosSum = (gastosDia || []).reduce(
        (s: number, g: any) => s + parseFloat(g.monto || 0),
        0,
      );

      console.log("Sumas calculadas:", {
        efectivo: efectivoSum,
        tarjeta: tarjetaSum,
        transferencia: transSum,
        dolares: dolaresSum,
        gastos: gastosSum,
      });

      setResumenData({
        efectivo: efectivoSum,
        tarjeta: tarjetaSum,
        transferencia: transSum,
        dolares: dolaresSum,
        dolares_usd: dolaresSumUsd,
        dolares_convertidos: dolaresConvertidos,
        tasa_dolar: tasa,
        gastos: gastosSum,
      });
    } catch (err) {
      console.error("Error al obtener resumen de caja:", err);
      setResumenData({
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        dolares: 0,
        gastos: 0,
      });
    } finally {
      setResumenLoading(false);
    }
  }
  const [theme, setTheme] = useState<"lite" | "dark">(() => {
    try {
      const stored = localStorage.getItem("theme");
      return stored === "dark" ? "dark" : "lite";
    } catch {
      return "lite";
    }
  });

  const [showCerrarSesionModal, setShowCerrarSesionModal] = useState(false);

  // Estado para sincronización offline
  const { conectado: isOnline } = useConexion();
  const [pendientesCount, setPendientesCount] = useState({
    facturas: 0,
    pagos: 0,
    gastos: 0,
    envios: 0,
  });
  const [sincronizando, setSincronizando] = useState(false);

  // Cargar datos del negocio
  const { datos: datosNegocio } = useDatosNegocio();

  const [facturaActual, setFacturaActual] = useState<string>("");
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [tasaCambio, setTasaCambio] = useState<number>(25.0); // Tasa de cambio HNL/USD
  const [showClienteModal, setShowClienteModal] = useState(false);
  // Modal para envíos de pedido
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [envioCliente, setEnvioCliente] = useState("");
  const [envioCelular, setEnvioCelular] = useState("");
  const [envioTipoPago, setEnvioTipoPago] = useState<
    "Efectivo" | "Tarjeta" | "Transferencia"
  >("Efectivo");
  const [envioCosto, setEnvioCosto] = useState<string>("0");
  const [savingEnvio, setSavingEnvio] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastEnvioSaved, setLastEnvioSaved] = useState<any>(null);
  const [showNoConnectionModal, setShowNoConnectionModal] = useState(false);

  useEffect(() => {
    if (!showPagoModal) return;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("precio_dolar")
          .select("valor")
          .eq("id", "singleton")
          .limit(1)
          .single();
        if (!mounted) return;
        if (data && typeof data.valor !== "undefined") {
          setTasaCambio(Number(data.valor));
        }
      } catch (e) {
        console.warn("No se pudo cargar tasa de cambio:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showPagoModal]);
  // Modal para registrar gasto
  const [showRegistrarGasto, setShowRegistrarGasto] = useState(false);
  // Modal para listar pedidos del cajero
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [pedidosList, setPedidosList] = useState<any[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosProcessingId, setPedidosProcessingId] = useState<number | null>(
    null,
  );
  const [gastoMonto, setGastoMonto] = useState<string>("");
  const [gastoMotivo, setGastoMotivo] = useState<string>("");
  const [gastoFactura, setGastoFactura] = useState<string>("");
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  // Helper para cerrar y resetear el formulario de gasto
  const cerrarRegistrarGasto = () => {
    setShowRegistrarGasto(false);
    setGastoMonto("");
    setGastoMotivo("");
    setGastoFactura("");
  };
  const [showGastoSuccess, setShowGastoSuccess] = useState(false);

  // Inicializar sistema de sincronización offline
  useEffect(() => {
    // Inicializar IndexedDB
    inicializarSistemaOffline();

    // Migrar datos antiguos de localStorage si existen
    migrarPagosDesdeLocalStorage().catch((error) => {
      console.error("Error en migración de localStorage:", error);
    });

    // Actualizar contador de pendientes cada 10 segundos
    const interval = setInterval(async () => {
      const count = await obtenerContadorPendientes();
      setPendientesCount(count);
    }, 10000);

    // Obtener contador inicial
    obtenerContadorPendientes().then(setPendientesCount);

    // Listener para Ctrl+0 para actualizar cache de productos
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        console.log("Actualizando cache de productos...");

        if (!estaConectado()) {
          alert(
            "⚠ No hay conexión a internet. No se puede actualizar el cache de productos.",
          );
          return;
        }

        try {
          const resultado = await actualizarCacheProductos();
          if (resultado.exitoso) {
            alert(`✓ Cache actualizado: ${resultado.cantidad} productos`);
            // Recargar productos en la interfaz
            await cargarProductos();
          } else {
            alert(`❌ Error al actualizar cache: ${resultado.mensaje}`);
          }
        } catch (error) {
          console.error("Error actualizando cache:", error);
          alert("❌ Error al actualizar cache de productos");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Función para sincronizar manualmente
  const sincronizarManualmente = async () => {
    if (!isOnline) {
      alert("No hay conexión a internet");
      return;
    }

    setSincronizando(true);
    try {
      const resultado = await sincronizarTodo();
      const total =
        resultado.facturas.exitosas +
        resultado.pagos.exitosos +
        resultado.gastos.exitosos +
        resultado.envios.exitosos;

      if (total > 0) {
        alert(
          `✓ Sincronización exitosa:\n` +
            `${resultado.facturas.exitosas} facturas\n` +
            `${resultado.pagos.exitosos} pagos\n` +
            `${resultado.gastos.exitosos} gastos\n` +
            `${resultado.envios.exitosos} envíos`,
        );
      } else {
        alert("No hay registros pendientes por sincronizar");
      }

      // Actualizar contador
      const count = await obtenerContadorPendientes();
      setPendientesCount(count);
    } catch (error) {
      console.error("Error en sincronización manual:", error);
      alert("Error al sincronizar. Inténtalo de nuevo.");
    } finally {
      setSincronizando(false);
    }
  };
  const [gastoSuccessMessage, setGastoSuccessMessage] = useState<string>("");
  // Estados para modal de devolución
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);
  const [devolucionFactura, setDevolucionFactura] = useState<string>("");
  const [devolucionData, setDevolucionData] = useState<any>(null);
  const [devolucionBuscando, setDevolucionBuscando] = useState(false);
  const [devolucionPassword, setDevolucionPassword] = useState<string>("");
  const [devolucionProcesando, setDevolucionProcesando] = useState(false);
  const [showDevolucionPasswordModal, setShowDevolucionPasswordModal] =
    useState(false);
  const [showDevolucionError, setShowDevolucionError] = useState(false);
  const [showDevolucionSuccess, setShowDevolucionSuccess] = useState(false);
  // Eliminado showFacturaModal
  const [nombreCliente, setNombreCliente] = useState("");
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [tipoOrden, setTipoOrden] = useState<"PARA LLEVAR" | "COMER AQUÍ">(
    "PARA LLEVAR",
  );
  const [showComplementosModal, setShowComplementosModal] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<
    number | null
  >(null);
  const [showPiezasModal, setShowPiezasModal] = useState(false);
  const [caiInfo, setCaiInfo] = useState<{
    caja_asignada: string;
    nombre_cajero: string;
    cai: string;
  } | null>(null);
  // QZ Tray removed: no states for qz/printer connection

  const [productos, setProductos] = useState<Producto[]>([]);
  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);
  // Cargar seleccionados desde localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem("seleccionados");
    if (stored) {
      try {
        setSeleccionados(JSON.parse(stored));
      } catch {}
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "comida" | "bebida" | "complemento"
  >("comida");
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<string | null>(
    null,
  );

  // Estados para control de apertura
  const [aperturaRegistrada, setAperturaRegistrada] = useState<boolean | null>(
    null,
  );
  const [verificandoApertura, setVerificandoApertura] = useState(false);
  const [registrandoApertura, setRegistrandoApertura] = useState(false);

  // Estado para contador de cierres sin aclarar
  const [cierresSinAclarar, setCierresSinAclarar] = useState<number>(0);

  // Obtener datos de CAI y factura actual
  useEffect(() => {
    async function fetchCaiYFactura() {
      if (!usuarioActual) return;

      try {
        // Si hay conexión, obtener de Supabase
        if (isOnline) {
          const { data: caiData, error: caiError } = await supabase
            .from("cai_facturas")
            .select("*")
            .eq("cajero_id", usuarioActual.id)
            .single();

          // Si hay error de conexión, ir directo a cache
          if (caiError) {
            console.log("⚠ Error obteniendo CAI de Supabase:", caiError);
            throw new Error(caiError.message || "Error de conexión");
          }

          if (caiData) {
            setCaiInfo({
              caja_asignada: caiData.caja_asignada,
              nombre_cajero: usuarioActual.nombre,
              cai: caiData.cai,
            });

            // Guardar en cache para uso offline
            await guardarCaiCache({
              id: caiData.id.toString(),
              cajero_id: caiData.cajero_id,
              caja_asignada: caiData.caja_asignada,
              cai: caiData.cai,
              factura_desde: caiData.rango_desde,
              factura_hasta: caiData.rango_hasta,
              factura_actual: caiData.factura_actual || "",
              nombre_cajero: usuarioActual.nombre,
            });

            const rango_inicio = parseInt(caiData.rango_desde);
            const rango_fin = parseInt(caiData.rango_hasta);

            // Si existe factura_actual en el CAI, usarla directamente
            if (
              caiData.factura_actual &&
              caiData.factura_actual.trim() !== ""
            ) {
              const facturaActualNum = parseInt(caiData.factura_actual);
              if (Number.isFinite(facturaActualNum)) {
                if (facturaActualNum > rango_fin) {
                  setFacturaActual("Límite alcanzado");
                } else {
                  setFacturaActual(facturaActualNum.toString());
                }
                return;
              }
            }

            // Si no existe factura_actual, calcular desde las facturas (método antiguo)
            const caja = caiData.caja_asignada;
            const { data: facturasData, error: facturasError } = await supabase
              .from("facturas")
              .select("factura")
              .eq("cajero", usuarioActual.nombre)
              .eq("caja", caja);
            
            // Si hay error, usar rango_desde como fallback
            if (facturasError) {
              console.log("⚠ Error obteniendo facturas, usando rango_desde");
              setFacturaActual(caiData.rango_desde);
              return;
            }
            
            let maxFactura = rango_inicio - 1;
            if (facturasData && facturasData.length > 0) {
              for (const f of facturasData) {
                const num = parseInt(f.factura);
                if (Number.isFinite(num) && num > maxFactura) {
                  maxFactura = num;
                }
              }
              if (!Number.isFinite(maxFactura)) {
                setFacturaActual(rango_inicio.toString());
              } else if (maxFactura + 1 > rango_fin) {
                setFacturaActual("Límite alcanzado");
              } else {
                setFacturaActual((maxFactura + 1).toString());
              }
            } else {
              setFacturaActual(rango_inicio.toString());
            }
          } else {
            setFacturaActual("");
          }
        } else {
          // Si no hay conexión, intentar cargar desde cache
          console.log("⚠ Sin conexión. Cargando CAI desde cache...");
          const caiCache = await obtenerCaiCache();

          if (caiCache) {
            console.log("✓ CAI encontrado en cache");
            setCaiInfo({
              caja_asignada: caiCache.caja_asignada,
              nombre_cajero: caiCache.nombre_cajero,
              cai: caiCache.cai,
            });

            // Usar factura_actual del cache
            if (
              caiCache.factura_actual &&
              caiCache.factura_actual.trim() !== ""
            ) {
              const facturaActualNum = parseInt(caiCache.factura_actual);
              const rango_fin = parseInt(caiCache.factura_hasta);
              if (Number.isFinite(facturaActualNum)) {
                if (facturaActualNum > rango_fin) {
                  setFacturaActual("Límite alcanzado");
                } else {
                  setFacturaActual(facturaActualNum.toString());
                }
              }
            } else {
              // Usar rango desde
              setFacturaActual(caiCache.factura_desde);
            }
          } else {
            console.warn("⚠ No hay CAI en cache");
            setFacturaActual("");
          }
        }
      } catch (error: any) {
        console.error("Error cargando CAI:", error);
        console.log("🔍 DEBUG CAI - Tipo de error:", typeof error);
        console.log("🔍 DEBUG CAI - error.message:", error?.message);
        console.log("🔍 DEBUG CAI - error.details:", error?.details);
        
        // SIEMPRE intentar desde cache cuando hay error
        console.log("🔄 Intentando recuperar CAI desde cache (fallback)...");
        try {
          const caiCache = await obtenerCaiCache();
          if (caiCache) {
            console.log("✓ CAI recuperado desde cache:", caiCache);
            setCaiInfo({
              caja_asignada: caiCache.caja_asignada,
              nombre_cajero: caiCache.nombre_cajero,
              cai: caiCache.cai,
            });
            setFacturaActual(
              caiCache.factura_actual || caiCache.factura_desde,
            );
          } else {
            console.warn("⚠ No hay CAI en cache para fallback");
          }
        } catch (cacheErr) {
          console.error("Error cargando CAI desde cache:", cacheErr);
        }
      }
    }
    fetchCaiYFactura();
  }, [usuarioActual, isOnline]);

  // Verificar si existe apertura registrada del día
  useEffect(() => {
    async function verificarApertura() {
      if (!usuarioActual) {
        setAperturaRegistrada(false);
        return;
      }
      setVerificandoApertura(true);
      try {
        const { start, end } = getLocalDayRange();

        // Si hay conexión, verificar en Supabase
        if (isOnline) {
          // Obtener caja asignada
          let cajaAsignada = caiInfo?.caja_asignada;
          if (!cajaAsignada) {
            const { data: caiData, error: caiError } = await supabase
              .from("cai_facturas")
              .select("caja_asignada")
              .eq("cajero_id", usuarioActual.id)
              .single();
            
            // Si hay error de conexión, ir directo a cache
            if (caiError) {
              console.log("⚠ Error obteniendo caja asignada:", caiError);
              throw new Error(caiError.message || "Error de conexión");
            }
            
            cajaAsignada = caiData?.caja_asignada || "";
          }
          if (!cajaAsignada) {
            setAperturaRegistrada(false);
            setVerificandoApertura(false);
            return;
          }

          // Verificar si existe una apertura ACTIVA (estado='APERTURA') en el día
          const { data: aperturasHoy, error: aperturasError } = await supabase
            .from("cierres")
            .select("id, estado, cajero_id, caja, fecha")
            .eq("cajero_id", usuarioActual.id)
            .eq("caja", cajaAsignada)
            .eq("estado", "APERTURA")
            .gte("fecha", start)
            .lte("fecha", end);
          
          // Si hay error de conexión, ir directo a cache
          if (aperturasError) {
            console.log("⚠ Error obteniendo aperturas:", aperturasError);
            throw new Error(aperturasError.message || "Error de conexión");
          }

          if (aperturasHoy && aperturasHoy.length > 0) {
            const apertura = aperturasHoy[0];
            console.log("✓ Apertura encontrada en Supabase:", apertura);
            setAperturaRegistrada(true);

            // Guardar en cache para uso offline
            await guardarAperturaCache({
              id: apertura.id.toString(),
              cajero_id: apertura.cajero_id,
              caja: apertura.caja,
              fecha: apertura.fecha,
              estado: apertura.estado,
            });
            console.log("✓ Apertura guardada en cache");
          } else {
            console.log("⚠ No hay apertura en Supabase");
            setAperturaRegistrada(false);
            // Limpiar cache si no hay apertura
            await limpiarAperturaCache();
          }
        } else {
          // Si no hay conexión, intentar cargar desde cache
          console.log("⚠ Sin conexión. Verificando apertura desde cache...");
          const aperturaCache = await obtenerAperturaCache();

          if (aperturaCache) {
            console.log("✓ Apertura encontrada en cache:", aperturaCache);
            // Verificar que sea del día actual
            const fechaCache = aperturaCache.fecha;
            console.log(
              `Comparando fecha cache: ${fechaCache} con rango: ${start} - ${end}`,
            );
            
            // Convertir a Date objects para comparación correcta
            const fechaCacheDate = new Date(fechaCache);
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            if (fechaCacheDate >= startDate && fechaCacheDate <= endDate) {
              console.log("✓ Apertura del día actual confirmada");
              setAperturaRegistrada(true);
            } else {
              console.log("⚠ Apertura en cache es de otro día");
              setAperturaRegistrada(false);
            }
          } else {
            console.warn("⚠ No hay apertura en cache");
            setAperturaRegistrada(false);
          }
        }
      } catch (err: any) {
        console.error("Error verificando apertura:", err);
        console.log("🔍 DEBUG - Tipo de error:", typeof err);
        console.log("🔍 DEBUG - err.message:", err?.message);
        console.log("🔍 DEBUG - err.details:", err?.details);
        console.log("🔍 DEBUG - isOnline:", isOnline);
        
        // SIEMPRE intentar desde cache cuando hay error
        console.log("🔄 Intentando recuperar apertura desde cache (fallback)...");
        try {
          const { start, end } = getLocalDayRange();
          const aperturaCache = await obtenerAperturaCache();
          
          if (aperturaCache) {
            console.log("✓ Apertura encontrada en cache:", aperturaCache);
            // Verificar que sea del día actual
            const fechaCache = aperturaCache.fecha;
            console.log(
              `Comparando fecha cache: ${fechaCache} con rango: ${start} - ${end}`,
            );
            
            // Convertir a Date objects para comparación correcta
            const fechaCacheDate = new Date(fechaCache);
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            if (fechaCacheDate >= startDate && fechaCacheDate <= endDate) {
              console.log("✓ Apertura del día actual confirmada (fallback)");
              setAperturaRegistrada(true);
            } else {
              console.log("⚠ Apertura en cache es de otro día");
              setAperturaRegistrada(false);
            }
          } else {
            console.warn("⚠ No hay apertura en cache");
            setAperturaRegistrada(false);
          }
        } catch (cacheErr) {
          console.error("Error verificando cache:", cacheErr);
          setAperturaRegistrada(false);
        }
      } finally {
        setVerificandoApertura(false);
      }
    }
    verificarApertura();
  }, [usuarioActual, caiInfo, isOnline]);

  // Contar cierres sin aclarar del mes actual
  useEffect(() => {
    async function contarCierresSinAclarar() {
      if (!usuarioActual) {
        setCierresSinAclarar(0);
        return;
      }
      try {
        // Obtener primer y último día del mes actual
        const ahora = new Date();
        const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const ultimoDiaMes = new Date(
          ahora.getFullYear(),
          ahora.getMonth() + 1,
          0,
          23,
          59,
          59,
        );

        const fechaInicio = primerDiaMes.toISOString();
        const fechaFin = ultimoDiaMes.toISOString();

        // Contar cierres del cajero actual en el mes que NO tengan observación "aclarado"
        const { data, error } = await supabase
          .from("cierres")
          .select("id, observacion, estado")
          .eq("cajero_id", usuarioActual.id)
          .eq("tipo_registro", "cierre")
          .eq("estado", "CIERRE")
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin);

        if (!error && data) {
          console.log("🔍 DEBUG - Todos los cierres del mes:", data);

          // Filtrar manualmente los que NO tienen observación "aclarado"
          const sinAclarar = data.filter((cierre) => {
            const obs = (cierre.observacion || "")
              .toString()
              .toLowerCase()
              .trim();
            const noAclarado = obs !== "aclarado";
            return noAclarado;
          });

          console.log("📝 DEBUG - Cierres sin aclarar:", sinAclarar);
          setCierresSinAclarar(sinAclarar.length);
        } else {
          console.error("❌ Error obteniendo cierres:", error);
          setCierresSinAclarar(0);
        }
      } catch (err) {
        console.error("Error contando cierres sin aclarar:", err);
        setCierresSinAclarar(0);
      }
    }
    contarCierresSinAclarar();
  }, [usuarioActual]);

  // Redirección automática desactivada - el usuario puede navegar libremente
  // La lógica de verificación de cierres solo se ejecuta desde el callback onCierreGuardado

  // Los modales se deben renderizar dentro del return principal

  // Función para cargar productos (desde Supabase o cache)
  const cargarProductos = async () => {
    setLoading(true);
    try {
      // Si está offline, cargar directamente desde cache
      if (!isOnline) {
        console.log("⚠ Sin conexión. Cargando productos desde cache...");
        const productosCache = await obtenerProductosCache();
        if (productosCache.length > 0) {
          console.log(
            `✓ ${productosCache.length} productos cargados desde cache`,
          );
          setProductos(productosCache as any);
          setError("");
        } else {
          console.warn("⚠ No hay productos en cache");
          setError("No hay productos en cache. Conecta a internet.");
        }
        setLoading(false);
        return;
      }

      // Si está online, cargar desde Supabase
      const { data, error } = await supabase.from("productos").select("*");
      if (error) throw error;
      setProductos(data);

      // Guardar automáticamente en cache para uso offline
      await guardarProductosCache(data);
      console.log(`✓ ${data.length} productos guardados en cache`);

      setError("");
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar productos desde Supabase:", err);
      // Intentar cargar desde cache si falla
      try {
        const productosCache = await obtenerProductosCache();
        if (productosCache.length > 0) {
          console.log(
            `✓ ${productosCache.length} productos cargados desde cache (fallback)`,
          );
          setProductos(productosCache as any);
          setError("");
        } else {
          setError("Error al cargar productos");
        }
      } catch (cacheErr) {
        console.error("Error al cargar productos desde cache:", cacheErr);
        setError("Error al cargar productos");
      }
      setLoading(false);
    }
  };

  // Fetch products from Supabase
  useEffect(() => {
    cargarProductos();
  }, [isOnline]);

  // Bloquear scroll global al montar
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // No-op: QZ Tray integration removed.

  // Add product to selection
  const agregarProducto = (producto: Producto) => {
    setSeleccionados((prev) => {
      const existe = prev.find((p) => p.id === producto.id);
      let nuevos;
      if (existe) {
        nuevos = prev.map((p) =>
          p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p,
        );
      } else {
        nuevos = [
          ...prev,
          {
            ...producto,
            cantidad: 1,
            tipo: producto.tipo,
            complementos: "CON TODO",
            piezas: "PIEZAS VARIAS",
          },
        ];
      }
      localStorage.setItem("seleccionados", JSON.stringify(nuevos));
      return nuevos;
    });
  };

  // función de prueba temporal eliminada

  // Remove product from selection
  const eliminarProducto = (id: string) => {
    setSeleccionados((prev) => {
      const existe = prev.find((p) => p.id === id);
      if (existe && existe.cantidad > 1) {
        const nuevos = prev.map((p) =>
          p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p,
        );
        localStorage.setItem("seleccionados", JSON.stringify(nuevos));
        return nuevos;
      }
      const nuevos = prev.filter((p) => p.id !== id);
      localStorage.setItem("seleccionados", JSON.stringify(nuevos));
      return nuevos;
    });
  };

  // Clear all selected products
  const limpiarSeleccion = () => {
    setSeleccionados([]);
    localStorage.removeItem("seleccionados");
  };

  // Guardar gasto en la tabla 'gastos'
  const guardarGasto = async () => {
    // Validaciones básicas
    const montoNum = parseFloat(gastoMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert("Ingrese un monto válido mayor que 0");
      return;
    }
    if (!gastoMotivo.trim()) {
      alert("Ingrese el motivo del gasto");
      return;
    }
    setGuardandoGasto(true);
    try {
      // Usar la fecha local (YYYY-MM-DD) para evitar conversión a UTC
      const { day: fecha } = getLocalDayRange(); // devuelve 'YYYY-MM-DD' en hora local
      // Concatenar motivo y número de factura en la columna 'motivo'
      const motivoCompleto =
        gastoMotivo.trim() +
        (gastoFactura ? ` | Factura: ${gastoFactura.trim()}` : "");
      // Determinar caja asignada (usar caiInfo o consultar si es necesario)
      let cajaAsignada = caiInfo?.caja_asignada;
      if (!cajaAsignada) {
        const { data: caiData } = await supabase
          .from("cai_facturas")
          .select("caja_asignada")
          .eq("cajero_id", usuarioActual?.id)
          .single();
        cajaAsignada = caiData?.caja_asignada || "";
      }

      // Obtener timestamp actual en formato ISO para fecha_hora
      const fechaHora = formatToHondurasLocal(new Date());

      const gastoData = {
        tipo: motivoCompleto, // Guardar en 'tipo' para compatibilidad
        monto: montoNum,
        descripcion: motivoCompleto, // También en descripción
        cajero: usuarioActual?.nombre || "",
        cajero_id: usuarioActual?.id || null,
        caja: cajaAsignada || "",
        fecha_hora: fechaHora,
      };

      // PASO 1: Guardar primero en IndexedDB
      const gastoIdLocal = await guardarGastoLocal(gastoData);
      console.log(`✓ Gasto guardado en IndexedDB (ID: ${gastoIdLocal})`);

      // PASO 2: Intentar guardar en Supabase
      try {
        const { error } = await supabase.from("gastos").insert([
          {
            fecha,
            fecha_hora: fechaHora,
            monto: montoNum,
            motivo: motivoCompleto,
            cajero_id: usuarioActual?.id,
            caja: cajaAsignada,
          },
        ]);

        if (error) {
          console.error("Error guardando gasto en Supabase:", error);
          console.log("⚠ Gasto guardado localmente, se sincronizará después");
        } else {
          // Si se guardó exitosamente en Supabase, eliminar de IndexedDB
          await eliminarGastoLocal(gastoIdLocal);
          console.log("✓ Gasto sincronizado y eliminado de IndexedDB");
        }
      } catch (supabaseErr) {
        console.error("Error de conexión con Supabase:", supabaseErr);
        console.log(
          "⚠ Gasto guardado localmente, se sincronizará cuando haya conexión",
        );
      }

      // Actualizar contador de pendientes
      const count = await obtenerContadorPendientes();
      setPendientesCount(count);

      // éxito: cerrar y resetear modal de formulario y mostrar modal de éxito
      cerrarRegistrarGasto();
      setGastoSuccessMessage("Gasto registrado correctamente");
      setShowGastoSuccess(true);
    } catch (err) {
      console.error("Error guardando gasto:", err);
      alert("Error al guardar gasto. Revisa la consola.");
    } finally {
      setGuardandoGasto(false);
    }
  };

  // Función para buscar factura para devolución
  const buscarFacturaDevolucion = async () => {
    if (!devolucionFactura.trim()) {
      alert("Ingrese el número de factura");
      return;
    }
    setDevolucionBuscando(true);
    try {
      const { data: factura, error: facturaError } = await supabase
        .from("facturas")
        .select("*")
        .eq("factura", devolucionFactura.trim())
        .eq("cajero_id", usuarioActual?.id)
        .single();

      if (facturaError || !factura) {
        setShowDevolucionError(true);
        setDevolucionData(null);
        return;
      }

      // Verificar si ya existe una devolución para esta factura
      const { data: devolucionExistente } = await supabase
        .from("facturas")
        .select("id")
        .eq("factura", devolucionFactura.trim())
        .eq("cajero_id", usuarioActual?.id)
        .like("cliente", "%(DEVOLUCIÓN)%")
        .limit(1);

      if (devolucionExistente && devolucionExistente.length > 0) {
        alert("Esta factura ya tiene una devolución registrada");
        setDevolucionData(null);
        setDevolucionBuscando(false);
        return;
      }

      // Buscar los pagos asociados a esta factura
      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select("*")
        .eq("factura_venta", devolucionFactura.trim())
        .eq("cajero_id", usuarioActual?.id);

      if (pagosError) {
        console.error("Error buscando pagos:", pagosError);
      }

      setDevolucionData({ factura, pagos: pagos || [] });
    } catch (err) {
      console.error("Error buscando factura:", err);
      alert("Error al buscar factura");
      setDevolucionData(null);
    } finally {
      setDevolucionBuscando(false);
    }
  };

  // Función para procesar la devolución
  const procesarDevolucion = async () => {
    if (!devolucionData) return;

    setDevolucionProcesando(true);
    try {
      const { factura, pagos } = devolucionData;
      const fechaHoraActual = formatToHondurasLocal();

      // 1. Insertar factura con montos negativos
      const facturaDevolucion = {
        fecha_hora: fechaHoraActual,
        cajero: usuarioActual?.nombre || "",
        cajero_id: usuarioActual?.id || null,
        caja: caiInfo?.caja_asignada || "",
        cai: factura.cai || "",
        factura: factura.factura,
        cliente: factura.cliente + " (DEVOLUCIÓN)",
        productos: factura.productos,
        sub_total: (-parseFloat(factura.sub_total || 0)).toFixed(2),
        isv_15: (-parseFloat(factura.isv_15 || 0)).toFixed(2),
        isv_18: (-parseFloat(factura.isv_18 || 0)).toFixed(2),
        total: (-parseFloat(factura.total || 0)).toFixed(2),
      };

      const { error: facturaError } = await supabase
        .from("facturas")
        .insert([facturaDevolucion]);

      if (facturaError) {
        console.error("Error insertando factura de devolución:", facturaError);
        alert(
          "Error al registrar la devolución en facturas: " +
            facturaError.message,
        );
        return;
      }

      // 2. Insertar pagos con montos invertidos
      const pagosDevolucion = pagos.map((pago: any) => {
        // Si el pago es CAMBIO (tiene referencia "CAMBIO"), invertir el signo
        const esCambio = pago.referencia === "CAMBIO";
        const montoOriginal = parseFloat(pago.monto || 0);
        const montoDevolucion = esCambio
          ? Math.abs(montoOriginal)
          : -Math.abs(montoOriginal);

        return {
          tipo: pago.tipo,
          monto: montoDevolucion,
          banco: pago.banco || null,
          tarjeta: pago.tarjeta || null,
          factura: pago.factura || null,
          autorizador: pago.autorizador || null,
          referencia: esCambio ? "RECUPERACIÓN CAMBIO" : "DEVOLUCIÓN",
          usd_monto: pago.usd_monto ? -parseFloat(pago.usd_monto) : null,
          fecha_hora: fechaHoraActual,
          cajero: usuarioActual?.nombre || "",
          cajero_id: usuarioActual?.id || null,
          cliente: factura.cliente + " (DEVOLUCIÓN)",
          factura_venta: factura.factura,
          recibido: pago.recibido ? -parseFloat(pago.recibido) : null,
          cambio: pago.cambio ? -parseFloat(pago.cambio) : null,
        };
      });

      const { error: pagosError } = await supabase
        .from("pagos")
        .insert(pagosDevolucion);

      if (pagosError) {
        console.error("Error insertando pagos de devolución:", pagosError);
        alert(
          "Error al registrar los pagos de devolución: " + pagosError.message,
        );
        return;
      }

      // Éxito
      setShowDevolucionPasswordModal(false);
      setShowDevolucionModal(false);
      setShowDevolucionSuccess(true);
      setDevolucionFactura("");
      setDevolucionData(null);
      setDevolucionPassword("");
    } catch (err) {
      console.error("Error procesando devolución:", err);
      alert("Error al procesar la devolución");
    } finally {
      setDevolucionProcesando(false);
    }
  };

  // Función para validar contraseña del cajero desde la base de datos
  const validarPasswordCajero = async (password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("clave")
        .eq("id", usuarioActual?.id)
        .single();

      if (error || !data) {
        console.error("Error validando contraseña:", error);
        return false;
      }

      return data.clave === password;
    } catch (err) {
      console.error("Error en validarPasswordCajero:", err);
      return false;
    }
  };

  // Función para registrar apertura con fondo inicial en 0
  const registrarAperturaRapida = async () => {
    if (!usuarioActual) return;
    setRegistrandoApertura(true);
    try {
      // Obtener caja asignada
      let cajaAsignada = caiInfo?.caja_asignada;
      if (!cajaAsignada) {
        const { data: caiData } = await supabase
          .from("cai_facturas")
          .select("caja_asignada")
          .eq("cajero_id", usuarioActual.id)
          .single();
        cajaAsignada = caiData?.caja_asignada || "";
      }
      if (!cajaAsignada) {
        alert("No tienes caja asignada. Contacta al administrador.");
        setRegistrandoApertura(false);
        return;
      }

      // Registrar apertura con estado='APERTURA' y fondo inicial en 0
      const fechaApertura = formatToHondurasLocal();
      const { data: aperturaInsertada, error } = await supabase
        .from("cierres")
        .insert([
          {
            tipo_registro: "apertura",
            cajero: usuarioActual?.nombre,
            cajero_id: usuarioActual?.id,
            caja: cajaAsignada,
            fecha: fechaApertura,
            fondo_fijo_registrado: 0,
            fondo_fijo: 0,
            efectivo_registrado: 0,
            efectivo_dia: 0,
            monto_tarjeta_registrado: 0,
            monto_tarjeta_dia: 0,
            transferencias_registradas: 0,
            transferencias_dia: 0,
            dolares_registrado: 0,
            dolares_dia: 0,
            diferencia: 0,
            estado: "APERTURA",
          },
        ])
        .select();

      if (error) {
        console.error("Error registrando apertura:", error);
        alert("Error al registrar apertura: " + error.message);
      } else {
        setAperturaRegistrada(true);

        // Guardar en cache para uso offline
        if (aperturaInsertada && aperturaInsertada.length > 0) {
          const apertura = aperturaInsertada[0];
          await guardarAperturaCache({
            id: apertura.id.toString(),
            cajero_id: apertura.cajero_id,
            caja: apertura.caja,
            fecha: apertura.fecha,
            estado: apertura.estado,
          });
          console.log("✓ Apertura guardada en cache");
        }
      }
    } catch (err: any) {
      console.error("Error registrando apertura:", err);
      alert("Error al registrar apertura: " + (err?.message || String(err)));
    } finally {
      setRegistrandoApertura(false);
    }
  };

  // Calculate total
  const total = seleccionados.reduce(
    (sum, p) => sum + p.precio * p.cantidad,
    0,
  );

  // Filter products by type and subcategory
  const productosFiltrados = productos.filter((p) => {
    if (p.tipo !== activeTab) return false;
    if (activeTab === "comida" && subcategoriaFiltro) {
      return p.subcategoria === subcategoriaFiltro;
    }
    return true;
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background:
          theme === "lite"
            ? "rgba(255,255,255,0.95)"
            : "linear-gradient(135deg, #232526 0%, #414345 100%)",
        color: theme === "lite" ? "#222" : "#f5f5f5",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        zIndex: 999,
        transition: "background 0.3s, color 0.3s",
      }}
    >
      <style>{`
        .form-input, .form-select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 2px 6px rgba(16,24,40,0.04);
          font-size: 14px;
          transition: all 0.18s ease;
          color: #0b1220;
          appearance: none;
        }
        :where(.dark) .form-input, :where(.dark) .form-select {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: #e6eef8;
          box-shadow: none;
        }
        .form-input::placeholder { color: #94a3b8; }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #60a5fa;
          box-shadow: 0 6px 20px rgba(37,99,235,0.12);
          transform: translateY(-1px);
        }
        /* tamaños compactos para formularios dentro de modales */
        .form-input.small { padding: 8px 10px; font-size: 13px; border-radius: 8px; }
        
        /* Animación para indicador de conexión */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      {/* Indicador de conexión e información del cajero */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 32,
          zIndex: 10001,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            color: isOnline ? "#43a047" : "#d32f2f",
            fontWeight: 700,
            fontSize: 15,
            marginLeft: 12,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "48vw",
            display: "inline-block",
          }}
          title={
            caiInfo
              ? `${caiInfo.nombre_cajero} | Caja: ${caiInfo.caja_asignada}${
                  facturaActual ? ` | Factura: ${facturaActual}` : ""
                }`
              : facturaActual
                ? `Factura: ${facturaActual}`
                : ""
          }
        >
          {caiInfo &&
            `${caiInfo.nombre_cajero} | Caja: ${caiInfo.caja_asignada}`}
          {caiInfo && facturaActual
            ? ` | Factura: ${facturaActual}`
            : !caiInfo && facturaActual
              ? `Factura: ${facturaActual}`
              : ""}
        </span>
        {/* Botones de tema y funciones principales en la misma fila */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginLeft: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Botones de tema */}
          <button
            onClick={() => {
              setTheme("dark");
              localStorage.setItem("theme", "dark");
            }}
            style={{
              background: theme === "dark" ? "#1976d2" : "transparent",
              color:
                theme === "dark"
                  ? "#fff"
                  : theme === "lite"
                    ? "#1976d2"
                    : "#fff",
              border: theme === "dark" ? "none" : "1px solid #1976d2",
              borderRadius: 6,
              padding: "6px 10px",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              boxShadow:
                theme === "dark" ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
            }}
            title="Activar modo oscuro"
          >
            🌙 Oscuro
          </button>
          <button
            onClick={() => {
              setTheme("lite");
              localStorage.setItem("theme", "lite");
            }}
            style={{
              background: theme === "lite" ? "#1976d2" : "transparent",
              color:
                theme === "lite"
                  ? "#fff"
                  : theme === "dark"
                    ? "#f5f5f5"
                    : "#1976d2",
              border:
                theme === "lite" ? "none" : "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "6px 10px",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
              boxShadow:
                theme === "lite" ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
            }}
            title="Activar modo claro"
          >
            ☀️ Claro
          </button>

          {/* Separador visual */}
          <div
            style={{
              width: 1,
              height: 24,
              background:
                theme === "lite" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
            }}
          />

          {/* Botón Resumen de caja */}
          <button
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              background: isOnline ? "#1976d2" : "#9e9e9e",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: isOnline ? "pointer" : "not-allowed",
              opacity: isOnline ? 1 : 0.6,
            }}
            onClick={() => {
              if (!isOnline) {
                setShowNoConnectionModal(true);
                return;
              }
              fetchResumenCaja();
            }}
            title={
              isOnline
                ? "Ver resumen de caja del día"
                : "Requiere conexión a internet"
            }
          >
            📊 Resumen
          </button>

          {/* Botón Registrar gasto */}
          <button
            onClick={() => {
              cerrarRegistrarGasto();
              setShowRegistrarGasto(true);
            }}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              background:
                theme === "lite"
                  ? "rgba(211,47,47,0.95)"
                  : "rgba(183,28,28,0.95)",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
            title="Registrar un gasto"
          >
            💰 Gasto
          </button>

          {/* Botón Devolución */}
          <button
            onClick={() => {
              setShowDevolucionModal(true);
              setDevolucionFactura("");
              setDevolucionData(null);
              setDevolucionPassword("");
            }}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              background:
                theme === "lite"
                  ? "rgba(255,152,0,0.95)"
                  : "rgba(230,81,0,0.95)",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
            title="Procesar devolución"
          >
            🔄 Devolución
          </button>

          {/* Botón Domicilios */}
          <button
            onClick={async () => {
              setShowPedidosModal(true);
              setPedidosLoading(true);
              try {
                const { data, error } = await supabase
                  .from("pedidos_envio")
                  .select("*")
                  .eq("cajero_id", usuarioActual?.id)
                  .order("created_at", { ascending: false })
                  .limit(100);
                if (!error) setPedidosList(data || []);
                else {
                  console.error("Error cargando pedidos:", error);
                  setPedidosList([]);
                }
              } catch (e) {
                console.error(e);
                setPedidosList([]);
              } finally {
                setPedidosLoading(false);
              }
            }}
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 6,
              background: "#388e3c",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
            title="Ver pedidos a domicilio"
          >
            🏠 Domicilios
          </button>

          {/* Botón Aclaraciones - solo visible si hay 1 o más cierres sin aclarar */}
          {cierresSinAclarar >= 1 && (
            <button
              onClick={() => {
                if (setView) setView("resultadosCaja");
              }}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                background: "#f57c00",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                position: "relative",
              }}
              title={`Hay ${cierresSinAclarar} cierre(s) sin aclarar este mes`}
            >
              📝 Aclaraciones
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#d32f2f",
                  color: "#fff",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                {cierresSinAclarar}
              </span>
            </button>
          )}

          {/* Botón Registrar cierre - solo visible con apertura activa */}
          {aperturaRegistrada && (
            <>
              <div
                style={{
                  width: 1,
                  height: 24,
                  background:
                    theme === "lite"
                      ? "rgba(0,0,0,0.1)"
                      : "rgba(255,255,255,0.1)",
                }}
              />
              <button
                style={{
                  background: isOnline ? "#fbc02d" : "#9e9e9e",
                  color: isOnline ? "#333" : "#666",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: isOnline ? "pointer" : "not-allowed",
                  boxShadow: isOnline ? "0 2px 8px #fbc02d44" : "none",
                  opacity: isOnline ? 1 : 0.6,
                }}
                onClick={() => {
                  if (!isOnline) {
                    setShowNoConnectionModal(true);
                    return;
                  }
                  setShowCierre(true);
                }}
                title={
                  isOnline
                    ? "Registrar cierre de caja"
                    : "Requiere conexión a internet"
                }
              >
                🚪 Cierre de Caja
              </button>
            </>
          )}
        </div>
        {/* QZ Tray indicators removed */}
      </div>
      {/* Modal de resumen de caja (fuera del header) */}
      {showResumen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110000,
          }}
          onClick={() => setShowResumen(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              color: theme === "lite" ? "#222" : "#fbc02d",
              borderRadius: 12,
              padding: 24,
              minWidth: 300,
              boxShadow: "0 8px 32px #0003",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                color: theme === "lite" ? "#1976d2" : "#fbc02d",
              }}
            >
              Resumen de caja
            </h3>
            {resumenLoading ? (
              <div style={{ padding: 12 }}>Cargando...</div>
            ) : resumenData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <strong>EFECTIVO:</strong>{" "}
                  {(resumenData.efectivo - resumenData.gastos).toFixed(2)}
                </div>

                <div>
                  <strong>TARJETA:</strong> {resumenData.tarjeta.toFixed(2)}
                </div>
                <div>
                  <strong>TRANSFERENCIA:</strong>{" "}
                  {resumenData.transferencia.toFixed(2)}
                </div>
                <div>
                  <strong>DÓLARES:</strong>{" "}
                  {typeof resumenData.dolares_usd !== "undefined" ? (
                    <>
                      ({resumenData.dolares_usd.toFixed(2)} $) : Lps{" "}
                      {resumenData.dolares_convertidos?.toFixed(2) ??
                        resumenData.dolares.toFixed(2)}
                    </>
                  ) : (
                    <>L {resumenData.dolares.toFixed(2)}</>
                  )}
                </div>
                <div>
                  <strong>GASTOS:</strong> {resumenData.gastos.toFixed(2)}
                </div>
              </div>
            ) : (
              <div>No hay datos</div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setShowResumen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón de tema: muestra la acción disponible y cambia el texto al alternar */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 32,
          display: "flex",
          gap: 12,
          alignItems: "center",
          zIndex: 10000,
        }}
      >
        {usuarioActual?.rol === "admin" && (
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              boxShadow: "0 2px 8px #1976d222",
            }}
          >
            Volver
          </button>
        )}
        {/* Botón de cerrar sesión oculto */}
        <button style={{ display: "none" }}>Cerrar sesión</button>

        {showCierre && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.18)",
              zIndex: 99999,
            }}
          >
            <RegistroCierreView
              usuarioActual={usuarioActual}
              caja={caiInfo?.caja_asignada || ""}
              onBack={() => setShowCierre(false)}
              onCierreGuardado={async () => {
                if (!setView) return;
                // Consultar el cierre de hoy para este cajero y caja usando rango local
                const { start, end } = getLocalDayRange();
                const { data: cierresHoy } = await supabase
                  .from("cierres")
                  .select("diferencia, observacion, estado")
                  .eq("cajero_id", usuarioActual?.id)
                  .eq("caja", caiInfo?.caja_asignada || "")
                  .eq("estado", "CIERRE")
                  .gte("fecha", start)
                  .lte("fecha", end);

                // Actualizar estado de apertura
                setAperturaRegistrada(false);

                if (cierresHoy && cierresHoy.length > 0) {
                  const cierre = cierresHoy[0];
                  // Si hay diferencia, mostrar resultados
                  if (cierre.diferencia !== 0) {
                    setView("resultadosCaja");
                  } else {
                    // Si no hay diferencia, cerrar modal y quedarse en punto de ventas
                    setShowCierre(false);
                  }
                } else {
                  setShowCierre(false);
                }
              }}
            />
            <button
              style={{
                position: "absolute",
                top: 24,
                right: 32,
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
                zIndex: 100000,
              }}
              onClick={() => setShowCierre(false)}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Modal de pago (fuera del bloque del botón) */}
      <PagoModal
        isOpen={showPagoModal}
        onClose={() => {
          setShowPagoModal(false);
        }}
        totalPedido={total}
        exchangeRate={tasaCambio}
        theme={theme}
        onPagoConfirmado={async (paymentData) => {
          // Guardar los pagos en la base de datos
          try {
            if (paymentData.pagos && paymentData.pagos.length > 0) {
              const cambioValue = paymentData.totalPaid - total;

              const pagosToInsert = paymentData.pagos.map((pago) => ({
                tipo: pago.tipo,
                monto: pago.monto,
                banco: pago.banco || null,
                tarjeta: pago.tarjeta || null,
                factura: pago.factura || null,
                autorizador: pago.autorizador || null,
                referencia: pago.referencia || null,
                usd_monto: pago.usd_monto || null,
                fecha_hora: formatToHondurasLocal(),
                cajero: usuarioActual?.nombre || "",
                cajero_id: usuarioActual?.id || null,
                cliente: nombreCliente,
                factura_venta: facturaActual,
                recibido: paymentData.totalPaid,
                cambio: cambioValue,
              }));

              // Si hay cambio positivo, registrar salida de efectivo
              if (cambioValue > 0) {
                pagosToInsert.push({
                  tipo: "efectivo",
                  monto: -cambioValue, // Monto negativo indica salida
                  banco: null,
                  tarjeta: null,
                  factura: null,
                  autorizador: null,
                  referencia: "CAMBIO",
                  usd_monto: null,
                  fecha_hora: formatToHondurasLocal(),
                  cajero: usuarioActual?.nombre || "",
                  cajero_id: usuarioActual?.id || null,
                  cliente: nombreCliente,
                  factura_venta: facturaActual,
                  recibido: paymentData.totalPaid,
                  cambio: cambioValue,
                });
              }

              console.log("Insertando pagos:", pagosToInsert);

              // PASO 1: Guardar primero en IndexedDB
              const pagosIdsLocales = await guardarPagosLocal(pagosToInsert);
              console.log(
                `✓ ${pagosToInsert.length} pagos guardados en IndexedDB`,
              );

              // PASO 2: Intentar guardar en Supabase
              try {
                const { error: pagoError } = await supabase
                  .from("pagos")
                  .insert(pagosToInsert);

                if (pagoError) {
                  console.error(
                    "Error al guardar pagos en Supabase:",
                    pagoError,
                  );
                  console.log(
                    "⚠ Pagos guardados localmente, se sincronizarán después",
                  );
                } else {
                  // Si se guardaron exitosamente en Supabase, eliminar de IndexedDB
                  for (const idLocal of pagosIdsLocales) {
                    await eliminarPagoLocal(idLocal);
                  }
                  console.log(
                    "✓ Pagos sincronizados y eliminados de IndexedDB",
                  );
                }
              } catch (fetchError) {
                console.error(
                  "Error de conexión al guardar pagos en Supabase:",
                  fetchError,
                );
                console.log(
                  "⚠ Pagos guardados localmente, se sincronizarán cuando haya conexión",
                );
              }

              // Actualizar contador de pendientes
              const count = await obtenerContadorPendientes();
              setPendientesCount(count);
            }
          } catch (err) {
            console.error("Error al procesar pagos:", err);
            alert("Error al procesar los pagos");
            return;
          }

          setShowPagoModal(false);
          setTimeout(async () => {
            // Consultar configuración de comanda y recibo desde Supabase
            const { data: etiquetaConfig } = await supabase
              .from("etiquetas_config")
              .select("*")
              .eq("nombre", "default")
              .single();
            const { data: reciboConfig } = await supabase
              .from("recibo_config")
              .select("*")
              .eq("nombre", "default")
              .single();
            // Comanda
            const comandaHtml = `
              <div style='font-family:monospace; width:${
                etiquetaConfig?.etiqueta_ancho || 80
              }mm; margin:0; padding:${
                etiquetaConfig?.etiqueta_padding || 8
              }px;'>
                <div style='font-size:${
                  etiquetaConfig?.etiqueta_fontsize || 24
                }px; font-weight:800; color:#000; text-align:center; margin-bottom:6px;'>${
                  etiquetaConfig?.etiqueta_comanda || "COMANDA COCINA"
                }</div>
                <div style='font-size:28px; font-weight:900; color:#000; text-align:center; margin:16px 0;'>${tipoOrden}</div>
                <div style='font-size:20px; font-weight:800; color:#000; text-align:center; margin-bottom:12px;'>Cliente: <b>${nombreCliente}</b></div>
                <div style='font-size:14px; font-weight:600; color:#222; text-align:center; margin-bottom:6px;'>Factura: ${
                  facturaActual || ""
                }</div>
                
                ${
                  seleccionados.filter((p) => p.tipo === "comida").length > 0
                    ? `
                  <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>COMIDAS</div>
                  <ul style='list-style:none; padding:0; margin-bottom:12px;'>
                    ${seleccionados
                      .filter((p) => p.tipo === "comida")
                      .map(
                        (p) =>
                          `<li style='font-size:${
                            etiquetaConfig?.etiqueta_fontsize || 20
                          }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                            <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                              p.cantidad
                            }x</div>
                            <div style='font-weight:700;'>${p.nombre}</div>
                            ${
                              p.complementos
                                ? `<div style='font-size:14px; margin-top:4px;'><span style='font-weight:700;'>- ${p.complementos}</span></div>`
                                : ""
                            }
                            ${
                              p.piezas && p.piezas !== "PIEZAS VARIAS"
                                ? `<div style='font-size:14px; margin-top:2px;'><span style='font-weight:700;'>- ${p.piezas}</span></div>`
                                : ""
                            }
                          </li>`,
                      )
                      .join("")}
                  </ul>
                `
                    : ""
                }
                
                ${
                  seleccionados.filter((p) => p.tipo === "complemento").length >
                  0
                    ? `
                  <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>COMPLEMENTOS</div>
                  <ul style='list-style:none; padding:0; margin-bottom:12px;'>
                    ${seleccionados
                      .filter((p) => p.tipo === "complemento")
                      .map(
                        (p) =>
                          `<li style='font-size:${
                            etiquetaConfig?.etiqueta_fontsize || 20
                          }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                            <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                              p.cantidad
                            }x</div>
                            <div style='font-weight:700;'>${p.nombre}</div>
                          </li>`,
                      )
                      .join("")}
                  </ul>
                `
                    : ""
                }

                ${
                  seleccionados.filter((p) => p.tipo === "bebida").length > 0
                    ? `
                  <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>BEBIDAS</div>
                  <ul style='list-style:none; padding:0; margin-bottom:0;'>
                    ${seleccionados
                      .filter((p) => p.tipo === "bebida")
                      .map(
                        (p) =>
                          `<li style='font-size:${
                            etiquetaConfig?.etiqueta_fontsize || 20
                          }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                            <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                              p.cantidad
                            }x</div>
                            <div style='font-weight:700;'>${p.nombre}</div>
                          </li>`,
                      )
                      .join("")}
                  </ul>
                `
                    : ""
                }
              </div>
            `;
            // Recibo - Formato SAR
            // Calcular subtotal e ISV 15%
            const subtotalRecibo = seleccionados.reduce((sum, p) => {
              if (p.tipo === "comida") {
                return sum + (p.precio / 1.15) * p.cantidad;
              } else if (p.tipo === "bebida") {
                return sum + (p.precio / 1.18) * p.cantidad;
              } else {
                return sum + p.precio * p.cantidad;
              }
            }, 0);
            const isv15Recibo = seleccionados
              .filter((p) => p.tipo === "comida")
              .reduce(
                (sum, p) => sum + (p.precio - p.precio / 1.15) * p.cantidad,
                0,
              );

            // Calcular pagos para el recibo
            const efectivoTotal =
              paymentData.pagos
                ?.filter((p) => p.tipo === "efectivo")
                .reduce((sum, p) => sum + p.monto, 0) || 0;
            const tarjetaTotal =
              paymentData.pagos
                ?.filter((p) => p.tipo === "tarjeta")
                .reduce((sum, p) => sum + p.monto, 0) || 0;
            const dolaresTotal =
              paymentData.pagos
                ?.filter((p) => p.tipo === "dolares")
                .reduce((sum, p) => sum + p.monto, 0) || 0;
            const dolaresUSD =
              paymentData.pagos
                ?.filter((p) => p.tipo === "dolares")
                .reduce((sum, p) => sum + (p.usd_monto || 0), 0) || 0;
            const transferenciaTotal =
              paymentData.pagos
                ?.filter((p) => p.tipo === "transferencia")
                .reduce((sum, p) => sum + p.monto, 0) || 0;
            const cambioValue = paymentData.totalPaid - total;

            let pagosHtml = "";
            if (
              efectivoTotal > 0 ||
              tarjetaTotal > 0 ||
              dolaresTotal > 0 ||
              transferenciaTotal > 0
            ) {
              pagosHtml +=
                "<div style='border-top:1px dashed #000; margin-top:10px; padding-top:10px;'>";
              pagosHtml +=
                "<div style='font-size:15px; font-weight:700; margin-bottom:6px;'>PAGOS RECIBIDOS:</div>";

              if (efectivoTotal > 0) {
                pagosHtml += "<div style='font-size:14px; margin-bottom:3px;'>";
                pagosHtml += "<span style='float:left;'>Efectivo:</span>";
                pagosHtml +=
                  "<span style='float:right;'>L " +
                  efectivoTotal.toFixed(2) +
                  "</span>";
                pagosHtml += "<div style='clear:both;'></div>";
                pagosHtml += "</div>";
              }

              if (tarjetaTotal > 0) {
                pagosHtml += "<div style='font-size:14px; margin-bottom:3px;'>";
                pagosHtml += "<span style='float:left;'>Tarjeta:</span>";
                pagosHtml +=
                  "<span style='float:right;'>L " +
                  tarjetaTotal.toFixed(2) +
                  "</span>";
                pagosHtml += "<div style='clear:both;'></div>";
                pagosHtml += "</div>";
              }

              if (dolaresTotal > 0) {
                pagosHtml += "<div style='font-size:14px; margin-bottom:3px;'>";
                pagosHtml +=
                  "<span style='float:left;'>Dólares: $" +
                  dolaresUSD.toFixed(2) +
                  " USD</span>";
                pagosHtml +=
                  "<span style='float:right;'>L " +
                  dolaresTotal.toFixed(2) +
                  "</span>";
                pagosHtml += "<div style='clear:both;'></div>";
                pagosHtml += "</div>";
              }

              if (transferenciaTotal > 0) {
                pagosHtml += "<div style='font-size:14px; margin-bottom:3px;'>";
                pagosHtml += "<span style='float:left;'>Transferencia:</span>";
                pagosHtml +=
                  "<span style='float:right;'>L " +
                  transferenciaTotal.toFixed(2) +
                  "</span>";
                pagosHtml += "<div style='clear:both;'></div>";
                pagosHtml += "</div>";
              }

              if (cambioValue > 0) {
                pagosHtml +=
                  "<div style='font-size:15px; margin-top:6px; padding-top:6px; border-top:1px solid #000; font-weight:700;'>";
                pagosHtml += "<span style='float:left;'>CAMBIO:</span>";
                pagosHtml +=
                  "<span style='float:right;'>L " +
                  cambioValue.toFixed(2) +
                  "</span>";
                pagosHtml += "<div style='clear:both;'></div>";
                pagosHtml += "</div>";
              }

              pagosHtml += "</div>";
            }

            const comprobanteHtml = `
              <div style='font-family:monospace; width:${
                reciboConfig?.recibo_ancho || 80
              }mm; margin:0; padding:${
                reciboConfig?.recibo_padding || 8
              }px; background:#fff;'>
                <!-- Logo -->
                <div style='text-align:center; margin-bottom:12px;'>
                  <img src='${datosNegocio.logo_url || "/favicon.ico"}' alt='${
                    datosNegocio.nombre_negocio
                  }' style='width:320px; height:320px;' onload='window.imageLoaded = true;' />
                </div>
                
                <!-- Información del Negocio -->
                <div style='text-align:center; font-size:18px; font-weight:700; margin-bottom:6px;'>${datosNegocio.nombre_negocio.toUpperCase()}</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>${
                  datosNegocio.direccion
                }</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>RTN: ${
                  datosNegocio.rtn
                }</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>PROPIETARIO: ${datosNegocio.propietario.toUpperCase()}</div>
                <div style='text-align:center; font-size:14px; margin-bottom:10px;'>TEL: ${
                  datosNegocio.celular
                }</div>
                
                <div style='border-top:2px solid #000; border-bottom:2px solid #000; padding:6px 0; margin-bottom:10px;'>
                  <div style='text-align:center; font-size:16px; font-weight:700;'>RECIBO DE VENTA</div>
                </div>
                
                <!-- Información del Cliente, Factura y Fecha -->
                <div style='font-size:14px; margin-bottom:3px;'>Cliente: ${nombreCliente}</div>
                <div style='font-size:14px; margin-bottom:3px;'>Factura: ${
                  facturaActual || ""
                }</div>
                <div style='font-size:14px; margin-bottom:10px;'>Fecha: ${new Date().toLocaleString(
                  "es-HN",
                  { timeZone: "America/Tegucigalpa" },
                )}</div>
                
                <!-- Tabla de Productos -->
                <div style='border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:10px;'>
                  <table style='width:100%; font-size:14px; border-collapse:collapse;'>
                    <thead>
                      <tr style='border-bottom:1px solid #000;'>
                        <th style='text-align:left; padding:3px 0;'>CANT</th>
                        <th style='text-align:left; padding:3px 0;'>DESCRIPCIÓN</th>
                        <th style='text-align:right; padding:3px 0;'>P.UNIT</th>
                        <th style='text-align:right; padding:3px 0;'>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${seleccionados
                        .map(
                          (p) =>
                            `<tr>
                              <td style='padding:4px 0;'>${p.cantidad}</td>
                              <td style='padding:4px 0;'>${p.nombre}</td>
                              <td style='text-align:right; padding:4px 0;'>L${p.precio.toFixed(
                                2,
                              )}</td>
                              <td style='text-align:right; padding:4px 0;'>L${(
                                p.precio * p.cantidad
                              ).toFixed(2)}</td>
                            </tr>`,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
                
                <!-- Totales -->
                <div style='font-size:15px; margin-bottom:3px;'>
                  <span style='float:left;'>SUBTOTAL:</span>
                  <span style='float:right; font-weight:700;'>L ${subtotalRecibo.toFixed(
                    2,
                  )}</span>
                  <div style='clear:both;'></div>
                </div>
                <div style='font-size:15px; margin-bottom:3px;'>
                  <span style='float:left;'>ISV 15%:</span>
                  <span style='float:right; font-weight:700;'>L ${isv15Recibo.toFixed(
                    2,
                  )}</span>
                  <div style='clear:both;'></div>
                </div>
                <div style='border-top:1px solid #000; margin-top:6px; padding-top:6px; font-size:17px; font-weight:700;'>
                  <span style='float:left;'>TOTAL:</span>
                  <span style='float:right;'>L ${total.toFixed(2)}</span>
                  <div style='clear:both;'></div>
                </div>
                
                ${pagosHtml}
                
                <!-- Mensaje de Agradecimiento -->
                <div style='text-align:center; margin-top:18px; font-size:15px; font-weight:700; border-top:1px dashed #000; padding-top:10px;'>
                  ¡GRACIAS POR SU COMPRA!
                </div>
                <div style='text-align:center; font-size:14px; margin-top:5px;'>
                  Esperamos verle pronto
                </div>
              </div>
            `;
            // Imprimir recibo y comanda sin cortes automáticos en el recibo
            const printHtml = `
              <html>
                <head>
                  <title>Recibo y Comanda</title>
                  <style>
                    @page {
                      margin: 0;
                      size: auto;
                    }
                    body {
                      margin: 0;
                      padding: 0;
                      overflow: visible;
                    }
                    * {
                      page-break-inside: avoid;
                      -webkit-print-color-adjust: exact;
                    }
                    @media print {
                      html, body {
                        height: auto;
                        overflow: visible;
                      }
                      .comanda-break {
                        page-break-before: always;
                      }
                    }
                  </style>
                </head>
                <body>
                  <div>${comprobanteHtml}</div>
                  <div class="comanda-break">${comandaHtml}</div>
                </body>
              </html>
            `;

            // Precargar la imagen antes de imprimir
            const preloadImage = () => {
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false); // Continuar aunque falle
                img.src = datosNegocio.logo_url || "/favicon.ico";
                // Timeout de seguridad de 2 segundos
                setTimeout(() => resolve(false), 2000);
              });
            };

            try {
              // Esperar a que la imagen se cargue
              await preloadImage();
              // Fallback: abrir ventana de impresión del navegador
              const printWindow = window.open("", "", "height=800,width=400");
              if (printWindow) {
                printWindow.document.write(printHtml);
                printWindow.document.close();
                printWindow.onload = () => {
                  setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                  }, 500);
                };
              }
            } catch (err) {
              console.error("Error al intentar imprimir:", err);
              const printWindow = window.open("", "", "height=800,width=400");
              if (printWindow) {
                printWindow.document.write(printHtml);
                printWindow.document.close();
                printWindow.onload = () => {
                  setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                  }, 500);
                };
              }
            }
            // Guardar venta en la tabla 'facturas' con nuevos campos
            // Primero en IndexedDB, luego en Supabase
            try {
              const subTotal = seleccionados.reduce((sum, p) => {
                if (p.tipo === "comida") {
                  return sum + (p.precio / 1.15) * p.cantidad;
                } else if (p.tipo === "bebida") {
                  return sum + (p.precio / 1.18) * p.cantidad;
                } else {
                  return sum + p.precio * p.cantidad;
                }
              }, 0);
              const isv15 = seleccionados
                .filter((p) => p.tipo === "comida")
                .reduce(
                  (sum, p) => sum + (p.precio - p.precio / 1.15) * p.cantidad,
                  0,
                );
              const isv18 = seleccionados
                .filter((p) => p.tipo === "bebida")
                .reduce(
                  (sum, p) => sum + (p.precio - p.precio / 1.18) * p.cantidad,
                  0,
                );
              if (facturaActual === "Límite alcanzado") {
                alert(
                  "¡Se ha alcanzado el límite de facturas para este cajero!",
                );
                return;
              }
              const factura = facturaActual;
              const venta = {
                fecha_hora: formatToHondurasLocal(),
                cajero: usuarioActual?.nombre || "",
                cajero_id: usuarioActual?.id || null,
                caja: caiInfo?.caja_asignada || "",
                cai: caiInfo && caiInfo.cai ? caiInfo.cai : "",
                factura,
                cliente: nombreCliente,
                productos: JSON.stringify(
                  seleccionados.map((p) => ({
                    id: p.id,
                    nombre: p.nombre,
                    precio: p.precio,
                    cantidad: p.cantidad,
                    tipo: p.tipo,
                  })),
                ),
                sub_total: subTotal.toFixed(2),
                isv_15: isv15.toFixed(2),
                isv_18: isv18.toFixed(2),
                total: seleccionados
                  .reduce((sum, p) => sum + p.precio * p.cantidad, 0)
                  .toFixed(2),
              };

              // PASO 1: Guardar primero en IndexedDB
              const facturaIdLocal = await guardarFacturaLocal(venta);
              console.log(
                `✓ Factura guardada en IndexedDB (ID: ${facturaIdLocal})`,
              );

              // PASO 2: Intentar guardar en Supabase
              try {
                const { error: supabaseError } = await supabase
                  .from("facturas")
                  .insert([venta]);

                if (supabaseError) {
                  console.error("Error guardando en Supabase:", supabaseError);
                  console.log(
                    "⚠ Factura guardada localmente, se sincronizará después",
                  );
                } else {
                  // Si se guardó exitosamente en Supabase, eliminar de IndexedDB
                  await eliminarFacturaLocal(facturaIdLocal);
                  console.log(
                    "✓ Factura sincronizada y eliminada de IndexedDB",
                  );
                }
              } catch (supabaseErr) {
                console.error("Error de conexión con Supabase:", supabaseErr);
                console.log(
                  "⚠ Factura guardada localmente, se sincronizará cuando haya conexión",
                );
              }

              // Actualizar contador de pendientes
              const count = await obtenerContadorPendientes();
              setPendientesCount(count);

              // Actualizar el número de factura actual en la vista
              if (facturaActual !== "Límite alcanzado") {
                setFacturaActual((parseInt(facturaActual) + 1).toString());

                // Actualizar factura_actual en cai_facturas
                if (usuarioActual?.id) {
                  try {
                    await supabase
                      .from("cai_facturas")
                      .update({
                        factura_actual: (
                          parseInt(facturaActual) + 1
                        ).toString(),
                      })
                      .eq("cajero_id", usuarioActual.id);
                  } catch (err) {
                    console.error("Error actualizando factura_actual:", err);
                  }
                }
              }
            } catch (err) {
              console.error("Error al guardar la venta:", err);
              alert(
                "Error al guardar la factura. Por favor, contacte al administrador.",
              );
            }
            // Limpiar selección después de imprimir
            limpiarSeleccion();
            setNombreCliente("");
          }, 300);
        }}
      />
      <h1
        style={{
          color: "#1976d2",
          marginBottom: 24,
          textAlign: "center",
          width: "100%",
          fontSize: "2.8rem",
          fontWeight: 800,
          letterSpacing: 2,
          background: "linear-gradient(90deg, #1976d2 60%, #388e3c 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          paddingTop: 32,
          paddingBottom: 8,
        }}
      ></h1>
      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      <div
        style={{
          display: "flex",
          gap: 24,
          width: "100%",
          height: "calc(100vh - 2px)",
          justifyContent: "center",
          alignItems: "stretch",
          marginBottom: "2px",
        }}
      >
        {/* Menu Section */}
        <div
          style={{
            flex: 2,
            minWidth: 0,
            background: theme === "lite" ? "#fff" : "#232526",
            borderRadius: 18,
            boxShadow:
              theme === "lite"
                ? "0 4px 16px rgba(0,0,0,0.12)"
                : "0 4px 16px #0008",
            padding: 8,
            transition: "background 0.3s",
          }}
        >
          {/* Tabs for Comida/Bebida/Complemento */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              borderBottom: "2px solid #e0e0e0",
            }}
          >
            <button
              onClick={() => {
                setActiveTab("comida");
                setSubcategoriaFiltro(null);
              }}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: activeTab === "comida" ? 700 : 400,
                color: activeTab === "comida" ? "#388e3c" : "#666",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === "comida" ? "3px solid #388e3c" : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Comidas
            </button>
            <button
              onClick={() => {
                setActiveTab("complemento");
                setSubcategoriaFiltro(null);
              }}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: activeTab === "complemento" ? 700 : 400,
                color: activeTab === "complemento" ? "#9c27b0" : "#666",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === "complemento" ? "3px solid #9c27b0" : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Complementos
            </button>
            <button
              onClick={() => {
                setActiveTab("bebida");
                setSubcategoriaFiltro(null);
              }}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 18,
                fontWeight: activeTab === "bebida" ? 700 : 400,
                color: activeTab === "bebida" ? "#1976d2" : "#666",
                background: "none",
                border: "none",
                borderBottom:
                  activeTab === "bebida" ? "3px solid #1976d2" : "none",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              Bebidas
            </button>
          </div>

          {/* Botones de filtro por subcategor\u00eda (solo para comida) */}
          {activeTab === "comida" &&
            (() => {
              const subcategorias = Array.from(
                new Set(
                  productos
                    .filter((p) => p.tipo === "comida" && p.subcategoria)
                    .map((p) => p.subcategoria),
                ),
              ).filter(Boolean) as string[];

              if (subcategorias.length === 0) return null;

              const colores = [
                { bg: "#ff6b6b", hover: "#ee5a5a" },
                { bg: "#4ecdc4", hover: "#45b8b0" },
                { bg: "#ffe66d", hover: "#f4d747" },
                { bg: "#95e1d3", hover: "#7dd4c3" },
                { bg: "#ffa502", hover: "#e89400" },
                { bg: "#ff6348", hover: "#e84c3a" },
              ];

              return (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: "wrap",
                    padding: "8px 0",
                  }}
                >
                  <button
                    onClick={() => {
                      setSubcategoriaFiltro(null);
                    }}
                    style={{
                      padding: "10px 20px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: !subcategoriaFiltro ? "#fff" : "#666",
                      background: !subcategoriaFiltro ? "#388e3c" : "#e0e0e0",
                      border: "none",
                      borderRadius: 20,
                      cursor: "pointer",
                      transition: "all 0.3s",
                      boxShadow: !subcategoriaFiltro
                        ? "0 4px 8px rgba(56, 142, 60, 0.3)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!subcategoriaFiltro) {
                        e.currentTarget.style.background = "#2e7d32";
                      } else {
                        e.currentTarget.style.background = "#d0d0d0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = !subcategoriaFiltro
                        ? "#388e3c"
                        : "#e0e0e0";
                    }}
                  >
                    TODOS
                  </button>
                  {subcategorias.map((sub, idx) => {
                    const color = colores[idx % colores.length];
                    const isActive = subcategoriaFiltro === sub;
                    return (
                      <button
                        key={sub}
                        onClick={() => {
                          setSubcategoriaFiltro(isActive ? null : sub);
                        }}
                        style={{
                          padding: "10px 20px",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#fff",
                          background: isActive ? color.bg : "#bdbdbd",
                          border: "none",
                          borderRadius: 20,
                          cursor: "pointer",
                          transition: "all 0.3s",
                          boxShadow: isActive
                            ? `0 4px 8px ${color.bg}50`
                            : "none",
                          transform: isActive ? "scale(1.05)" : "scale(1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = color.hover;
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isActive
                            ? color.bg
                            : "#bdbdbd";
                          e.currentTarget.style.transform = isActive
                            ? "scale(1.05)"
                            : "scale(1)";
                        }}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

          {/* Botón para registrar apertura si no existe */}
          {verificandoApertura && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "40px 20px",
                background: theme === "lite" ? "#e3f2fd" : "#1a2332",
                borderRadius: 16,
                marginBottom: 20,
                border: `2px solid ${theme === "lite" ? "#2196f3" : "#42a5f5"}`,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    margin: "0",
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme === "lite" ? "#1565c0" : "#90caf9",
                  }}
                >
                  Verificando apertura de caja...
                </p>
              </div>
            </div>
          )}
          
          {aperturaRegistrada === false && !verificandoApertura && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "40px 20px",
                background: theme === "lite" ? "#fff3cd" : "#3a2e1c",
                borderRadius: 16,
                marginBottom: 20,
                border: `2px solid ${theme === "lite" ? "#ffc107" : "#ff9800"}`,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    margin: "0 0 16px 0",
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme === "lite" ? "#856404" : "#ffb74d",
                  }}
                >
                  No has registrado apertura de caja hoy.
                </p>
                <button
                  onClick={registrarAperturaRapida}
                  disabled={registrandoApertura || !isOnline}
                  style={{
                    padding: "12px 32px",
                    fontSize: 16,
                    fontWeight: 700,
                    background: !isOnline ? "#999" : "#1976d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    cursor: (registrandoApertura || !isOnline) ? "not-allowed" : "pointer",
                    opacity: (registrandoApertura || !isOnline) ? 0.6 : 1,
                    boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
                  }}
                >
                  {registrandoApertura
                    ? "Registrando..."
                    : !isOnline
                    ? "SIN CONEXIÓN"
                    : "REGISTRAR APERTURA"}
                </button>
              </div>
            </div>
          )}

          {/* Product Grid */}
          {loading ? (
            <p style={{ textAlign: "center" }}>Cargando...</p>
          ) : aperturaRegistrada === false ? (
            <p style={{ textAlign: "center", color: "#999" }}>
              Registra la apertura para ver los productos
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 20,
                maxHeight: "60vh",
                overflowY: "auto",
                paddingRight: 8,
              }}
            >
              {productosFiltrados.map((p) => (
                <div
                  key={p.id}
                  onClick={() => agregarProducto(p)}
                  style={{
                    background: theme === "lite" ? "#fff" : "#333",
                    borderRadius: 18,
                    padding: 16,
                    boxShadow:
                      theme === "lite"
                        ? "0 4px 16px rgba(0,0,0,0.12)"
                        : "0 4px 16px #0008",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    transition:
                      "transform 0.2s, background 0.3s', color 0.3s', box-shadow 0.3s', border 0.3s',",
                    minHeight: 180,
                    color: theme === "lite" ? "#222" : "#f5f5f5",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.07)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  {p.imagen && (
                    <img
                      src={p.imagen}
                      alt={p.nombre}
                      style={{
                        width: "100%",
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 16,
                        marginBottom: 18,
                        boxShadow: "0 4px 16px #1976d222",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 22,
                      color:
                        activeTab === "comida"
                          ? "#388e3c"
                          : activeTab === "bebida"
                            ? "#1976d2"
                            : "#9c27b0",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    {p.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: theme === "dark" ? "#fbc02d" : "#333",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    L {p.precio.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Summary Section */}
        <div
          style={{
            flex: 1,
            minWidth: 300,
            background: theme === "lite" ? "#fffde7" : "#232526",
            borderRadius: 16,
            boxShadow:
              theme === "lite"
                ? "0 2px 12px rgba(0,0,0,0.1)"
                : "0 2px 12px #0008",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            color: theme === "lite" ? "#222" : "#f5f5f5",
            transition: "background 0.3s, color 0.3s",
          }}
        >
          <h2
            style={{ color: "#fbc02d", marginBottom: 16, textAlign: "center" }}
          >
            Pedido Actual
          </h2>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fbc02d",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            L {total.toFixed(2)}
          </div>
          {seleccionados.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center" }}>
              No hay productos seleccionados
            </p>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Botones principales arriba de la tabla */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={limpiarSeleccion}
                  style={{
                    background: theme === "lite" ? "#d32f2f" : "#b71c1c",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    opacity: seleccionados.length === 0 ? 0.5 : 1,
                    transition: "background 0.3s",
                  }}
                  disabled={seleccionados.length === 0}
                >
                  Limpiar
                </button>
                <button
                  style={{
                    background: theme === "lite" ? "#1976d2" : "#1565c0",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    opacity: seleccionados.length === 0 ? 0.5 : 1,
                    transition: "background 0.3s",
                  }}
                  disabled={seleccionados.length === 0}
                  onClick={() => {
                    // Validación rápida
                    if (facturaActual === "Límite alcanzado") {
                      alert("¡Límite de facturas alcanzado!");
                      return;
                    }
                    // Abrir modal de ORDEN primero
                    setShowOrdenModal(true);
                  }}
                >
                  Confirmar Pedido
                </button>
                <button
                  style={{
                    background: "#2e7d32",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    marginLeft: 12,
                    opacity: seleccionados.length === 0 ? 0.5 : 1,
                  }}
                  disabled={seleccionados.length === 0}
                  onClick={() => setShowEnvioModal(true)}
                >
                  Pedido por Teléfono
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  padding: "10px 12px",
                  background: theme === "lite" ? "#f5f5f5" : "#424242",
                  borderRadius: "8px 8px 0 0",
                  fontWeight: "bold",
                  fontSize: 13,
                  color: theme === "lite" ? "#666" : "#aaa",
                  marginBottom: 0,
                  borderBottom:
                    theme === "lite" ? "1px solid #e0e0e0" : "1px solid #555",
                }}
              >
                <div style={{ flex: 2 }}>Producto</div>
                <div style={{ flex: 1, textAlign: "center" }}>Precio</div>
                <div style={{ flex: 1, textAlign: "center" }}>Cant.</div>
                <div style={{ flex: 1, textAlign: "right", paddingRight: 8 }}>
                  Total
                </div>
                <div style={{ width: 70, textAlign: "center" }}></div>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  maxHeight: 380,
                  overflowY: "auto",
                  background: theme === "lite" ? "#fff" : "#333",
                  borderRadius: "0 0 8px 8px",
                  border:
                    theme === "lite" ? "1px solid #e0e0e0" : "1px solid #444",
                  borderTop: "none",
                }}
              >
                {seleccionados.map((p, index) => (
                  <li
                    key={p.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      padding: "10px 12px",
                      gap: 8,
                      borderBottom:
                        theme === "lite"
                          ? "1px solid #f0f0f0"
                          : "1px solid #444",
                      background:
                        index % 2 === 0
                          ? theme === "lite"
                            ? "#fff"
                            : "#333"
                          : theme === "lite"
                            ? "#fafafa"
                            : "#383838",
                      color: theme === "lite" ? "#222" : "#f5f5f5",
                    }}
                  >
                    {/* Buttons first for easier reach on touch devices */}
                    <div
                      style={{
                        order: 0,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        width: p.tipo === "comida" ? 108 : 36,
                        flex: p.tipo === "comida" ? "0 0 108px" : "0 0 36px",
                      }}
                    >
                      {p.tipo === "comida" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedProductIndex(index);
                              setShowComplementosModal(true);
                            }}
                            style={{
                              background: "#4caf50",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              width: 32,
                              height: 32,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: 16,
                              lineHeight: 1,
                            }}
                            title="Complementos Incluidos"
                            aria-label={`Complementos de ${p.nombre}`}
                          >
                            🍗
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProductIndex(index);
                              setShowPiezasModal(true);
                            }}
                            style={{
                              background: "#ff9800",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              width: 32,
                              height: 32,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontSize: 16,
                              lineHeight: 1,
                            }}
                            title="Piezas"
                            aria-label={`Piezas de ${p.nombre}`}
                          >
                            🍖
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => eliminarProducto(p.id)}
                        style={{
                          background: "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          width: 32,
                          height: 32,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                        title="Eliminar"
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        −
                      </button>
                    </div>

                    <div
                      style={{
                        order: 1,
                        flex: "2 1 140px",
                        minWidth: 120,
                        fontWeight: 600,
                        fontSize: 14,
                        color: theme === "lite" ? "#1976d2" : "#64b5f6",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.nombre}
                    </div>

                    <div
                      style={{
                        order: 2,
                        flex: "1 0 80px",
                        minWidth: 80,
                        textAlign: "center",
                        fontSize: 13,
                      }}
                    >
                      L {p.precio.toFixed(2)}
                    </div>

                    <div
                      style={{
                        order: 3,
                        flex: "1 0 64px",
                        minWidth: 64,
                        textAlign: "center",
                        fontSize: 13,
                        color: theme === "lite" ? "#388e3c" : "#81c784",
                        fontWeight: 600,
                      }}
                    >
                      x{p.cantidad}
                    </div>

                    <div
                      style={{
                        order: 4,
                        flex: "1 0 90px",
                        minWidth: 90,
                        textAlign: "right",
                        fontWeight: 700,
                        fontSize: 14,
                        paddingRight: 8,
                      }}
                    >
                      L {(p.precio * p.cantidad).toFixed(2)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Modal para seleccionar tipo de ORDEN */}
      {showOrdenModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              padding: 40,
              minWidth: 400,
              maxWidth: 500,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
          >
            <h2
              style={{
                color: "#1976d2",
                marginBottom: 8,
                textAlign: "center",
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              ORDEN
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "#666",
                fontSize: 16,
                margin: 0,
              }}
            >
              Seleccione el tipo de orden
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button
                onClick={() => {
                  setTipoOrden("PARA LLEVAR");
                  setShowOrdenModal(false);
                  setShowClienteModal(true);
                }}
                style={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "#fff",
                  borderRadius: 12,
                  border: "none",
                  padding: "20px 32px",
                  fontWeight: 700,
                  fontSize: 24,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: "0 4px 15px rgba(102,126,234,0.4)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(102,126,234,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 15px rgba(102,126,234,0.4)";
                }}
              >
                PARA LLEVAR
              </button>
              <button
                onClick={() => {
                  setTipoOrden("COMER AQUÍ");
                  setShowOrdenModal(false);
                  setShowClienteModal(true);
                }}
                style={{
                  background:
                    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  color: "#fff",
                  borderRadius: 12,
                  border: "none",
                  padding: "20px 32px",
                  fontWeight: 700,
                  fontSize: 24,
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: "0 4px 15px rgba(245,87,108,0.4)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(245,87,108,0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 15px rgba(245,87,108,0.4)";
                }}
              >
                COMER AQUÍ
              </button>
            </div>
            <button
              onClick={() => setShowOrdenModal(false)}
              style={{
                background: "transparent",
                color: "#999",
                border: "2px solid #ddd",
                borderRadius: 8,
                padding: "12px 24px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Complementos Incluidos */}
      {showComplementosModal && selectedProductIndex !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              padding: 40,
              minWidth: 400,
              maxWidth: 500,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
          >
            <h2
              style={{
                color: "#4caf50",
                marginBottom: 8,
                textAlign: "center",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              🍗 COMPLEMENTOS INCLUIDOS
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "#666",
                fontSize: 14,
                margin: 0,
              }}
            >
              Seleccione las opciones para{" "}
              {seleccionados[selectedProductIndex]?.nombre}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "CON TODO",
                "SIN NADA",
                "SIN SALSAS",
                "SIN REPOLLO",
                "SIN ADEREZO",
                "SIN CEBOLLA",
              ].map((opcion) => {
                const isSelected =
                  seleccionados[selectedProductIndex]?.complementos === opcion;
                return (
                  <button
                    key={opcion}
                    onClick={() => {
                      const newSeleccionados = [...seleccionados];
                      newSeleccionados[selectedProductIndex] = {
                        ...newSeleccionados[selectedProductIndex],
                        complementos: opcion,
                      };
                      setSeleccionados(newSeleccionados);
                    }}
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)"
                        : theme === "lite"
                          ? "#f5f5f5"
                          : "#424242",
                      color: isSelected
                        ? "#fff"
                        : theme === "lite"
                          ? "#222"
                          : "#f5f5f5",
                      borderRadius: 10,
                      border: isSelected
                        ? "3px solid #2e7d32"
                        : "2px solid #ddd",
                      padding: "16px 24px",
                      fontWeight: isSelected ? 700 : 600,
                      fontSize: 16,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: isSelected
                        ? "0 4px 15px rgba(76,175,80,0.4)"
                        : "none",
                    }}
                  >
                    {opcion}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setShowComplementosModal(false);
                setSelectedProductIndex(null);
              }}
              style={{
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Piezas */}
      {showPiezasModal && selectedProductIndex !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 20,
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
              padding: 40,
              minWidth: 400,
              maxWidth: 500,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
          >
            <h2
              style={{
                color: "#ff9800",
                marginBottom: 8,
                textAlign: "center",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              🍖 PIEZAS
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "#666",
                fontSize: 14,
                margin: 0,
              }}
            >
              Seleccione las piezas para{" "}
              {seleccionados[selectedProductIndex]?.nombre}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {["PIEZAS VARIAS", "PECHUGA", "ALA", "CADERA", "PIERNA"].map(
                (pieza) => {
                  const currentPiezas =
                    seleccionados[selectedProductIndex]?.piezas ||
                    "PIEZAS VARIAS";
                  const piezasArray = currentPiezas.split(", ");
                  const isSelected = piezasArray.includes(pieza);

                  return (
                    <button
                      key={pieza}
                      onClick={() => {
                        const newSeleccionados = [...seleccionados];
                        let newPiezas: string[];

                        if (pieza === "PIEZAS VARIAS") {
                          // Si selecciona PIEZAS VARIAS, deseleccionar todo lo demás
                          newPiezas = ["PIEZAS VARIAS"];
                        } else {
                          // Si selecciona otra pieza, quitar PIEZAS VARIAS
                          newPiezas = piezasArray.filter(
                            (p) => p !== "PIEZAS VARIAS",
                          );

                          if (isSelected) {
                            // Deseleccionar
                            newPiezas = newPiezas.filter((p) => p !== pieza);
                            // Si no queda nada, volver a PIEZAS VARIAS
                            if (newPiezas.length === 0) {
                              newPiezas = ["PIEZAS VARIAS"];
                            }
                          } else {
                            // Seleccionar
                            newPiezas.push(pieza);
                          }
                        }

                        newSeleccionados[selectedProductIndex] = {
                          ...newSeleccionados[selectedProductIndex],
                          piezas: newPiezas.join(", "),
                        };
                        setSeleccionados(newSeleccionados);
                      }}
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)"
                          : theme === "lite"
                            ? "#f5f5f5"
                            : "#424242",
                        color: isSelected
                          ? "#fff"
                          : theme === "lite"
                            ? "#222"
                            : "#f5f5f5",
                        borderRadius: 10,
                        border: isSelected
                          ? "3px solid #f57c00"
                          : "2px solid #ddd",
                        padding: "16px 24px",
                        fontWeight: isSelected ? 700 : 600,
                        fontSize: 16,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: isSelected
                          ? "0 4px 15px rgba(255,152,0,0.4)"
                          : "none",
                      }}
                    >
                      {pieza}
                    </button>
                  );
                },
              )}
            </div>
            <button
              onClick={() => {
                setShowPiezasModal(false);
                setSelectedProductIndex(null);
              }}
              style={{
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal para nombre del cliente */}
      {showClienteModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background:
              theme === "lite" ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 16,
              boxShadow:
                theme === "lite"
                  ? "0 8px 32px rgba(25, 118, 210, 0.18)"
                  : "0 8px 32px #0008",
              padding: 32,
              minWidth: 350,
              maxWidth: 420,
              width: "100%",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              color: theme === "lite" ? "#222" : "#f5f5f5",
              transition: "background 0.3s, color 0.3s",
            }}
          >
            <h3 style={{ color: "#1976d2", marginBottom: 12 }}>
              Nombre del Cliente
            </h3>
            <input
              ref={(el) => el?.focus()}
              type="text"
              placeholder="Ingrese el nombre del cliente"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nombreCliente.trim()) {
                  setShowClienteModal(false);
                  setShowPagoModal(true);
                }
              }}
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                marginBottom: 18,
              }}
            />
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button
                onClick={() => setShowClienteModal(false)}
                style={{
                  background: "#9e9e9e",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 20px",
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (nombreCliente.trim()) {
                    setShowClienteModal(false);
                    setShowPagoModal(true); // <-- CAMBIA ESTO
                  }
                }}
                style={{
                  background: "#1976d2",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  padding: "10px 24px",
                  fontWeight: 600,
                  fontSize: 16,
                }}
                disabled={!nombreCliente.trim()}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para envío de pedido */}
      {showEnvioModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#ffffff" : "#1e293b",
              borderRadius: 24,
              padding: 32,
              minWidth: 400,
              maxWidth: 900,
              width: "90%",
              boxShadow:
                theme === "lite"
                  ? "0 20px 60px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)"
                  : "0 20px 60px rgba(0,0,0,0.5)",
              border:
                theme === "lite" ? "1px solid #e2e8f0" : "1px solid #334155",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom:
                  theme === "lite" ? "2px solid #e2e8f0" : "2px solid #334155",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: theme === "lite" ? "#0f172a" : "#f1f5f9",
                    fontSize: 28,
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                  }}
                >
                  📦 Pedido por Teléfono
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    color: theme === "lite" ? "#64748b" : "#94a3b8",
                    fontSize: 14,
                  }}
                >
                  Ingresa los datos del cliente y tipo de pago
                </p>
              </div>
              <button
                onClick={() => setShowEnvioModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme === "lite" ? "#64748b" : "#94a3b8",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 24,
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    theme === "lite" ? "#f1f5f9" : "#334155";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 340px",
                gap: 24,
                alignItems: "start",
              }}
            >
              {/* Form Section */}
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme === "lite" ? "#334155" : "#e2e8f0",
                      marginBottom: 8,
                    }}
                  >
                    Nombre del cliente
                  </label>
                  <input
                    placeholder="Ingrese el nombre completo"
                    value={envioCliente}
                    onChange={(e) => setEnvioCliente(e.target.value)}
                    className="form-input"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: 15,
                      borderRadius: 10,
                      border:
                        theme === "lite"
                          ? "2px solid #e2e8f0"
                          : "2px solid #334155",
                      background: theme === "lite" ? "#ffffff" : "#0f172a",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme === "lite" ? "#334155" : "#e2e8f0",
                      marginBottom: 8,
                    }}
                  >
                    Teléfono
                  </label>
                  <input
                    placeholder="Número de teléfono"
                    value={envioCelular}
                    onChange={(e) => setEnvioCelular(e.target.value)}
                    className="form-input"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: 15,
                      borderRadius: 10,
                      border:
                        theme === "lite"
                          ? "2px solid #e2e8f0"
                          : "2px solid #334155",
                      background: theme === "lite" ? "#ffffff" : "#0f172a",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme === "lite" ? "#334155" : "#e2e8f0",
                      marginBottom: 8,
                    }}
                  >
                    Tipo de pago
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { value: "Efectivo", icon: "💵", color: "#10b981" },
                      { value: "Tarjeta", icon: "💳", color: "#3b82f6" },
                      { value: "Transferencia", icon: "🏦", color: "#8b5cf6" },
                    ].map((tipo) => {
                      const isSelected = envioTipoPago === tipo.value;
                      return (
                        <button
                          key={tipo.value}
                          onClick={() => setEnvioTipoPago(tipo.value as any)}
                          style={{
                            flex: 1,
                            padding: "12px 16px",
                            borderRadius: 10,
                            border: isSelected
                              ? `3px solid ${tipo.color}`
                              : theme === "lite"
                                ? "2px solid #e2e8f0"
                                : "2px solid #334155",
                            background: isSelected
                              ? `${tipo.color}15`
                              : theme === "lite"
                                ? "#ffffff"
                                : "#0f172a",
                            color: isSelected
                              ? tipo.color
                              : theme === "lite"
                                ? "#64748b"
                                : "#94a3b8",
                            fontWeight: isSelected ? 700 : 600,
                            fontSize: 14,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span style={{ fontSize: 24 }}>{tipo.icon}</span>
                          <span>{tipo.value}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme === "lite" ? "#334155" : "#e2e8f0",
                      marginBottom: 8,
                    }}
                  >
                    Costo de envío (L)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={envioCosto}
                    onChange={(e) => setEnvioCosto(e.target.value)}
                    className="form-input"
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      fontSize: 15,
                      borderRadius: 10,
                      border:
                        theme === "lite"
                          ? "2px solid #e2e8f0"
                          : "2px solid #334155",
                      background: theme === "lite" ? "#ffffff" : "#0f172a",
                    }}
                  />
                </div>
              </div>

              {/* Summary Section */}
              <div
                style={{
                  background:
                    theme === "lite"
                      ? "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)"
                      : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow:
                    theme === "lite"
                      ? "0 4px 12px rgba(0,0,0,0.05)"
                      : "0 4px 12px rgba(0,0,0,0.3)",
                  border:
                    theme === "lite"
                      ? "1px solid #e2e8f0"
                      : "1px solid #334155",
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: theme === "lite" ? "#0f172a" : "#f1f5f9",
                    marginBottom: 16,
                    letterSpacing: "-0.3px",
                  }}
                >
                  📋 Resumen del Pedido
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    fontSize: 15,
                    color: theme === "lite" ? "#475569" : "#cbd5e1",
                  }}
                >
                  <div>Subtotal</div>
                  <div style={{ fontWeight: 600 }}>L {total.toFixed(2)}</div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    fontSize: 15,
                    color: theme === "lite" ? "#475569" : "#cbd5e1",
                  }}
                >
                  <div>Costo de envío</div>
                  <div style={{ fontWeight: 600 }}>
                    L {Number(envioCosto || 0).toFixed(2)}
                  </div>
                </div>
                <div
                  style={{
                    height: 2,
                    background: theme === "lite" ? "#e2e8f0" : "#334155",
                    margin: "12px 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 800,
                    fontSize: 20,
                    color: theme === "lite" ? "#0f172a" : "#f1f5f9",
                  }}
                >
                  <div>Total</div>
                  <div>L {(total + Number(envioCosto || 0)).toFixed(2)}</div>
                </div>
                <div
                  style={{
                    marginTop: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => setShowEnvioModal(false)}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      border:
                        theme === "lite"
                          ? "2px solid #e2e8f0"
                          : "2px solid #334155",
                      background: "transparent",
                      color: theme === "lite" ? "#64748b" : "#94a3b8",
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      // Guardar pedido de envío
                      setSavingEnvio(true);
                      try {
                        // determinar caja asignada
                        let cajaAsignada = caiInfo?.caja_asignada;
                        if (!cajaAsignada) {
                          try {
                            const { data: caiData } = await supabase
                              .from("cai_facturas")
                              .select("caja_asignada")
                              .eq("cajero_id", usuarioActual?.id)
                              .single();
                            cajaAsignada = caiData?.caja_asignada || "";
                          } catch (e) {
                            cajaAsignada = "";
                          }
                        }
                        const productos = seleccionados.map((s) => ({
                          id: s.id,
                          nombre: s.nombre,
                          precio: s.precio,
                          cantidad: s.cantidad,
                        }));
                        const registro = {
                          productos,
                          cajero_id: usuarioActual?.id,
                          cajero: usuarioActual?.nombre || "",
                          caja: cajaAsignada || "",
                          fecha_hora: formatToHondurasLocal(),
                          cliente: envioCliente,
                          telefono: envioCelular,
                          direccion: "", // No se captura dirección en este formulario
                          total: Number(total.toFixed(2)),
                          costo_envio: parseFloat(envioCosto || "0"),
                          tipo_pago: envioTipoPago,
                          factura_venta: facturaActual || null,
                        };

                        // PASO 1: Guardar primero en IndexedDB
                        const envioIdLocal = await guardarEnvioLocal(registro);
                        console.log(
                          `✓ Envío guardado en IndexedDB (ID: ${envioIdLocal})`,
                        );

                        // PASO 2: Intentar guardar en Supabase
                        try {
                          const { error } = await supabase
                            .from("pedidos_envio")
                            .insert([registro]);

                          if (error) {
                            console.error(
                              "Error insertando pedido de envío en Supabase:",
                              error,
                            );
                            console.log(
                              "⚠ Envío guardado localmente, se sincronizará después",
                            );
                          } else {
                            // Si se guardó exitosamente en Supabase, eliminar de IndexedDB
                            await eliminarEnvioLocal(envioIdLocal);
                            console.log(
                              "✓ Envío sincronizado y eliminado de IndexedDB",
                            );
                          }
                        } catch (supabaseErr) {
                          console.error(
                            "Error de conexión con Supabase:",
                            supabaseErr,
                          );
                          console.log(
                            "⚠ Envío guardado localmente, se sincronizará cuando haya conexión",
                          );
                        }

                        // Actualizar contador de pendientes
                        const count = await obtenerContadorPendientes();
                        setPendientesCount(count);

                        setLastEnvioSaved(registro);
                        setShowEnvioModal(false);

                        // Imprimir usando la misma plantilla que recibo/comanda (intentar QZ Tray primero)
                        try {
                          const { data: etiquetaConfig } = await supabase
                            .from("etiquetas_config")
                            .select("*")
                            .eq("nombre", "default")
                            .single();
                          const { data: reciboConfig } = await supabase
                            .from("recibo_config")
                            .select("*")
                            .eq("nombre", "default")
                            .single();

                          const comandaHtml = `
                        <div style='font-family:monospace; width:${
                          etiquetaConfig?.etiqueta_ancho || 80
                        }mm; margin:0; padding:${
                          etiquetaConfig?.etiqueta_padding || 8
                        }px;'>
                          <div style='font-size:${
                            etiquetaConfig?.etiqueta_fontsize || 24
                          }px; font-weight:800; color:#000; text-align:center; margin-bottom:10px;'>${
                            etiquetaConfig?.etiqueta_comanda || "COMANDA COCINA"
                          }</div>
                          <div style='font-size:28px; font-weight:900; color:#000; text-align:center; margin:16px 0;'>${tipoOrden}</div>
                          <div style='font-size:20px; font-weight:800; color:#d32f2f; text-align:center; margin:8px 0;'>PEDIDO POR TELÉFONO</div>
                          <div style='font-size:20px; font-weight:800; color:#000; text-align:center; margin-bottom:12px;'>Cliente: <b>${
                            registro.cliente
                          }</b></div>
                          <div style='font-size:14px; font-weight:600; color:#222; text-align:center; margin-bottom:6px;'>Factura: ${
                            facturaActual || ""
                          }</div>
                          
                          ${
                            seleccionados.filter((p) => p.tipo === "comida")
                              .length > 0
                              ? `
                            <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>COMIDAS</div>
                            <ul style='list-style:none; padding:0; margin-bottom:12px;'>
                              ${seleccionados
                                .filter((p) => p.tipo === "comida")
                                .map(
                                  (p) =>
                                    `<li style='font-size:${
                                      etiquetaConfig?.etiqueta_fontsize || 20
                                    }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                                      <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                                        p.cantidad
                                      }x</div>
                                      <div style='font-weight:700;'>${
                                        p.nombre
                                      }</div>
                                      ${
                                        p.complementos
                                          ? `<div style='font-size:14px; margin-top:4px;'><span style='font-weight:700;'>- ${p.complementos}</span></div>`
                                          : ""
                                      }
                                      ${
                                        p.piezas && p.piezas !== "PIEZAS VARIAS"
                                          ? `<div style='font-size:14px; margin-top:2px;'><span style='font-weight:700;'>- ${p.piezas}</span></div>`
                                          : ""
                                      }
                                    </li>`,
                                )
                                .join("")}
                            </ul>
                          `
                              : ""
                          }
                          
                          ${
                            seleccionados.filter(
                              (p) => p.tipo === "complemento",
                            ).length > 0
                              ? `
                            <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>COMPLEMENTOS</div>
                            <ul style='list-style:none; padding:0; margin-bottom:12px;'>
                              ${seleccionados
                                .filter((p) => p.tipo === "complemento")
                                .map(
                                  (p) =>
                                    `<li style='font-size:${
                                      etiquetaConfig?.etiqueta_fontsize || 20
                                    }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                                      <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                                        p.cantidad
                                      }x</div>
                                      <div style='font-weight:700;'>${
                                        p.nombre
                                      }</div>
                                    </li>`,
                                )
                                .join("")}
                            </ul>
                          `
                              : ""
                          }

                          ${
                            seleccionados.filter((p) => p.tipo === "bebida")
                              .length > 0
                              ? `
                            <div style='font-size:18px; font-weight:800; color:#000; margin-top:12px; margin-bottom:8px; padding:6px; background:#f0f0f0; border-radius:4px;'>BEBIDAS</div>
                            <ul style='list-style:none; padding:0; margin-bottom:0;'>
                              ${seleccionados
                                .filter((p) => p.tipo === "bebida")
                                .map(
                                  (p) =>
                                    `<li style='font-size:${
                                      etiquetaConfig?.etiqueta_fontsize || 20
                                    }px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'>
                                      <div style='font-weight:900; font-size:24px; color:#d32f2f;'>${
                                        p.cantidad
                                      }x</div>
                                      <div style='font-weight:700;'>${
                                        p.nombre
                                      }</div>
                                    </li>`,
                                )
                                .join("")}
                            </ul>
                          `
                              : ""
                          }
                        </div>
                      `;

                          // Calcular subtotal e ISV 15% para pedido de envío
                          const subtotalEnvio = registro.productos.reduce(
                            (sum: number, p: any) => {
                              // Asumimos que todos los productos son comida (tipo por defecto)
                              return sum + (p.precio / 1.15) * p.cantidad;
                            },
                            0,
                          );
                          const isv15Envio = registro.productos.reduce(
                            (sum: number, p: any) => {
                              return (
                                sum + (p.precio - p.precio / 1.15) * p.cantidad
                              );
                            },
                            0,
                          );

                          const comprobanteHtml = `
                        <div style='font-family:monospace; width:${
                          reciboConfig?.recibo_ancho || 80
                        }mm; margin:0; padding:${
                          reciboConfig?.recibo_padding || 8
                        }px; background:#fff;'>
                          <!-- Logo -->
                          <div style='text-align:center; margin-bottom:12px;'>
                            <img src='${
                              datosNegocio.logo_url || "/favicon.ico"
                            }' alt='${
                              datosNegocio.nombre_negocio
                            }' style='width:320px; height:320px;' onload='window.imageLoaded = true;' />
                          </div>
                          
                          <!-- Información del Negocio -->
                          <div style='text-align:center; font-size:18px; font-weight:700; margin-bottom:6px;'>${datosNegocio.nombre_negocio.toUpperCase()}</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>${
                            datosNegocio.direccion
                          }</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>RTN: ${
                            datosNegocio.rtn
                          }</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>PROPIETARIO: ${datosNegocio.propietario.toUpperCase()}</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:10px;'>TEL: ${
                            datosNegocio.celular
                          }</div>
                          
                          <div style='border-top:2px solid #000; border-bottom:2px solid #000; padding:6px 0; margin-bottom:10px;'>
                            <div style='text-align:center; font-size:16px; font-weight:700;'>RECIBO DE VENTA</div>
                          </div>
                          
                          <!-- Información del Cliente, Factura y Fecha -->
                          <div style='font-size:14px; margin-bottom:3px;'>Cliente: ${
                            registro.cliente
                          }</div>
                          <div style='font-size:14px; margin-bottom:3px;'>Factura: ${
                            facturaActual || ""
                          }</div>
                          <div style='font-size:14px; margin-bottom:3px;'>Celular: ${
                            registro.telefono || "N/A"
                          }</div>
                          <div style='font-size:14px; margin-bottom:10px;'>Fecha: ${new Date().toLocaleString(
                            "es-HN",
                            { timeZone: "America/Tegucigalpa" },
                          )}</div>
                          
                          <!-- Tabla de Productos -->
                          <div style='border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:10px;'>
                            <table style='width:100%; font-size:14px; border-collapse:collapse;'>
                              <thead>
                                <tr style='border-bottom:1px solid #000;'>
                                  <th style='text-align:left; padding:3px 0;'>CANT</th>
                                  <th style='text-align:left; padding:3px 0;'>DESCRIPCIÓN</th>
                                  <th style='text-align:right; padding:3px 0;'>P.UNIT</th>
                                  <th style='text-align:right; padding:3px 0;'>TOTAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${registro.productos
                                  .map(
                                    (p: any) => `<tr>
                                  <td style='padding:4px 0;'>${p.cantidad}</td>
                                  <td style='padding:4px 0;'>${p.nombre}</td>
                                  <td style='text-align:right; padding:4px 0;'>L${p.precio.toFixed(
                                    2,
                                  )}</td>
                                  <td style='text-align:right; padding:4px 0;'>L${(
                                    p.precio * p.cantidad
                                  ).toFixed(2)}</td>
                                </tr>`,
                                  )
                                  .join("")}
                              </tbody>
                            </table>
                          </div>
                          
                          <!-- Totales -->
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>SUBTOTAL:</span>
                            <span style='float:right; font-weight:700;'>L ${subtotalEnvio.toFixed(
                              2,
                            )}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>ISV 15%:</span>
                            <span style='float:right; font-weight:700;'>L ${isv15Envio.toFixed(
                              2,
                            )}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>COSTO ENVÍO:</span>
                            <span style='float:right; font-weight:700;'>L ${registro.costo_envio.toFixed(
                              2,
                            )}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='border-top:1px solid #000; margin-top:6px; padding-top:6px; font-size:17px; font-weight:700;'>
                            <span style='float:left;'>TOTAL:</span>
                            <span style='float:right;'>L ${(
                              registro.total + registro.costo_envio
                            ).toFixed(2)}</span>
                            <div style='clear:both;'></div>
                          </div>
                          
                          <!-- Mensaje de Agradecimiento -->
                          <div style='text-align:center; margin-top:18px; font-size:15px; font-weight:700; border-top:1px dashed #000; padding-top:10px;'>
                            ¡GRACIAS POR SU COMPRA!
                          </div>
                          <div style='text-align:center; font-size:14px; margin-top:5px;'>
                            Esperamos verle pronto
                          </div>
                        </div>
                      `;

                          const printHtml = `
                        <html>
                          <head>
                            <title>Recibo y Comanda</title>
                            <style>
                              @page { margin: 0; size: auto; }
                              body { margin:0; padding:0; overflow: visible; }
                              * { page-break-inside: avoid; -webkit-print-color-adjust: exact; }
                              @media print { 
                                html, body { height: auto; overflow: visible; }
                                .comanda-break { page-break-before: always; } 
                              }
                            </style>
                          </head>
                          <body>
                            <div>${comprobanteHtml}</div>
                            <div class='comanda-break'>${comandaHtml}</div>
                          </body>
                        </html>
                      `;

                          // Precargar la imagen antes de imprimir
                          const preloadImage = () => {
                            return new Promise((resolve) => {
                              const img = new Image();
                              img.onload = () => resolve(true);
                              img.onerror = () => resolve(false);
                              img.src = datosNegocio.logo_url || "/favicon.ico";
                              setTimeout(() => resolve(false), 2000);
                            });
                          };

                          // Print using browser fallback (QZ Tray integration removed)
                          try {
                            await preloadImage();
                            const printWindow = window.open(
                              "",
                              "",
                              "height=800,width=400",
                            );
                            if (printWindow) {
                              printWindow.document.write(printHtml);
                              printWindow.document.close();
                              printWindow.onload = () => {
                                setTimeout(() => {
                                  printWindow.focus();
                                  printWindow.print();
                                  printWindow.close();
                                }, 500);
                              };
                            }
                          } catch (err) {
                            console.error(
                              "Error imprimiendo pedido de envío:",
                              err,
                            );
                            const printWindow = window.open(
                              "",
                              "",
                              "height=800,width=400",
                            );
                            if (printWindow) {
                              printWindow.document.write(printHtml);
                              printWindow.document.close();
                              printWindow.onload = () => {
                                setTimeout(() => {
                                  printWindow.focus();
                                  printWindow.print();
                                  printWindow.close();
                                }, 500);
                              };
                            }
                          }
                        } catch (err) {
                          console.error(
                            "Error durante impresión de envío:",
                            err,
                          );
                        }
                        // limpiar seleccionados
                        limpiarSeleccion();
                      } catch (e) {
                        console.error(e);
                        alert("Error al guardar pedido de envío");
                      } finally {
                        setSavingEnvio(false);
                      }
                    }}
                    disabled={savingEnvio || !envioCliente || !envioCelular}
                    style={{
                      padding: "14px 24px",
                      borderRadius: 10,
                      border: "none",
                      background:
                        savingEnvio || !envioCliente || !envioCelular
                          ? theme === "lite"
                            ? "#e2e8f0"
                            : "#334155"
                          : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color:
                        savingEnvio || !envioCliente || !envioCelular
                          ? theme === "lite"
                            ? "#94a3b8"
                            : "#64748b"
                          : "#ffffff",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor:
                        savingEnvio || !envioCliente || !envioCelular
                          ? "not-allowed"
                          : "pointer",
                      transition: "all 0.2s",
                      boxShadow:
                        savingEnvio || !envioCliente || !envioCelular
                          ? "none"
                          : "0 4px 12px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    {savingEnvio ? "⏳ Guardando..." : "✓ Guardar Pedido"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de recibo para impresión */}
      {showReceiptModal && lastEnvioSaved && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "#fff",
            zIndex: 100000,
            padding: 24,
            overflow: "auto",
          }}
        >
          <div
            style={{ maxWidth: 480, margin: "0 auto", fontFamily: "monospace" }}
          >
            <h2 style={{ textAlign: "center", margin: 0 }}>{NOMBRE_NEGOCIO}</h2>
            <p style={{ textAlign: "center", marginTop: 4 }}>
              {lastEnvioSaved.fecha}
            </p>
            <hr />
            <div>
              <div>
                <strong>Cajero:</strong> {usuarioActual?.nombre}
              </div>
              <div>
                <strong>Caja:</strong> {lastEnvioSaved.caja}
              </div>
              <div>
                <strong>Cliente:</strong> {lastEnvioSaved.cliente} -{" "}
                {lastEnvioSaved.celular}
              </div>
              <div>
                <strong>Pago:</strong> {lastEnvioSaved.tipo_pago}
              </div>
            </div>
            <hr />
            <div>
              {lastEnvioSaved.productos.map((p: any, idx: number) => (
                <div
                  key={idx}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>
                    {p.nombre} x{p.cantidad}
                  </div>
                  <div>L {(p.precio * p.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <hr />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Subtotal:</div>
              <div>L {lastEnvioSaved.total.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>Costo envío:</div>
              <div>L {lastEnvioSaved.costo_envio.toFixed(2)}</div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                marginTop: 8,
              }}
            >
              <div>Total a pagar:</div>
              <div>
                L{" "}
                {(lastEnvioSaved.total + lastEnvioSaved.costo_envio).toFixed(2)}
              </div>
            </div>
            <hr />
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  window.print();
                }}
                className="btn-primary"
              >
                Imprimir
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                style={{ marginLeft: 12 }}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {showNoConnectionModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
          onClick={() => setShowNoConnectionModal(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              color: theme === "lite" ? "#333" : "#fff",
              borderRadius: 12,
              padding: 32,
              minWidth: 400,
              maxWidth: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 12,
                  color: "#f57c00",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                Sin Conexión a Internet
              </h3>
            </div>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.6,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <strong>El Resumen de Caja</strong> y el{" "}
              <strong>Cierre de Caja</strong> requieren conexión a internet para
              acceder a los datos del servidor.
            </p>
            <div
              style={{
                background: theme === "lite" ? "#f5f5f5" : "#1a1a1a",
                padding: 16,
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <strong>Operaciones disponibles sin conexión:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>Facturación de productos ✓</li>
                <li>Registro de gastos ✓</li>
                <li>Pedidos por teléfono ✓</li>
                <li>Impresión de recibos y comandas ✓</li>
              </ul>
            </div>
            <p
              style={{
                fontSize: 14,
                textAlign: "center",
                color: theme === "lite" ? "#666" : "#aaa",
                marginBottom: 20,
              }}
            >
              Verifica tu conexión a internet e intenta nuevamente.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setShowNoConnectionModal(false)}
                style={{
                  padding: "12px 32px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(25,118,210,0.3)",
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pedidos del cajero */}
      {showPedidosModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120000,
          }}
          onClick={() => setShowPedidosModal(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 16,
              minWidth: 320,
              maxWidth: 820,
              maxHeight: "80vh",
              overflow: "auto",
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Pedidos (últimos)</h3>
              <button
                onClick={() => setShowPedidosModal(false)}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              {pedidosLoading ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  Cargando...
                </div>
              ) : pedidosList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  No hay pedidos.
                </div>
              ) : (
                <div
                  style={{
                    overflowX: "auto",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 14,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#1976d2", color: "#fff" }}>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Fecha
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Cliente
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Teléfono
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          Total
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          Envío
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          Pago
                        </th>
                        <th
                          style={{
                            padding: "12px 16px",
                            textAlign: "center",
                            fontWeight: 600,
                          }}
                        >
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosList.map((p: any, index: number) => (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #eee",
                            background: index % 2 === 0 ? "#fff" : "#f9f9f9",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#e3f2fd")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              index % 2 === 0 ? "#fff" : "#f9f9f9")
                          }
                        >
                          <td style={{ padding: "12px 16px", color: "#444" }}>
                            {p.fecha}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                            {p.cliente}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#666" }}>
                            {p.celular}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "right",
                              fontWeight: 600,
                              color: "#2e7d32",
                            }}
                          >
                            L {Number(p.total || 0).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "right",
                              color: "#666",
                            }}
                          >
                            L {Number(p.costo_envio || 0).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                            }}
                          >
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: 12,
                                fontSize: 12,
                                background:
                                  p.tipo_pago === "Efectivo"
                                    ? "#e8f5e9"
                                    : "#e3f2fd",
                                color:
                                  p.tipo_pago === "Efectivo"
                                    ? "#2e7d32"
                                    : "#1565c0",
                                border: `1px solid ${
                                  p.tipo_pago === "Efectivo"
                                    ? "#c8e6c9"
                                    : "#bbdefb"
                                }`,
                              }}
                            >
                              {p.tipo_pago}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "center",
                              }}
                            >
                              <button
                                onClick={async () => {
                                  if (!confirm("¿Eliminar pedido?")) return;
                                  setPedidosProcessingId(p.id);
                                  try {
                                    const { error } = await supabase
                                      .from("pedidos_envio")
                                      .delete()
                                      .eq("id", p.id);
                                    if (error) throw error;
                                    setPedidosList((prev) =>
                                      prev.filter((x) => x.id !== p.id),
                                    );
                                  } catch (err) {
                                    console.error(
                                      "Error eliminando pedido:",
                                      err,
                                    );
                                    alert("Error eliminando pedido");
                                  } finally {
                                    setPedidosProcessingId(null);
                                  }
                                }}
                                disabled={pedidosProcessingId === p.id}
                                style={{
                                  background: "#ffebee",
                                  color: "#d32f2f",
                                  border: "1px solid #ffcdd2",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#d32f2f";
                                  e.currentTarget.style.color = "#fff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#ffebee";
                                  e.currentTarget.style.color = "#d32f2f";
                                }}
                              >
                                {pedidosProcessingId === p.id
                                  ? "..."
                                  : "Eliminar"}
                              </button>
                              <button
                                onClick={async () => {
                                  if (facturaActual === "Límite alcanzado") {
                                    alert("Límite de facturas alcanzado");
                                    return;
                                  }
                                  if (
                                    !confirm(
                                      "Marcar como entregado y registrar cobro?",
                                    )
                                  )
                                    return;
                                  setPedidosProcessingId(p.id);
                                  try {
                                    const productos = (p.productos || []).map(
                                      (pp: any) => ({
                                        id: pp.id,
                                        nombre: pp.nombre,
                                        precio: pp.precio,
                                        cantidad: pp.cantidad,
                                        tipo: pp.tipo || "comida",
                                      }),
                                    );
                                    const subTotal = productos.reduce(
                                      (sum: number, item: any) => {
                                        if (item.tipo === "comida")
                                          return (
                                            sum +
                                            (item.precio / 1.15) * item.cantidad
                                          );
                                        if (item.tipo === "bebida")
                                          return (
                                            sum +
                                            (item.precio / 1.18) * item.cantidad
                                          );
                                        return (
                                          sum + item.precio * item.cantidad
                                        );
                                      },
                                      0,
                                    );
                                    const isv15 = productos
                                      .filter((it: any) => it.tipo === "comida")
                                      .reduce(
                                        (s: number, it: any) =>
                                          s +
                                          (it.precio - it.precio / 1.15) *
                                            it.cantidad,
                                        0,
                                      );
                                    const isv18 = productos
                                      .filter((it: any) => it.tipo === "bebida")
                                      .reduce(
                                        (s: number, it: any) =>
                                          s +
                                          (it.precio - it.precio / 1.18) *
                                            it.cantidad,
                                        0,
                                      );
                                    const venta = {
                                      fecha_hora: formatToHondurasLocal(),
                                      cajero: usuarioActual?.nombre || "",
                                      caja:
                                        p.caja || caiInfo?.caja_asignada || "",
                                      cai:
                                        caiInfo && caiInfo.cai
                                          ? caiInfo.cai
                                          : "",
                                      factura: facturaActual,
                                      cliente: p.cliente || null,
                                      productos: JSON.stringify(productos),
                                      sub_total: subTotal.toFixed(2),
                                      isv_15: isv15.toFixed(2),
                                      isv_18: isv18.toFixed(2),
                                      total: Number(p.total || 0).toFixed(2),
                                    };
                                    const { error: errFact } = await supabase
                                      .from("facturas")
                                      .insert([venta]);
                                    if (errFact) throw errFact;
                                    const pago = {
                                      tipo: p.tipo_pago || "Efectivo",
                                      monto: Number(p.total || 0),
                                      recibido: Number(p.total || 0),
                                      cambio: 0,
                                      referencia: null,
                                      tarjeta: null,
                                      fecha_hora: formatToHondurasLocal(),
                                      factura: facturaActual,
                                      cajero: usuarioActual?.nombre || null,
                                      cajero_id: usuarioActual?.id || null,
                                      cliente: p.cliente || null,
                                      factura_venta: facturaActual,
                                    };
                                    const { error: errPago } = await supabase
                                      .from("pagos")
                                      .insert([pago]);
                                    if (errPago) throw errPago;
                                    try {
                                      setFacturaActual((prev) =>
                                        prev && prev !== "Límite alcanzado"
                                          ? (parseInt(prev) + 1).toString()
                                          : prev,
                                      );
                                    } catch {}
                                    const { error: errDel } = await supabase
                                      .from("pedidos_envio")
                                      .delete()
                                      .eq("id", p.id);
                                    if (errDel) throw errDel;
                                    setPedidosList((prev) =>
                                      prev.filter((x) => x.id !== p.id),
                                    );
                                  } catch (err) {
                                    console.error(
                                      "Error procesando entrega y cobro:",
                                      err,
                                    );
                                    alert("Error procesando entrega y cobro");
                                  } finally {
                                    setPedidosProcessingId(null);
                                  }
                                }}
                                disabled={pedidosProcessingId === p.id}
                                style={{
                                  background: "#e8f5e9",
                                  color: "#2e7d32",
                                  border: "1px solid #a5d6a7",
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "#2e7d32";
                                  e.currentTarget.style.color = "#fff";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "#e8f5e9";
                                  e.currentTarget.style.color = "#2e7d32";
                                }}
                              >
                                {pedidosProcessingId === p.id
                                  ? "..."
                                  : "Entregado y Cobrado"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Gasto */}
      {showRegistrarGasto && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120000,
          }}
          onClick={() => cerrarRegistrarGasto()}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 20,
              minWidth: 320,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#d32f2f" }}>Registrar gasto</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="number"
                step="0.01"
                placeholder="Monto"
                value={gastoMonto}
                onChange={(e) => setGastoMonto(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Motivo"
                value={gastoMotivo}
                onChange={(e) => setGastoMotivo(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
              />
              <input
                type="text"
                placeholder="Número de factura (opcional)"
                value={gastoFactura}
                onChange={(e) => setGastoFactura(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                onClick={() => cerrarRegistrarGasto()}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#9e9e9e",
                  color: "#fff",
                  cursor: "pointer",
                }}
                disabled={guardandoGasto}
              >
                Cancelar
              </button>
              <button
                onClick={() => guardarGasto()}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#d32f2f",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
                disabled={guardandoGasto}
              >
                {guardandoGasto ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito tras registrar gasto */}
      {showGastoSuccess && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 130000,
          }}
          onClick={() => setShowGastoSuccess(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 20,
              minWidth: 300,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#388e3c" }}>Éxito</h3>
            <p style={{ marginTop: 8 }}>{gastoSuccessMessage}</p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setShowGastoSuccess(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Devolución */}
      {showDevolucionModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120000,
          }}
          onClick={() => {
            setShowDevolucionModal(false);
            setDevolucionFactura("");
            setDevolucionData(null);
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 24,
              minWidth: 400,
              maxWidth: 600,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#ff9800" }}>
              Devolución de Factura
            </h3>

            {/* Paso 1: Buscar factura */}
            {!devolucionData && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  type="text"
                  placeholder="Número de factura"
                  value={devolucionFactura}
                  onChange={(e) => setDevolucionFactura(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") buscarFacturaDevolucion();
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 16,
                  }}
                  autoFocus
                />
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                    marginTop: 8,
                  }}
                >
                  <button
                    onClick={() => {
                      setShowDevolucionModal(false);
                      setDevolucionFactura("");
                      setDevolucionData(null);
                    }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#9e9e9e",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 15,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={buscarFacturaDevolucion}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#1976d2",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                    disabled={devolucionBuscando}
                  >
                    {devolucionBuscando ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>
            )}

            {/* Paso 2: Mostrar datos y confirmar */}
            {devolucionData && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    background: theme === "lite" ? "#f5f5f5" : "#1a1a1a",
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <strong>Factura:</strong> {devolucionData.factura.factura}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Cliente:</strong> {devolucionData.factura.cliente}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Monto:</strong> L{" "}
                    {parseFloat(devolucionData.factura.total || 0).toFixed(2)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Fecha:</strong>{" "}
                    {devolucionData.factura.fecha_hora
                      ? new Date(
                          devolucionData.factura.fecha_hora,
                        ).toLocaleString("es-HN")
                      : "N/A"}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
                    <strong>Pagos registrados:</strong>{" "}
                    {devolucionData.pagos.length}
                  </div>
                </div>

                <div
                  style={{
                    background: "#fff3cd",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #ffc107",
                    color: "#856404",
                    fontSize: 13,
                  }}
                >
                  ⚠️ Esta acción registrará una devolución con valores negativos
                  en las tablas de facturas y pagos.
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                    marginTop: 8,
                  }}
                >
                  <button
                    onClick={() => {
                      setDevolucionData(null);
                      setDevolucionFactura("");
                    }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#9e9e9e",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 15,
                    }}
                  >
                    Volver
                  </button>
                  <button
                    onClick={() => setShowDevolucionPasswordModal(true)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#ff9800",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    Realizar Devolución
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de contraseña para devolución */}
      {showDevolucionPasswordModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 130000,
          }}
          onClick={() => {
            setShowDevolucionPasswordModal(false);
            setDevolucionPassword("");
          }}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#d32f2f" }}>
              Confirmar con contraseña
            </h3>
            <p style={{ fontSize: 14, marginBottom: 16 }}>
              Ingrese su contraseña para autorizar la devolución
            </p>
            <input
              type="password"
              placeholder="Contraseña"
              value={devolucionPassword}
              onChange={(e) => setDevolucionPassword(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && devolucionPassword.trim()) {
                  // Validar contraseña y procesar
                  const esValida =
                    await validarPasswordCajero(devolucionPassword);
                  if (esValida) {
                    procesarDevolucion();
                  } else {
                    alert("Contraseña incorrecta");
                    setDevolucionPassword("");
                  }
                }
              }}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                marginBottom: 16,
              }}
              autoFocus
            />
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => {
                  setShowDevolucionPasswordModal(false);
                  setDevolucionPassword("");
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#9e9e9e",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 15,
                }}
                disabled={devolucionProcesando}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const esValida =
                    await validarPasswordCajero(devolucionPassword);
                  if (esValida) {
                    procesarDevolucion();
                  } else {
                    alert("Contraseña incorrecta");
                    setDevolucionPassword("");
                  }
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#d32f2f",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 15,
                }}
                disabled={devolucionProcesando || !devolucionPassword.trim()}
              >
                {devolucionProcesando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de error de devolución */}
      {showDevolucionError && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 140000,
          }}
          onClick={() => setShowDevolucionError(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 12,
              }}
            >
              ⚠️
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: "#d32f2f" }}>
              Factura no encontrada
            </h3>
            <p style={{ marginBottom: 20, fontSize: 14 }}>
              La factura no existe o no pertenece a este cajero
            </p>
            <button
              onClick={() => setShowDevolucionError(false)}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#1976d2",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de éxito de devolución */}
      {showDevolucionSuccess && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 140000,
          }}
          onClick={() => setShowDevolucionSuccess(false)}
        >
          <div
            style={{
              background: theme === "lite" ? "#fff" : "#232526",
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: "0 8px 32px #0003",
              color: theme === "lite" ? "#222" : "#f5f5f5",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 12,
              }}
            >
              ✅
            </div>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: "#388e3c" }}>
              Devolución exitosa
            </h3>
            <p style={{ marginBottom: 20, fontSize: 14 }}>
              La devolución ha sido procesada correctamente
            </p>
            <button
              onClick={() => setShowDevolucionSuccess(false)}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#388e3c",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modal para requerir factura */}
      {/* Eliminado el modal de confirmación de factura */}

      {/* Indicador de estado de conexión y sincronización - fijo arriba a la derecha */}
      <div
        style={{
          position: "fixed",
          top: 10,
          right: 18,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 12000,
          alignItems: "flex-end",
        }}
      >
        {/* Indicador de conexión */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: isOnline
              ? "rgba(76, 175, 80, 0.9)"
              : "rgba(244, 67, 54, 0.9)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#fff",
              animation: isOnline ? "none" : "pulse 2s infinite",
            }}
          />
          {isOnline ? "Conectado" : "Sin conexión"}
        </div>

        {/* Indicador de registros pendientes */}
        {(pendientesCount.facturas > 0 ||
          pendientesCount.pagos > 0 ||
          pendientesCount.gastos > 0 ||
          pendientesCount.envios > 0) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "8px 12px",
              background: "rgba(255, 152, 0, 0.9)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              cursor: "pointer",
              maxWidth: 200,
            }}
            onClick={sincronizarManualmente}
            title="Click para sincronizar manualmente"
          >
            <div>⚠ Pendientes de sync:</div>
            {pendientesCount.facturas > 0 && (
              <div>📋 {pendientesCount.facturas} factura(s)</div>
            )}
            {pendientesCount.pagos > 0 && (
              <div>💳 {pendientesCount.pagos} pago(s)</div>
            )}
            {pendientesCount.gastos > 0 && (
              <div>💰 {pendientesCount.gastos} gasto(s)</div>
            )}
            {pendientesCount.envios > 0 && (
              <div>📦 {pendientesCount.envios} envío(s)</div>
            )}
            {sincronizando && <div>🔄 Sincronizando...</div>}
          </div>
        )}
      </div>

      {/* Botón Cerrar Sesión - fijo abajo a la derecha */}
      <button
        onClick={() => setShowCerrarSesionModal(true)}
        style={{
          position: "fixed",
          bottom: 10,
          right: 18,
          background: "transparent",
          border: "none",
          color: "#d32f2f",
          fontSize: 12,
          textDecoration: "underline",
          cursor: "pointer",
          padding: 0,
          zIndex: 12000,
          fontWeight: 700,
        }}
        title="Cerrar sesión"
      >
        Cerrar Sesión
      </button>

      {/* Modal de confirmación para cerrar sesión */}
      {showCerrarSesionModal && (
        <div
          onClick={() => setShowCerrarSesionModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#1976d2" }}>
              ¿Cerrar Sesión?
            </h3>
            <p style={{ margin: "0 0 24px 0", color: "#666" }}>
              ¿Estás seguro de que deseas cerrar sesión?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setShowCerrarSesionModal(false)}
                style={{
                  padding: "10px 24px",
                  background: "#e0e0e0",
                  color: "#333",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("usuario");
                  window.location.href = "/login";
                }}
                style={{
                  padding: "10px 24px",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
