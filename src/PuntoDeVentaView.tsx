import { useEffect, useState } from "react";
import PagoModal from "./PagoModal";
import RegistroCierreView from "./RegistroCierreView";
import { supabase } from "./supabaseClient";
import { getLocalDayRange, formatToHondurasLocal } from "./utils/fechas";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
  tipo: "comida" | "bebida";
  tipo_impuesto?: string;
  imagen?: string;
}

interface Seleccion {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  tipo: "comida" | "bebida";
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
      | "cajaOperada"
  ) => void;
}) {
  const [showCierre, setShowCierre] = useState(false);
  const [showResumen, setShowResumen] = useState(false);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenData, setResumenData] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    gastos: number;
  } | null>(null);

  // Función para obtener resumen de caja del día (EFECTIVO/TARJETA/TRANSFERENCIA)
  async function fetchResumenCaja() {
    setShowResumen(true);
    setResumenLoading(true);
    try {
      const { start, end, day } = getLocalDayRange();
      const [
        { data: pagosEfectivo },
        { data: pagosTarjeta },
        { data: pagosTrans },
        { data: gastosDia },
      ] = await Promise.all([
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "Efectivo")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "Tarjeta")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        supabase
          .from("pagos")
          .select("monto")
          .eq("tipo", "Transferencia")
          .eq("cajero_id", usuarioActual?.id)
          .gte("fecha_hora", start)
          .lte("fecha_hora", end),
        // Obtener gastos del día: la tabla 'gastos' tiene columna DATE, usar igualdad por día
        // Filtrar por cajero_id y caja asignada para que el resumen sea por este cajero/caja
        (async () => {
          // Determinar caja asignada
          let cajaAsignada = caiInfo?.caja_asignada;
          if (!cajaAsignada) {
            const { data: caiData } = await supabase
              .from("cai_facturas")
              .select("caja_asignada")
              .eq("cajero_id", usuarioActual?.id)
              .single();
            cajaAsignada = caiData?.caja_asignada || "";
          }
          if (!cajaAsignada) return Promise.resolve({ data: [] });
          return supabase
            .from("gastos")
            .select("monto")
            .eq("fecha", day)
            .eq("cajero_id", usuarioActual?.id)
            .eq("caja", cajaAsignada);
        })(),
      ]);

      const efectivoSum = (pagosEfectivo || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0
      );
      const tarjetaSum = (pagosTarjeta || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0
      );
      const transSum = (pagosTrans || []).reduce(
        (s: number, p: any) => s + parseFloat(p.monto || 0),
        0
      );

      const gastosSum = (gastosDia || []).reduce(
        (s: number, g: any) => s + parseFloat(g.monto || 0),
        0
      );

      setResumenData({ efectivo: efectivoSum, tarjeta: tarjetaSum, transferencia: transSum, gastos: gastosSum });
    } catch (err) {
      console.error("Error al obtener resumen de caja:", err);
      setResumenData({ efectivo: 0, tarjeta: 0, transferencia: 0, gastos: 0 });
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
  const [facturaActual, setFacturaActual] = useState<string>("");
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  // Modal para envíos de pedido
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [envioCliente, setEnvioCliente] = useState("");
  const [envioCelular, setEnvioCelular] = useState("");
  const [envioTipoPago, setEnvioTipoPago] = useState<"Efectivo" | "Tarjeta" | "Transferencia">("Efectivo");
  const [envioCosto, setEnvioCosto] = useState<string>("0");
  const [savingEnvio, setSavingEnvio] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastEnvioSaved, setLastEnvioSaved] = useState<any>(null);
  const [showNoConnectionModal, setShowNoConnectionModal] = useState(false);
  // Modal para registrar gasto
  const [showRegistrarGasto, setShowRegistrarGasto] = useState(false);
  // Modal para listar pedidos del cajero
  const [showPedidosModal, setShowPedidosModal] = useState(false);
  const [pedidosList, setPedidosList] = useState<any[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosProcessingId, setPedidosProcessingId] = useState<number | null>(null);
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
  const [gastoSuccessMessage, setGastoSuccessMessage] = useState<string>("");
  const [checkingFactura, setCheckingFactura] = useState(false);
  // Eliminado showFacturaModal
  const [nombreCliente, setNombreCliente] = useState("");
  const [caiInfo, setCaiInfo] = useState<{
    caja_asignada: string;
    nombre_cajero: string;
    cai: string;
  } | null>(null);
  const online = navigator.onLine;
  // QZ Tray removed: no states for qz/printer connection

  const [productos, setProductos] = useState<Producto[]>([]);
  const [seleccionados, setSeleccionados] = useState<Seleccion[]>([]);
  // Cargar seleccionados desde localStorage al iniciar
  useEffect(() => {
    const stored = localStorage.getItem("seleccionados");
    if (stored) {
      try {
        setSeleccionados(JSON.parse(stored));
      } catch { }
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"comida" | "bebida">("comida");

  // Obtener datos de CAI y factura actual
  useEffect(() => {
    async function fetchCaiYFactura() {
      if (!usuarioActual) return;
      const { data: caiData } = await supabase
        .from("cai_facturas")
        .select("*")
        .eq("cajero_id", usuarioActual.id)
        .single();
      if (caiData) {
        setCaiInfo({
          caja_asignada: caiData.caja_asignada,
          nombre_cajero: usuarioActual.nombre,
          cai: caiData.cai,
        });
        const rango_inicio = parseInt(caiData.rango_desde);
        const rango_fin = parseInt(caiData.rango_hasta);
        const caja = caiData.caja_asignada;
        const { data: facturasData } = await supabase
          .from("facturas")
          .select("factura")
          .eq("cajero", usuarioActual.nombre)
          .eq("caja", caja);
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
    }
    fetchCaiYFactura();
  }, []);

  // Consultar cierre de la fecha actual y redirigir según diferencia/observacion
  useEffect(() => {
    async function consultarCierreYRedirigir() {
      if (!setView || !usuarioActual) return;
      // Consultar el cierre de hoy para este cajero y caja usando rango local
      const { start, end } = getLocalDayRange();
      // Obtener caja asignada
      let cajaAsignada = caiInfo?.caja_asignada;
      if (!cajaAsignada) {
        // Si no está en caiInfo, buscar en cai_facturas
        const { data: caiData } = await supabase
          .from("cai_facturas")
          .select("caja_asignada")
          .eq("cajero_id", usuarioActual.id)
          .single();
        cajaAsignada = caiData?.caja_asignada || "";
      }
      if (!cajaAsignada) return;
      const { data: cierresHoy } = await supabase
        .from("cierres")
        .select("diferencia, observacion")
        .eq("tipo_registro", "cierre")
        .eq("cajero", usuarioActual?.nombre)
        .eq("caja", cajaAsignada)
        .gte("fecha", start)
        .lte("fecha", end);
      if (cierresHoy && cierresHoy.length > 0) {
        const cierre = cierresHoy[0];
        if (cierre.diferencia !== 0 && cierre.observacion === "sin aclarar") {
          setView("resultadosCaja");
        } else if (
          cierre.diferencia !== 0 &&
          cierre.observacion === "aclarado"
        ) {
          setView("cajaOperada");
        } else if (
          cierre.diferencia === 0 &&
          cierre.observacion === "cuadrado"
        ) {
          setView("cajaOperada");
        } else {
          setView("resultadosCaja");
        }
      }
    }
    consultarCierreYRedirigir();
    // Solo ejecutar al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los modales se deben renderizar dentro del return principal

  // Fetch products from Supabase
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const { data, error } = await supabase.from("productos").select("*");
        if (error) throw error;
        setProductos(data);
        setLoading(false);
      } catch (err) {
        setError("Error al cargar productos");
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

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
          p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
        );
      } else {
        nuevos = [...prev, { ...producto, cantidad: 1, tipo: producto.tipo }];
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
        return prev.map((p) =>
          p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p
        );
      }
      return prev.filter((p) => p.id !== id);
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
      const motivoCompleto = gastoMotivo.trim() + (gastoFactura ? ` | Factura: ${gastoFactura.trim()}` : "");
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

      const { error } = await supabase.from("gastos").insert([
        {
          fecha,
          monto: montoNum,
          motivo: motivoCompleto,
          cajero_id: usuarioActual?.id,
          caja: cajaAsignada,
        },
      ]);
      if (error) {
        console.error("Error guardando gasto:", error);
        alert("Error al guardar gasto. Revisa la consola.");
      } else {
        // éxito: cerrar y resetear modal de formulario y mostrar modal de éxito
        cerrarRegistrarGasto();
        setGastoSuccessMessage("Gasto registrado correctamente");
        setShowGastoSuccess(true);
        // opcional: navegar a la vista de gastos si se desea
        // if (setView) setView("gastos");
      }
    } catch (err) {
      console.error("Error guardando gasto:", err);
      alert("Error al guardar gasto. Revisa la consola.");
    } finally {
      setGuardandoGasto(false);
    }
  };

  // Calculate total
  const total = seleccionados.reduce(
    (sum, p) => sum + p.precio * p.cantidad,
    0
  );

  // Filter products by type
  const productosFiltrados = productos.filter((p) => p.tipo === activeTab);

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
      `}</style>
      {/* Indicador de conexión */}
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
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: online ? "#43a047" : "#d32f2f",
            border: "2px solid #fff",
            boxShadow: "0 0 4px #0002",
            display: "inline-block",
          }}
        />
        <span
          style={{
            color: online ? "#43a047" : "#d32f2f",
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: 'nowrap'
          }}
        >
          {online ? "Conectado" : "Sin conexión"}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginLeft: 12,
            color: online ? "#43a047" : "#d32f2f",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "48vw",
            display: "inline-block",
          }}
          title={caiInfo ? `${caiInfo.nombre_cajero} | Caja: ${caiInfo.caja_asignada}${facturaActual ? ` | Factura: ${facturaActual}` : ''}` : facturaActual ? `Factura: ${facturaActual}` : ''}
        >
          {caiInfo && `${caiInfo.nombre_cajero} | Caja: ${caiInfo.caja_asignada}`}
          {caiInfo && facturaActual ? ` | Factura: ${facturaActual}` : (!caiInfo && facturaActual ? `Factura: ${facturaActual}` : "")}
        </span>
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
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              minWidth: 300,
              boxShadow: "0 8px 32px #0003",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#1976d2" }}>Resumen de caja</h3>
            {resumenLoading ? (
              <div style={{ padding: 12 }}>Cargando...</div>
            ) : resumenData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <strong>EFECTIVO:</strong> {(resumenData.efectivo - resumenData.gastos).toFixed(2)}
                </div>
                <div>
                  <strong>TARJETA:</strong> {resumenData.tarjeta.toFixed(2)}
                </div>
                <div>
                  <strong>TRANSFERENCIA:</strong> {resumenData.transferencia.toFixed(2)}
                </div>
                <div>
                  <strong>GASTOS:</strong> {resumenData.gastos.toFixed(2)}
                </div>
              </div>
            ) : (
              <div>No hay datos</div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
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

      {/* Botón cerrar sesión, volver y interruptor de tema */}
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
        {/* Interruptor de tema moderno */}
        <button
          onClick={() => {
            const next = theme === "lite" ? "dark" : "lite";
            setTheme(next);
            localStorage.setItem("theme", next);
          }}
          style={{
            background: theme === "dark" ? "#222" : "#eee",
            border: "2px solid #1976d2",
            borderRadius: 20,
            width: 54,
            height: 28,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.3s",
            marginRight: 8,
          }}
          title={theme === "lite" ? "Modo oscuro" : "Modo claro"}
        >
          <span
            style={{
              position: "absolute",
              left: theme === "lite" ? 4 : 26,
              top: 4,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: theme === "dark" ? "#1976d2" : "#fbc02d",
              boxShadow: "0 2px 6px #0002",
              transition: "left 0.3s, background 0.3s",
              display: "block",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 6,
              top: 6,
              fontSize: 14,
              color: theme === "dark" ? "#fff" : "#222",
              fontWeight: 700,
              opacity: theme === "dark" ? 1 : 0.5,
            }}
          >
            🌙
          </span>
          <span
            style={{
              position: "absolute",
              left: 6,
              top: 6,
              fontSize: 14,
              color: theme === "lite" ? "#fbc02d" : "#fff",
              fontWeight: 700,
              opacity: theme === "lite" ? 1 : 0.5,
            }}
          >
            ☀️
          </span>
        </button>
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
        {/* Botón para registrar cierre de caja */}
        <button
          style={{
            background: "#fbc02d",
            color: "#333",
            border: "none",
            borderRadius: 8,
            padding: "10px 22px",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 2px 8px #fbc02d44",
          }}
          onClick={() => setShowCierre(true)}
        >
          Registrar cierre de caja
        </button>
        {/* Botón visible de Resumen de caja debajo del botón 'Registrar cierre de caja' */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button
            style={{
              fontSize: 16,
              padding: "10px 22px",
              borderRadius: 8,
              background: "#1976d2",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => fetchResumenCaja()}
          >
            Resumen de caja
          </button>
        </div>

        {/* Botón Registrar gasto debajo del Resumen de caja: abre modal */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button
            onClick={() => {
              // Abrir modal de gasto sin prellenar número de factura (entrada manual)
              cerrarRegistrarGasto();
              setShowRegistrarGasto(true);
            }}
            style={{
              fontSize: 16,
              padding: "10px 22px",
              borderRadius: 8,
              background: theme === "lite" ? "rgba(211,47,47,0.95)" : "rgba(183,28,28,0.95)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              opacity: 0.95,
            }}
          >
            Registrar gasto
          </button>
          <button
            onClick={async () => {
              // Abrir modal de pedidos del cajero
              setShowPedidosModal(true);
              setPedidosLoading(true);
              try {
                const { data, error } = await supabase
                  .from('pedidos_envio')
                  .select('*')
                  .eq('cajero_id', usuarioActual?.id)
                  .order('created_at', { ascending: false })
                  .limit(100);
                if (!error) setPedidosList(data || []);
                else {
                  console.error('Error cargando pedidos:', error);
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
              fontSize: 16,
              padding: '10px 22px',
              borderRadius: 8,
              background: '#388e3c',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              marginLeft: 12,
            }}
          >
            Pedidos
          </button>
        </div>

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
              onCierreGuardado={async () => {
                if (!setView) return;
                // Consultar el cierre de hoy para este cajero y caja usando rango local
                const { start, end } = getLocalDayRange();
                const { data: cierresHoy } = await supabase
                  .from("cierres")
                  .select("diferencia, observacion")
                  .eq("tipo_registro", "cierre")
                  .eq("cajero", usuarioActual?.nombre)
                  .eq("caja", caiInfo?.caja_asignada || "")
                  .gte("fecha", start)
                  .lte("fecha", end);
                if (cierresHoy && cierresHoy.length > 0) {
                  const cierre = cierresHoy[0];
                  if (cierre.diferencia !== 0 && cierre.observacion === "sin aclarar") {
                    setView("resultadosCaja");
                  } else if (cierre.diferencia !== 0 && cierre.observacion === "aclarado") {
                    setView("cajaOperada");
                  } else if (cierre.diferencia === 0 && cierre.observacion === "cuadrado") {
                    setView("cajaOperada");
                  } else {
                    setView("resultadosCaja");
                  }
                } else {
                  setView("resultadosCaja");
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
        factura={facturaActual}
        totalPedido={total}
        cliente={nombreCliente}
        factura_venta={facturaActual}
        onPagoConfirmado={async () => {
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
              <div style='font-family:monospace; width:${etiquetaConfig?.etiqueta_ancho || 80
              }mm; margin:0; padding:${etiquetaConfig?.etiqueta_padding || 8
              }px;'>
                <div style='font-size:${etiquetaConfig?.etiqueta_fontsize || 24
              }px; font-weight:800; color:#000; text-align:center; margin-bottom:6px;'>${etiquetaConfig?.etiqueta_comanda || "COMANDA COCINA"
              }</div>
                <div style='font-size:20px; font-weight:800; color:#000; text-align:center; margin-bottom:12px;'>Cliente: <b>${nombreCliente}</b></div>
                <div style='font-size:14px; font-weight:600; color:#222; text-align:center; margin-bottom:6px;'>Factura: ${facturaActual || ''}</div>
                <ul style='list-style:none; padding:0; margin-bottom:0;'>
                  ${seleccionados
                .filter((p) => p.tipo === "comida")
                .map(
                  (p) =>
                    `<li style='font-size:${etiquetaConfig?.etiqueta_fontsize || 20}px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'><div style="display:flex; justify-content:space-between; align-items:center;"><span style='font-weight:700;'>${p.nombre}</span><span>L ${p.precio.toFixed(2)} x${p.cantidad}</span></div></li>`
                )
                .join("")}
                </ul>
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
              .reduce((sum, p) => sum + (p.precio - p.precio / 1.15) * p.cantidad, 0);

            const comprobanteHtml = `
              <div style='font-family:monospace; width:${reciboConfig?.recibo_ancho || 80
              }mm; margin:0; padding:${reciboConfig?.recibo_padding || 8}px; background:#fff;'>
                <!-- Logo -->
                <div style='text-align:center; margin-bottom:12px;'>
                  <img src='/favicon.ico' alt='POLLOS CESAR' style='width:320px; height:320px;' onload='window.imageLoaded = true;' />
                </div>
                
                <!-- Información del Negocio -->
                <div style='text-align:center; font-size:18px; font-weight:700; margin-bottom:6px;'>POLLOS CESAR</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>ISLAS DE LA BAHÍA, SANDY BAY</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>BO. LA UVA</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>RTN: 18071993019392</div>
                <div style='text-align:center; font-size:14px; margin-bottom:3px;'>PROPIETARIO: CESAR BENIGNO VEGA CANELAS</div>
                <div style='text-align:center; font-size:14px; margin-bottom:10px;'>TEL: 32841306</div>
                
                <div style='border-top:2px solid #000; border-bottom:2px solid #000; padding:6px 0; margin-bottom:10px;'>
                  <div style='text-align:center; font-size:16px; font-weight:700;'>RECIBO DE VENTA</div>
                </div>
                
                <!-- Información del Cliente, Factura y Fecha -->
                <div style='font-size:14px; margin-bottom:3px;'>Cliente: ${nombreCliente}</div>
                <div style='font-size:14px; margin-bottom:3px;'>Factura: ${facturaActual || ''}</div>
                <div style='font-size:14px; margin-bottom:10px;'>Fecha: ${new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })}</div>
                
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
                              <td style='text-align:right; padding:4px 0;'>L${p.precio.toFixed(2)}</td>
                              <td style='text-align:right; padding:4px 0;'>L${(p.precio * p.cantidad).toFixed(2)}</td>
                            </tr>`
                )
                .join("")}
                    </tbody>
                  </table>
                </div>
                
                <!-- Totales -->
                <div style='font-size:15px; margin-bottom:3px;'>
                  <span style='float:left;'>SUBTOTAL:</span>
                  <span style='float:right; font-weight:700;'>L ${subtotalRecibo.toFixed(2)}</span>
                  <div style='clear:both;'></div>
                </div>
                <div style='font-size:15px; margin-bottom:3px;'>
                  <span style='float:left;'>ISV 15%:</span>
                  <span style='float:right; font-weight:700;'>L ${isv15Recibo.toFixed(2)}</span>
                  <div style='clear:both;'></div>
                </div>
                <div style='border-top:1px solid #000; margin-top:6px; padding-top:6px; font-size:17px; font-weight:700;'>
                  <span style='float:left;'>TOTAL:</span>
                  <span style='float:right;'>L ${total.toFixed(2)}</span>
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
            // Unir ambos con salto de página
            const printHtml = `
              <html>
                <head>
                  <title>Recibo y Comanda</title>
                  <style>
                    @media print {
                      .page-break { page-break-after: always; }
                    }
                  </style>
                </head>
                <body>
                  <div>${comprobanteHtml}</div>
                  <div class="page-break"></div>
                  <div>${comandaHtml}</div>
                </body>
              </html>
            `;

            // Precargar la imagen antes de imprimir
            const preloadImage = () => {
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false); // Continuar aunque falle
                img.src = '/favicon.ico';
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
                  0
                );
              const isv18 = seleccionados
                .filter((p) => p.tipo === "bebida")
                .reduce(
                  (sum, p) => sum + (p.precio - p.precio / 1.18) * p.cantidad,
                  0
                );
              if (facturaActual === "Límite alcanzado") {
                alert(
                  "¡Se ha alcanzado el límite de facturas para este cajero!"
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
                  }))
                ),
                sub_total: subTotal.toFixed(2),
                isv_15: isv15.toFixed(2),
                isv_18: isv18.toFixed(2),
                total: seleccionados
                  .reduce((sum, p) => sum + p.precio * p.cantidad, 0)
                  .toFixed(2),
              };
              await supabase.from("facturas").insert([venta]);
              // Actualizar el número de factura actual en la vista
              if (facturaActual !== "Límite alcanzado") {
                setFacturaActual((parseInt(facturaActual) + 1).toString());
              }
            } catch (err) {
              console.error("Error al guardar la venta:", err);
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
      >
      
      </h1>
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
          {/* Tabs for Comida/Bebida */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              borderBottom: "2px solid #e0e0e0",
            }}
          >
            <button
              onClick={() => setActiveTab("comida")}
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
              onClick={() => setActiveTab("bebida")}
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

          {/* Product Grid */}
          {loading ? (
            <p style={{ textAlign: "center" }}>Cargando...</p>
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
                        width: '100%',
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
                      color: activeTab === "comida" ? "#388e3c" : "#1976d2",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    {p.nombre}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: theme === 'dark' ? '#fbc02d' : '#333',
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                padding: '10px 12px',
                background: theme === 'lite' ? '#f5f5f5' : '#424242',
                borderRadius: '8px 8px 0 0',
                fontWeight: 'bold',
                fontSize: 13,
                color: theme === 'lite' ? '#666' : '#aaa',
                marginBottom: 0,
                borderBottom: theme === 'lite' ? '1px solid #e0e0e0' : '1px solid #555'
              }}>
                <div style={{ flex: 2 }}>Producto</div>
                <div style={{ flex: 1, textAlign: 'center' }}>Precio</div>
                <div style={{ flex: 1, textAlign: 'center' }}>Cant.</div>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: 8 }}>Total</div>
                <div style={{ width: 70, textAlign: 'center' }}></div>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  flex: 1,
                  overflowY: "auto",
                  background: theme === 'lite' ? '#fff' : '#333',
                  borderRadius: '0 0 8px 8px',
                  border: theme === 'lite' ? '1px solid #e0e0e0' : '1px solid #444',
                  borderTop: 'none'
                }}
              >
                {seleccionados.map((p, index) => (
                  <li
                    key={p.id}
                    style={{
                      display: "flex",
                      flexWrap: 'wrap',
                      alignItems: "center",
                      padding: "10px 12px",
                      gap: 8,
                      borderBottom: theme === 'lite' ? '1px solid #f0f0f0' : '1px solid #444',
                      background: index % 2 === 0 ? (theme === 'lite' ? '#fff' : '#333') : (theme === 'lite' ? '#fafafa' : '#383838'),
                      color: theme === "lite" ? "#222" : "#f5f5f5",
                    }}
                  >
                    {/* Buttons first for easier reach on touch devices */}
                    <div style={{ order: 0, display: "flex", gap: 6, alignItems: 'center', width: 72, flex: '0 0 72px' }}>
                      <button
                        onClick={() =>
                          agregarProducto(
                            productos.find((prod) => prod.id === p.id)!
                          )
                        }
                        style={{
                          background: "#388e3c",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: "pointer",
                          fontSize: 16,
                          lineHeight: 1
                        }}
                        aria-label={`Agregar ${p.nombre}`}
                      >
                        +
                      </button>
                      <button
                        onClick={() => eliminarProducto(p.id)}
                        style={{
                          background: "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: "pointer",
                          fontSize: 16,
                          lineHeight: 1
                        }}
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        −
                      </button>
                    </div>

                    <div style={{ order: 1, flex: '2 1 140px', minWidth: 120, fontWeight: 600, fontSize: 14, color: theme === 'lite' ? '#1976d2' : '#64b5f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.nombre}
                    </div>

                    <div style={{ order: 2, flex: '1 0 80px', minWidth: 80, textAlign: 'center', fontSize: 13 }}>
                      L {p.precio.toFixed(2)}
                    </div>

                    <div style={{ order: 3, flex: '1 0 64px', minWidth: 64, textAlign: 'center', fontSize: 13, color: theme === 'lite' ? '#388e3c' : '#81c784', fontWeight: 600 }}>
                      x{p.cantidad}
                    </div>

                    <div style={{ order: 4, flex: '1 0 90px', minWidth: 90, textAlign: 'right', fontWeight: 700, fontSize: 14, paddingRight: 8 }}>
                      L {(p.precio * p.cantidad).toFixed(2)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
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
              disabled={seleccionados.length === 0 || checkingFactura}
              onClick={async () => {
                // Al tocar "Confirmar Pedido" validar conexión y número de factura
                if (facturaActual === "Límite alcanzado") {
                  alert("¡Límite de facturas alcanzado!");
                  return;
                }
                if (!navigator.onLine) {
                  // Mostrar modal que indique problema de red
                  setShowNoConnectionModal(true);
                  return;
                }
                // Evitar llamadas concurrentes
                if (checkingFactura) return;
                setCheckingFactura(true);
                try {
                  // Obtener datos de CAI (rango y caja) para respetar límite si es posible
                  let rango_fin: number | null = null;
                  let cajaAsignada = caiInfo?.caja_asignada;
                  try {
                    const { data: caiData } = await supabase
                      .from("cai_facturas")
                      .select("rango_desde, rango_hasta, caja_asignada")
                      .eq("cajero_id", usuarioActual?.id)
                      .single();
                    if (caiData) {
                      rango_fin = caiData.rango_hasta ? parseInt(caiData.rango_hasta) : null;
                      cajaAsignada = caiData.caja_asignada || cajaAsignada;
                    }
                  } catch (e) {
                    // si falla, continuar sin rango
                  }

                  // Empezar desde el número actual
                  let num = parseInt(facturaActual as string);
                  if (!Number.isFinite(num)) {
                    // Si no es numérico, intentar recalcular como en fetchCaiYFactura
                    const { data: facturasData } = await supabase
                      .from("facturas")
                      .select("factura")
                      .eq("cajero", usuarioActual?.nombre)
                      .eq("caja", cajaAsignada || "");
                    let maxFactura = -1;
                    if (facturasData && facturasData.length > 0) {
                      for (const f of facturasData) {
                        const n = parseInt(f.factura);
                        if (Number.isFinite(n) && n > maxFactura) maxFactura = n;
                      }
                    }
                    if (maxFactura >= 0) {
                      num = maxFactura + 1;
                    } else {
                      // fallback: usar 1
                      num = 1;
                    }
                  }

                  // Buscar un número libre incrementando si está ocupado en facturas o pagos
                  const maxAttempts = 1000; // to avoid infinite loop
                  let attempts = 0;
                  while (attempts < maxAttempts) {
                    attempts++;
                    const facturaStr = num.toString();
                    // comprobar en facturas
                    const { data: factData } = await supabase
                      .from("facturas")
                      .select("factura")
                      .eq("factura", facturaStr)
                      .eq("caja", cajaAsignada || "")
                      .limit(1);
                    // comprobar en pagos
                    const { data: pagosData } = await supabase
                      .from("pagos")
                      .select("factura")
                      .eq("factura", facturaStr)
                      .eq("cajero", usuarioActual?.nombre)
                      .eq("caja", cajaAsignada || "")
                      .limit(1);

                    const existeFactura = Array.isArray(factData) && factData.length > 0;
                    const existePago = Array.isArray(pagosData) && pagosData.length > 0;

                    if (!existeFactura && !existePago) {
                      // número libre
                      setFacturaActual(facturaStr);
                      setShowClienteModal(true);
                      break;
                    }

                    // Si existe, incrementar y reintentar
                    num++;
                    // Si tenemos rango_fin, verificar que no lo excedemos
                    if (rango_fin && num > rango_fin) {
                      setFacturaActual("Límite alcanzado");
                      alert("¡Se ha alcanzado el límite de facturas para este cajero!");
                      break;
                    }
                  }

                  if (attempts >= maxAttempts) {
                    alert("No se pudo asignar un número de factura libre, intenta de nuevo más tarde.");
                  }
                } catch (err) {
                  console.error("Error validando factura:", err);
                  alert("Error al validar número de factura. Intenta de nuevo.");
                } finally {
                  setCheckingFactura(false);
                }
              }}
            >
              {checkingFactura ? "Verificando..." : "Confirmar Pedido"}
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
              pedido
            </button>
          </div>
        </div>
      </div>

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
              type="text"
              placeholder="Ingrese el nombre del cliente"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(e.target.value.toUpperCase())}
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: theme === 'lite' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: theme === 'lite' ? '#fff' : '#1f2937', borderRadius: 14, padding: 18, minWidth: 360, maxWidth: 760, width: '92%', boxShadow: '0 12px 40px rgba(2,6,23,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: theme === 'lite' ? '#1f2937' : '#f1f5f9', fontSize: 18 }}>pedidos</h3>
              <button onClick={() => setShowEnvioModal(false)} style={{ background: 'transparent', border: 'none', color: theme === 'lite' ? '#374151' : '#cbd5e1', fontWeight: 700, cursor: 'pointer' }}>X</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, color: theme === 'lite' ? '#374151' : '#e6eef8', marginBottom: 6 }}>Nombre del cliente</label>
                    <input placeholder="Nombre cliente" value={envioCliente} onChange={e => setEnvioCliente(e.target.value)} className="form-input" style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, color: theme === 'lite' ? '#374151' : '#e6eef8', marginBottom: 6 }}>Teléfono</label>
                    <input placeholder="Número de teléfono" value={envioCelular} onChange={e => setEnvioCelular(e.target.value)} className="form-input" style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, color: theme === 'lite' ? '#374151' : '#e6eef8', marginBottom: 6 }}>Tipo de pago</label>
                    <select value={envioTipoPago} onChange={e => setEnvioTipoPago(e.target.value as any)} className="form-input" style={{ width: '100%' }}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, color: theme === 'lite' ? '#374151' : '#e6eef8', marginBottom: 6 }}>Costo de envío (L)</label>
                    <input type="number" step="0.01" value={envioCosto} onChange={e => setEnvioCosto(e.target.value)} className="form-input" placeholder="0.00" style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: theme === 'lite' ? '#374151' : '#cbd5e1' }}>
                  <small>Completa los campos del cliente antes de guardar. El botón "Guardar" imprimirá el recibo y la comanda automáticamente (si hay impresora configurada).</small>
                </div>
              </div>
              <div style={{ background: theme === 'lite' ? '#f8fafc' : '#0b1220', borderRadius: 10, padding: 12, boxShadow: theme === 'lite' ? 'none' : '0 6px 18px rgba(0,0,0,0.6)' }}>
                <div style={{ fontSize: 13, color: theme === 'lite' ? '#374151' : '#e6eef8', marginBottom: 8 }}>Resumen</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><div>Subtotal</div><div>L {total.toFixed(2)}</div></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}><div>Costo envío</div><div>L {Number(envioCosto || 0).toFixed(2)}</div></div>
                <div style={{ height: 1, background: theme === 'lite' ? '#e6eef8' : '#12202e', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}><div>Total</div><div>L {(total + Number(envioCosto || 0)).toFixed(2)}</div></div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowEnvioModal(false)} className="btn-secondary" style={{ padding: '10px 14px' }}>Cancelar</button>
                  <button onClick={async () => {
                    // Guardar pedido de envío
                    setSavingEnvio(true);
                    try {
                      // determinar caja asignada
                      let cajaAsignada = caiInfo?.caja_asignada;
                      if (!cajaAsignada) {
                        try {
                          const { data: caiData } = await supabase.from('cai_facturas').select('caja_asignada').eq('cajero_id', usuarioActual?.id).single();
                          cajaAsignada = caiData?.caja_asignada || '';
                        } catch (e) { cajaAsignada = '' }
                      }
                      const productos = seleccionados.map(s => ({ id: s.id, nombre: s.nombre, precio: s.precio, cantidad: s.cantidad }));
                      const registro = {
                        productos,
                        cajero_id: usuarioActual?.id,
                        caja: cajaAsignada,
                        fecha: formatToHondurasLocal(),
                        cliente: envioCliente,
                        celular: envioCelular,
                        total: Number(total.toFixed(2)),
                        costo_envio: parseFloat(envioCosto || '0'),
                        tipo_pago: envioTipoPago,
                      };
                      const { error } = await supabase.from('pedidos_envio').insert([registro]);
                      if (error) {
                        console.error('Error insertando pedido de envío:', error);
                        alert('Error al guardar pedido de envío');
                      } else {
                        setLastEnvioSaved(registro);
                        setShowEnvioModal(false);
                        // Imprimir usando la misma plantilla que recibo/comanda (intentar QZ Tray primero)
                        try {
                          const { data: etiquetaConfig } = await supabase
                            .from('etiquetas_config')
                            .select('*')
                            .eq('nombre', 'default')
                            .single();
                          const { data: reciboConfig } = await supabase
                            .from('recibo_config')
                            .select('*')
                            .eq('nombre', 'default')
                            .single();

                          const comandaHtml = `
                        <div style='font-family:monospace; width:${etiquetaConfig?.etiqueta_ancho || 80}mm; margin:0; padding:${etiquetaConfig?.etiqueta_padding || 8}px;'>
                          <div style='font-size:${etiquetaConfig?.etiqueta_fontsize || 24}px; font-weight:800; color:#000; text-align:center; margin-bottom:10px;'>${etiquetaConfig?.etiqueta_comanda || 'COMANDA COCINA'}</div>
                          <div style='font-size:20px; font-weight:800; color:#000; text-align:center; margin-bottom:12px;'>Cliente: <b>${registro.cliente}</b></div>
                          <div style='font-size:14px; font-weight:600; color:#222; text-align:center; margin-bottom:6px;'>Factura: ${facturaActual || ''}</div>
                          <ul style='list-style:none; padding:0; margin-bottom:0;'>
                            ${registro.productos.map((p: any) => `<li style='font-size:${etiquetaConfig?.etiqueta_fontsize || 20}px; margin-bottom:6px; padding-bottom:8px; text-align:left; border-bottom:1px solid #000;'><div style="display:flex; justify-content:space-between; align-items:center;"><span style='font-weight:700;'>${p.nombre}</span><span>L ${p.precio.toFixed(2)} x${p.cantidad}</span></div></li>`).join('')}
                          </ul>
                        </div>
                      `;


                          // Calcular subtotal e ISV 15% para pedido de envío
                          const subtotalEnvio = registro.productos.reduce((sum: number, p: any) => {
                            // Asumimos que todos los productos son comida (tipo por defecto)
                            return sum + (p.precio / 1.15) * p.cantidad;
                          }, 0);
                          const isv15Envio = registro.productos.reduce((sum: number, p: any) => {
                            return sum + (p.precio - p.precio / 1.15) * p.cantidad;
                          }, 0);


                          const comprobanteHtml = `
                        <div style='font-family:monospace; width:${reciboConfig?.recibo_ancho || 80}mm; margin:0; padding:${reciboConfig?.recibo_padding || 8}px; background:#fff;'>
                          <!-- Logo -->
                          <div style='text-align:center; margin-bottom:12px;'>
                            <img src='/favicon.ico' alt='POLLOS CESAR' style='width:320px; height:320px;' onload='window.imageLoaded = true;' />
                          </div>
                          
                          <!-- Información del Negocio -->
                          <div style='text-align:center; font-size:18px; font-weight:700; margin-bottom:6px;'>POLLOS CESAR</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>ISLAS DE LA BAHÍA, SANDY BAY</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>BO. LA UVA</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>RTN: 18071993019392</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:3px;'>PROPIETARIO: CESAR BENIGNO VEGA CANELAS</div>
                          <div style='text-align:center; font-size:14px; margin-bottom:10px;'>TEL: 32841306</div>
                          
                          <div style='border-top:2px solid #000; border-bottom:2px solid #000; padding:6px 0; margin-bottom:10px;'>
                            <div style='text-align:center; font-size:16px; font-weight:700;'>RECIBO DE VENTA</div>
                          </div>
                          
                          <!-- Información del Cliente, Factura y Fecha -->
                          <div style='font-size:14px; margin-bottom:3px;'>Cliente: ${registro.cliente}</div>
                          <div style='font-size:14px; margin-bottom:3px;'>Factura: ${facturaActual || ''}</div>
                          <div style='font-size:14px; margin-bottom:3px;'>Celular: ${registro.celular || 'N/A'}</div>
                          <div style='font-size:14px; margin-bottom:10px;'>Fecha: ${new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' })}</div>
                          
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
                                ${registro.productos.map((p: any) => `<tr>
                                  <td style='padding:4px 0;'>${p.cantidad}</td>
                                  <td style='padding:4px 0;'>${p.nombre}</td>
                                  <td style='text-align:right; padding:4px 0;'>L${p.precio.toFixed(2)}</td>
                                  <td style='text-align:right; padding:4px 0;'>L${(p.precio * p.cantidad).toFixed(2)}</td>
                                </tr>`).join('')}
                              </tbody>
                            </table>
                          </div>
                          
                          <!-- Totales -->
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>SUBTOTAL:</span>
                            <span style='float:right; font-weight:700;'>L ${subtotalEnvio.toFixed(2)}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>ISV 15%:</span>
                            <span style='float:right; font-weight:700;'>L ${isv15Envio.toFixed(2)}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='font-size:15px; margin-bottom:3px;'>
                            <span style='float:left;'>COSTO ENVÍO:</span>
                            <span style='float:right; font-weight:700;'>L ${registro.costo_envio.toFixed(2)}</span>
                            <div style='clear:both;'></div>
                          </div>
                          <div style='border-top:1px solid #000; margin-top:6px; padding-top:6px; font-size:17px; font-weight:700;'>
                            <span style='float:left;'>TOTAL:</span>
                            <span style='float:right;'>L ${(registro.total + registro.costo_envio).toFixed(2)}</span>
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
                              @media print { .page-break { page-break-after: always; } }
                              body { margin:0; padding:0; }
                            </style>
                          </head>
                          <body>
                            <div>${comprobanteHtml}</div>
                            <div class='page-break'></div>
                            <div>${comandaHtml}</div>
                          </body>
                        </html>
                      `;

                          // Precargar la imagen antes de imprimir
                          const preloadImage = () => {
                            return new Promise((resolve) => {
                              const img = new Image();
                              img.onload = () => resolve(true);
                              img.onerror = () => resolve(false);
                              img.src = '/favicon.ico';
                              setTimeout(() => resolve(false), 2000);
                            });
                          };

                          // Print using browser fallback (QZ Tray integration removed)
                          try {
                            await preloadImage();
                            const printWindow = window.open('', '', 'height=800,width=400');
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
                            console.error('Error imprimiendo pedido de envío:', err);
                            const printWindow = window.open('', '', 'height=800,width=400');
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
                          console.error('Error durante impresión de envío:', err);
                        }
                        // limpiar seleccionados
                        limpiarSeleccion();
                      }
                    } catch (e) {
                      console.error(e);
                      alert('Error al guardar pedido de envío');
                    } finally {
                      setSavingEnvio(false);
                    }
                  }} className="btn-primary" disabled={savingEnvio || !envioCliente || !envioCelular}>
                    {savingEnvio ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de recibo para impresión */}
      {showReceiptModal && lastEnvioSaved && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', zIndex: 100000, padding: 24, overflow: 'auto' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'monospace' }}>
            <h2 style={{ textAlign: 'center', margin: 0 }}>pollos cesar</h2>
            <p style={{ textAlign: 'center', marginTop: 4 }}>{lastEnvioSaved.fecha}</p>
            <hr />
            <div>
              <div><strong>Cajero:</strong> {usuarioActual?.nombre}</div>
              <div><strong>Caja:</strong> {lastEnvioSaved.caja}</div>
              <div><strong>Cliente:</strong> {lastEnvioSaved.cliente} - {lastEnvioSaved.celular}</div>
              <div><strong>Pago:</strong> {lastEnvioSaved.tipo_pago}</div>
            </div>
            <hr />
            <div>
              {lastEnvioSaved.productos.map((p: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>{p.nombre} x{p.cantidad}</div>
                  <div>L {(p.precio * p.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Subtotal:</div>
              <div>L {lastEnvioSaved.total.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>Costo envío:</div>
              <div>L {lastEnvioSaved.costo_envio.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginTop: 8 }}>
              <div>Total a pagar:</div>
              <div>L {(lastEnvioSaved.total + lastEnvioSaved.costo_envio).toFixed(2)}</div>
            </div>
            <hr />
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setShowReceiptModal(false); window.print(); }} className="btn-primary">Imprimir</button>
              <button onClick={() => setShowReceiptModal(false)} style={{ marginLeft: 12 }} className="btn-primary">Cerrar</button>
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
            background: "rgba(0,0,0,0.25)",
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
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              boxShadow: "0 8px 32px #0003",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: "#d32f2f" }}>Sin conexión</h3>
            <p>No hay conexión. Revisa tu red e intenta de nuevo.</p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <button
                onClick={() => setShowNoConnectionModal(false)}
                style={{
                  padding: "8px 18px",
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

      {/* Modal Pedidos del cajero */}
      {showPedidosModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120000,
          }}
          onClick={() => setShowPedidosModal(false)}
        >
          <div
            style={{
              background: theme === 'lite' ? '#fff' : '#232526',
              borderRadius: 12,
              padding: 16,
              minWidth: 320,
              maxWidth: 820,
              maxHeight: '80vh',
              overflow: 'auto',
              color: theme === 'lite' ? '#222' : '#f5f5f5',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Pedidos (últimos)</h3>
              <button onClick={() => setShowPedidosModal(false)} className="btn-primary">Cerrar</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {pedidosLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>Cargando...</div>
              ) : pedidosList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24 }}>No hay pedidos.</div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: '#1976d2', color: '#fff' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Fecha</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Cliente</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Teléfono</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Envío</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Pago</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosList.map((p: any, index: number) => (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: '1px solid #eee',
                            background: index % 2 === 0 ? '#fff' : '#f9f9f9'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#e3f2fd'}
                          onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#f9f9f9'}
                        >
                          <td style={{ padding: '12px 16px', color: '#444' }}>{p.fecha}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.cliente}</td>
                          <td style={{ padding: '12px 16px', color: '#666' }}>{p.celular}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>L {Number(p.total || 0).toFixed(2)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#666' }}>L {Number(p.costo_envio || 0).toFixed(2)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              background: p.tipo_pago === 'Efectivo' ? '#e8f5e9' : '#e3f2fd',
                              color: p.tipo_pago === 'Efectivo' ? '#2e7d32' : '#1565c0',
                              border: `1px solid ${p.tipo_pago === 'Efectivo' ? '#c8e6c9' : '#bbdefb'}`
                            }}>
                              {p.tipo_pago}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                onClick={async () => {
                                  if (!confirm('¿Eliminar pedido?')) return;
                                  setPedidosProcessingId(p.id);
                                  try {
                                    const { error } = await supabase.from('pedidos_envio').delete().eq('id', p.id);
                                    if (error) throw error;
                                    setPedidosList((prev) => prev.filter((x) => x.id !== p.id));
                                  } catch (err) {
                                    console.error('Error eliminando pedido:', err);
                                    alert('Error eliminando pedido');
                                  } finally {
                                    setPedidosProcessingId(null);
                                  }
                                }}
                                disabled={pedidosProcessingId === p.id}
                                style={{
                                  background: '#ffebee',
                                  color: '#d32f2f',
                                  border: '1px solid #ffcdd2',
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 500,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#d32f2f';
                                  e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#ffebee';
                                  e.currentTarget.style.color = '#d32f2f';
                                }}
                              >
                                {pedidosProcessingId === p.id ? '...' : 'Eliminar'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (facturaActual === 'Límite alcanzado') { alert('Límite de facturas alcanzado'); return; }
                                  if (!confirm('Marcar como entregado y registrar cobro?')) return;
                                  setPedidosProcessingId(p.id);
                                  try {
                                    const productos = (p.productos || []).map((pp: any) => ({ id: pp.id, nombre: pp.nombre, precio: pp.precio, cantidad: pp.cantidad, tipo: pp.tipo || 'comida' }));
                                    const subTotal = productos.reduce((sum: number, item: any) => {
                                      if (item.tipo === 'comida') return sum + (item.precio / 1.15) * item.cantidad;
                                      if (item.tipo === 'bebida') return sum + (item.precio / 1.18) * item.cantidad;
                                      return sum + item.precio * item.cantidad;
                                    }, 0);
                                    const isv15 = productos.filter((it: any) => it.tipo === 'comida').reduce((s: number, it: any) => s + (it.precio - it.precio / 1.15) * it.cantidad, 0);
                                    const isv18 = productos.filter((it: any) => it.tipo === 'bebida').reduce((s: number, it: any) => s + (it.precio - it.precio / 1.18) * it.cantidad, 0);
                                    const venta = {
                                      fecha_hora: formatToHondurasLocal(),
                                      cajero: usuarioActual?.nombre || '',
                                      caja: p.caja || caiInfo?.caja_asignada || '',
                                      cai: caiInfo && caiInfo.cai ? caiInfo.cai : '',
                                      factura: facturaActual,
                                      cliente: p.cliente || null,
                                      productos: JSON.stringify(productos),
                                      sub_total: subTotal.toFixed(2),
                                      isv_15: isv15.toFixed(2),
                                      isv_18: isv18.toFixed(2),
                                      total: Number(p.total || 0).toFixed(2),
                                    };
                                    const { error: errFact } = await supabase.from('facturas').insert([venta]);
                                    if (errFact) throw errFact;
                                    const pago = {
                                      tipo: p.tipo_pago || 'Efectivo',
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
                                    const { error: errPago } = await supabase.from('pagos').insert([pago]);
                                    if (errPago) throw errPago;
                                    try { setFacturaActual((prev) => prev && prev !== 'Límite alcanzado' ? (parseInt(prev) + 1).toString() : prev); } catch { }
                                    const { error: errDel } = await supabase.from('pedidos_envio').delete().eq('id', p.id);
                                    if (errDel) throw errDel;
                                    setPedidosList((prev) => prev.filter((x) => x.id !== p.id));
                                  } catch (err) {
                                    console.error('Error procesando entrega y cobro:', err);
                                    alert('Error procesando entrega y cobro');
                                  } finally {
                                    setPedidosProcessingId(null);
                                  }
                                }}
                                disabled={pedidosProcessingId === p.id}
                                style={{
                                  background: '#e8f5e9',
                                  color: '#2e7d32',
                                  border: '1px solid #a5d6a7',
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 13,
                                  fontWeight: 500,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#2e7d32';
                                  e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#e8f5e9';
                                  e.currentTarget.style.color = '#2e7d32';
                                }}
                              >
                                {pedidosProcessingId === p.id ? '...' : 'Entregado y Cobrado'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div >
          </div >
        </div >
      )}

      {/* Modal Registrar Gasto */}
      {
        showRegistrarGasto && (
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
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
                <input
                  type="text"
                  placeholder="Motivo"
                  value={gastoMotivo}
                  onChange={(e) => setGastoMotivo(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
                <input
                  type="text"
                  placeholder="Número de factura (opcional)"
                  value={gastoFactura}
                  onChange={(e) => setGastoFactura(e.target.value)}
                  style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
                <button
                  onClick={() => cerrarRegistrarGasto()}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#9e9e9e", color: "#fff", cursor: "pointer" }}
                  disabled={guardandoGasto}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => guardarGasto()}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#d32f2f", color: "#fff", cursor: "pointer", fontWeight: 700 }}
                  disabled={guardandoGasto}
                >
                  {guardandoGasto ? "Guardando..." : "Guardar gasto"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de éxito tras registrar gasto */}
      {
        showGastoSuccess && (
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
              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button
                  onClick={() => setShowGastoSuccess(false)}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#1976d2", color: "#fff", cursor: "pointer" }}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para requerir factura */}
      {/* Eliminado el modal de confirmación de factura */}
    </div >
  );
}
