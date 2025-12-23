import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { NOMBRE_NEGOCIO_UPPER } from "./empresa";
import { getLocalDayRange, formatToHondurasLocal } from "./utils/fechas";

interface UsuarioActual {
  nombre: string;
  [key: string]: any;
}

interface RegistroCierreViewProps {
  usuarioActual: UsuarioActual;
  caja: string;
  onCierreGuardado?: () => void;
}

export default function RegistroCierreView({
  usuarioActual,
  caja,
  onCierreGuardado,
}: RegistroCierreViewProps) {
  const [fondoFijo, setFondoFijo] = useState("");
  const [efectivo, setEfectivo] = useState("");
  const [tarjeta, setTarjeta] = useState("");
  const [transferencias, setTransferencias] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Gaveta eliminada: ya no usamos drawerLoading/drawerMessage
  const [aperturaLoading, setAperturaLoading] = useState(false);
  const [aperturaExisteHoy, setAperturaExisteHoy] = useState(false);

  // Precargar fondo fijo desde la APERTURA de hoy si existe
  useEffect(() => {
    let mounted = true;
    async function loadApertura() {
      if (!usuarioActual || !usuarioActual.id || !caja) return;
      setAperturaLoading(true);
      try {
        const { start, end } = getLocalDayRange();
        const { data: aperturas, error } = await supabase
          .from("cierres")
          .select("fondo_fijo_registrado")
          .eq("tipo_registro", "apertura")
          .eq("cajero_id", usuarioActual.id)
          .eq("caja", caja)
          .gte("fecha", start)
          .lte("fecha", end)
          .order("fecha", { ascending: true });
        if (!mounted) return;
        if (error) {
          console.warn("Error buscando apertura de hoy:", error);
        } else if (aperturas && aperturas.length > 0) {
          setAperturaExisteHoy(true);
          const val = aperturas[0].fondo_fijo_registrado;
          if (val !== undefined && val !== null && fondoFijo === "") {
            setFondoFijo(String(val));
          }
        } else {
          setAperturaExisteHoy(false);
        }
      } catch (err) {
        console.error("Error cargando apertura de hoy:", err);
      } finally {
        if (mounted) setAperturaLoading(false);
      }
    }
    loadApertura();
    return () => {
      mounted = false;
    };
  }, [usuarioActual?.id, caja]);

  // Calcular valores automáticos
  async function obtenerValoresAutomaticos() {
    const { start, end, day } = getLocalDayRange();
    // Fondo fijo del día (apertura)
    const { data: aperturas } = await supabase
      .from("cierres")
      .select("fondo_fijo_registrado")
      .eq("tipo_registro", "apertura")
      // mantener compatibilidad: priorizar cajero_id si existe, sino filtrar por nombre
      .or(
        usuarioActual?.id
          ? `cajero_id.eq.${usuarioActual.id}`
          : `cajero.eq.${usuarioActual?.nombre}`
      )
      .eq("caja", caja)
      .gte("fecha", start)
      .lte("fecha", end);
    const fondoFijoDia =
      aperturas && aperturas.length > 0
        ? parseFloat(aperturas[0].fondo_fijo_registrado)
        : 0;

    // Sumas de pagos del día por tipo y cajero (nombre)
    const desde = start;
    const hasta = end;

    // Construir filtro de cajero: preferir cajero_id, si no disponible usar nombre
    const cajeroFilterIsId = !!usuarioActual?.id;

    // Usar el mismo filtro que el modal Resumen de caja: por cajero (id o nombre) y rango de fecha.
    const pagosBase = () =>
      supabase
        .from("pagos")
        .select("monto, fecha_hora")
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta);

    const pagosEfectivoQuery = cajeroFilterIsId
      ? pagosBase().eq("tipo", "Efectivo").eq("cajero_id", usuarioActual.id)
      : pagosBase().eq("tipo", "Efectivo").eq("cajero", usuarioActual?.nombre);

    const { data: pagosEfectivo } = await pagosEfectivoQuery;
    console.debug(
      "pagosEfectivo count:",
      pagosEfectivo?.length,
      "sample:",
      pagosEfectivo?.slice(0, 3)
    );
    const efectivoDia = pagosEfectivo
      ? pagosEfectivo.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0)
      : 0;
    console.debug("efectivoDia computed:", efectivoDia);

    // Obtener gastos del día (la tabla 'gastos' usa columna DATE)
    // Filtrar por cajero_id y caja para que solo se sumen los gastos de este cajero/caja
    let gastosDia = 0;
    try {
      const { data: gastosData } = await supabase
        .from("gastos")
        .select("monto")
        .eq("fecha", day)
        .eq("cajero_id", usuarioActual?.id)
        .eq("caja", caja);
      if (gastosData && Array.isArray(gastosData)) {
        gastosDia = gastosData.reduce(
          (s: number, g: any) => s + parseFloat(g.monto || 0),
          0
        );
      }
    } catch (e) {
      console.warn("No se pudieron obtener gastos del día:", e);
      gastosDia = 0;
    }
    console.debug("gastosDia computed:", gastosDia);

    // Restar los gastos del día al efectivo
    const efectivoDiaNet = Math.max(0, efectivoDia - gastosDia);
    console.debug("efectivoDia neto (efectivo - gastos):", efectivoDiaNet);

    const pagosTarjetaQuery = cajeroFilterIsId
      ? pagosBase().eq("tipo", "Tarjeta").eq("cajero_id", usuarioActual.id)
      : pagosBase().eq("tipo", "Tarjeta").eq("cajero", usuarioActual?.nombre);
    const { data: pagosTarjeta } = await pagosTarjetaQuery;
    console.debug(
      "pagosTarjeta count:",
      pagosTarjeta?.length,
      "sample:",
      pagosTarjeta?.slice(0, 3)
    );
    const tarjetaDia = pagosTarjeta
      ? pagosTarjeta.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0)
      : 0;
    console.debug("tarjetaDia computed:", tarjetaDia);

    const pagosTransQuery = cajeroFilterIsId
      ? pagosBase()
          .eq("tipo", "Transferencia")
          .eq("cajero_id", usuarioActual.id)
      : pagosBase()
          .eq("tipo", "Transferencia")
          .eq("cajero", usuarioActual?.nombre);
    const { data: pagosTrans } = await pagosTransQuery;
    console.debug(
      "pagosTrans count:",
      pagosTrans?.length,
      "sample:",
      pagosTrans?.slice(0, 3)
    );
    const transferenciasDia = pagosTrans
      ? pagosTrans.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0)
      : 0;
    console.debug("transferenciasDia computed:", transferenciasDia);

    return {
      fondoFijoDia,
      efectivoDia: efectivoDiaNet,
      tarjetaDia,
      transferenciasDia,
      gastosDia,
    };
  }

  const printCierreReport = (registro: any, gastosDia: number) => {
    const logoUrl = "/favicon.ico";
    const img = new Image();
    img.src = logoUrl;

    const doPrint = () => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const html = `
        <html>
          <head>
            <title>Reporte de Cierre</title>
            <style>
              /* Make all text bold and keep monospace for alignment */
              body { font-family: 'Courier New', monospace; padding: 10px; width: 80mm; margin: 0 auto; color: #000; font-weight: 700; font-size: 16px; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
              /* Increase logo 4x (from 120 -> 480) */
              .logo { width: 480px; height: 480px; margin-bottom: 10px; }
              .title { font-size: 20px; margin: 10px 0; }
              .info { font-size: 16px; margin-bottom: 15px; }
              .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 16px; }
              .divider { border-top: 1px dashed #000; margin: 10px 0; }
              .total { font-size: 18px; margin-top: 10px; }
              .footer { text-align: center; margin-top: 30px; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
             
              <div style="font-size: 18px;">${NOMBRE_NEGOCIO_UPPER}</div>
          
              <div class="title">REPORTE DE CIERRE DE CAJA</div>
            </div>

            <div class="info">
              <div><strong>Fecha:</strong> ${new Date().toLocaleDateString(
                "es-HN"
              )} ${new Date().toLocaleTimeString("es-HN")}</div>
              <div><strong>Cajero:</strong> ${registro.cajero}</div>
              <div><strong>Caja:</strong> ${registro.caja}</div>
            </div>

            <div class="divider"></div>
            <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">SISTEMA</div>
            
            <div class="row">
              <span>Fondo Fijo:</span>
              <span>L ${Number(registro.fondo_fijo).toFixed(2)}</span>
            </div>
            <div class="row">
              <span>Ventas Efectivo (Neto):</span>
              <span>L ${Number(registro.efectivo_dia).toFixed(2)}</span>
            </div>
            <div class="row">
              <span>Ventas Tarjeta:</span>
              <span>L ${Number(registro.monto_tarjeta_dia).toFixed(2)}</span>
            </div>
            <div class="row">
              <span>Ventas Transf.:</span>
              <span>L ${Number(registro.transferencias_dia).toFixed(2)}</span>
            </div>
             <div class="row">
              <span>Gastos del Día:</span>
              <span>L ${Number(gastosDia).toFixed(2)}</span>
            </div>

            <div class="divider"></div>
            <div class="row" style="font-weight: bold;">
              <span>EFECTIVO ESPERADO:</span>
              <span>L ${(
                Number(registro.fondo_fijo) + Number(registro.efectivo_dia)
              ).toFixed(2)}</span>
            </div>
            <div style="font-size: 11px; text-align: right; color: #666;">(Fondo + Ventas Efec. Neto)</div>

            <div class="divider"></div>
            <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">CONTEO (USUARIO)</div>

            <div class="row">
              <span>Fondo Fijo:</span>
              <span>L ${Number(registro.fondo_fijo_registrado).toFixed(
                2
              )}</span>
            </div>
            <div class="row">
              <span>Efectivo:</span>
              <span>L ${Number(registro.efectivo_registrado).toFixed(2)}</span>
            </div>
            <div class="row">
              <span>Tarjeta:</span>
              <span>L ${Number(registro.monto_tarjeta_registrado).toFixed(
                2
              )}</span>
            </div>
            <div class="row">
              <span>Transferencia:</span>
              <span>L ${Number(registro.transferencias_registradas).toFixed(
                2
              )}</span>
            </div>

            <div class="divider"></div>
            <div class="row" style="font-weight: bold; font-size: 16px;">
              <span>DIFERENCIA:</span>
              <span>L ${Number(registro.diferencia).toFixed(2)}</span>
            </div>
          

            <div class="footer">
              <p>__________________________</p>
              <p>Firma Cajero</p>
              <br/>
              <p>__________________________</p>
              <p>Firma Supervisor</p>
            </div>
            <script>
              window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    };

    img.onload = doPrint;
    img.onerror = doPrint; // Print anyway if image fails

    // Timeout fallback in case onload never fires
    setTimeout(() => {
      if (!img.complete) doPrint();
    }, 2000);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Validación cliente: evitar envíos si los campos no están completos
    const fondoFijoFilled = fondoFijo.trim() !== "";
    const efectivoFilled = efectivo.trim() !== "";
    const tarjetaFilled = tarjeta.trim() !== "";
    const transferenciasFilled = transferencias.trim() !== "";
    const isApertura =
      fondoFijoFilled &&
      !efectivoFilled &&
      !tarjetaFilled &&
      !transferenciasFilled &&
      !aperturaExisteHoy;
    const isCierreReady =
      fondoFijoFilled &&
      efectivoFilled &&
      tarjetaFilled &&
      transferenciasFilled;
    const showGuardar = isApertura || isCierreReady;
    if (!showGuardar) {
      setLoading(false);
      setError(
        "Complete los campos requeridos antes de guardar (fondo fijo y los montos de cierre)."
      );
      return;
    }
    const { start, end } = getLocalDayRange();
    // Verificar si ya existe apertura hoy SOLO si se está registrando apertura
    const { data: aperturasHoy } = await supabase
      .from("cierres")
      .select("id")
      .eq("tipo_registro", "apertura")
      .eq("cajero_id", usuarioActual?.id)
      .eq("caja", caja)
      .gte("fecha", start)
      .lte("fecha", end);
    if (
      fondoFijo &&
      !efectivo &&
      !tarjeta &&
      !transferencias &&
      aperturasHoy &&
      aperturasHoy.length > 0
    ) {
      setLoading(false);
      setError(
        "Ya existe una apertura registrada para este cajero y caja hoy."
      );
      return;
    }
    // Verificar si ya existe cierre hoy
    const { data: cierresHoy } = await supabase
      .from("cierres")
      .select("id")
      .eq("tipo_registro", "cierre")
      .eq("cajero_id", usuarioActual?.id)
      .eq("caja", caja)
      .gte("fecha", start)
      .lte("fecha", end);
    if (
      cierresHoy &&
      cierresHoy.length > 0 &&
      efectivo &&
      tarjeta &&
      transferencias
    ) {
      setLoading(false);
      setError("Ya existe un cierre registrado para este cajero y caja hoy.");
      return;
    }
    // Esperar 1 segundo para mostrar pantalla de carga
    setTimeout(async () => {
      const {
        fondoFijoDia,
        efectivoDia,
        tarjetaDia,
        transferenciasDia,
        gastosDia,
      } = await obtenerValoresAutomaticos();
      // Calcular diferencias
      const diferencia =
        parseFloat(fondoFijo) -
        fondoFijoDia +
        (parseFloat(efectivo) - efectivoDia) +
        (parseFloat(tarjeta) - tarjetaDia) +
        (parseFloat(transferencias) - transferenciasDia);
      let observacion = "";
      if (diferencia === 0) {
        observacion = "cuadrado";
      } else {
        observacion = "sin aclarar";
      }
      // Determinar si es apertura o cierre
      type Registro = {
        tipo_registro: string;
        cajero: string;
        cajero_id: string;
        caja: string;
        fecha: string;
        fondo_fijo_registrado: number;
        fondo_fijo: number;
        efectivo_registrado: number;
        efectivo_dia: number;
        monto_tarjeta_registrado: number;
        monto_tarjeta_dia: number;
        transferencias_registradas: number;
        transferencias_dia: number;
        diferencia: number;
        observacion: string;
      };

      let registro: Registro;
      if (fondoFijo && !efectivo && !tarjeta && !transferencias) {
        // APERTURA
        registro = {
          tipo_registro: "apertura",
          cajero: usuarioActual?.nombre,
          cajero_id:
            usuarioActual && usuarioActual.id ? usuarioActual.id : "SIN_ID",
          caja,
          // Guardar la fecha/hora en hora local de Honduras
          fecha: formatToHondurasLocal(),
          fondo_fijo_registrado: parseFloat(fondoFijo),
          fondo_fijo: fondoFijoDia,
          efectivo_registrado: 0,
          efectivo_dia: 0,
          monto_tarjeta_registrado: 0,
          monto_tarjeta_dia: 0,
          transferencias_registradas: 0,
          transferencias_dia: 0,
          diferencia: 0,
          observacion: "apertura",
        };
      } else {
        // CIERRE
        registro = {
          tipo_registro: "cierre",
          cajero: usuarioActual?.nombre,
          cajero_id:
            usuarioActual && usuarioActual.id ? usuarioActual.id : "SIN_ID",
          caja,
          // Guardar la fecha/hora en hora local de Honduras
          fecha: formatToHondurasLocal(),
          fondo_fijo_registrado: parseFloat(fondoFijo),
          fondo_fijo: fondoFijoDia,
          efectivo_registrado: parseFloat(efectivo),
          efectivo_dia: efectivoDia,
          monto_tarjeta_registrado: parseFloat(tarjeta),
          monto_tarjeta_dia: tarjetaDia,
          transferencias_registradas: parseFloat(transferencias),
          transferencias_dia: transferenciasDia,
          diferencia,
          observacion,
        };
      }
      const { error } = await supabase.from("cierres").insert([registro]);
      setLoading(false);
      if (error) {
        alert("Error al guardar: " + error.message);
      } else {
        // Imprimir reporte si es CIERRE
        if (registro.tipo_registro === "cierre") {
          printCierreReport(registro, gastosDia);
        }

        // Enviar datos al script de Google (fire-and-forget)
        try {
          const { GOOGLE_SCRIPT_URL } = await import("./googlescript");
          const gsBase = GOOGLE_SCRIPT_URL;
          const now = new Date();
          const fecha = now.toLocaleDateString();
          const hora = now.toLocaleTimeString();

          const params = new URLSearchParams({
            fecha: fecha,
            hora: hora,
            cajero: registro.cajero || "",
            efectivo_reg: String(registro.efectivo_registrado || 0),
            tarjeta_reg: String(registro.monto_tarjeta_registrado || 0),
            transf_reg: String(registro.transferencias_registradas || 0),
            efectivo_ventas: String(registro.efectivo_dia || 0),
            tarjeta_ventas: String(registro.monto_tarjeta_dia || 0),
            transf_ventas: String(registro.transferencias_dia || 0),
            // Enviar también el total de gastos del día y asegurarnos que
            // efectivo_ventas corresponde al efectivo ya neto de esos gastos.
            gasto: String(gastosDia || 0),
          });

          // Añadir timestamp para evitar caching
          params.append("_ts", String(Date.now()));
          const url = gsBase + "?" + params.toString();

          // Método robusto de "fire-and-forget": crear una imagen y asignar src (GET sin CORS)
          try {
            const img = new Image();
            img.src = url;
            // No necesitamos manejar onload/onerror; esto envía la petición GET inmediatamente.
          } catch (e) {
            // fallback a fetch no-cors con keepalive
            try {
              fetch(url, {
                method: "GET",
                mode: "no-cors",
                keepalive: true,
              }).catch(() => {});
            } catch (e2) {
              // último recurso: fetch normal sin await
              fetch(url).catch(() => {});
            }
          }
        } catch (e) {
          // No hacemos nada si falla el envío; es fire-and-forget
          console.warn("No se pudo enviar datos al script de Google:", e);
        }

        // Si la diferencia es distinta de 0, redirigir a resultadosCaja
        if (
          registro.diferencia !== 0 &&
          typeof onCierreGuardado === "function"
        ) {
          onCierreGuardado();
        } else if (typeof onCierreGuardado === "function") {
          onCierreGuardado();
        }
      }
    }, 1000);
  };

  // Validación visual en render: mostrar/ocultar botón y marcar required condicionalmente
  const fondoFijoFilled = fondoFijo.trim() !== "";
  const efectivoFilled = efectivo.trim() !== "";
  const tarjetaFilled = tarjeta.trim() !== "";
  const transferenciasFilled = transferencias.trim() !== "";
  const isApertura =
    fondoFijoFilled &&
    !efectivoFilled &&
    !tarjetaFilled &&
    !transferenciasFilled &&
    !aperturaExisteHoy;
  const isCierreReady =
    fondoFijoFilled && efectivoFilled && tarjetaFilled && transferenciasFilled;
  const showGuardar = isApertura || isCierreReady;

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
      }}
    >
      <form
        onSubmit={handleGuardar}
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 32px #1976d244",
          padding: 40,
          minWidth: 370,
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <h2
          style={{
            color: "#1976d2",
            marginBottom: 10,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: 1,
          }}
        >
          Registro de Cierre de Caja
        </h2>
        <div
          style={{
            marginBottom: 8,
            fontSize: 16,
            color: "#333",
            background: "#f5f5f5",
            borderRadius: 8,
            padding: "10px 18px",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "#1976d2" }}>
            <b>Cajero:</b>
          </span>{" "}
          {usuarioActual?.nombre}
          <br />
          <span style={{ color: "#1976d2" }}>
            <b>Caja:</b>
          </span>{" "}
          {caja}
          <br />
          <span style={{ color: "#1976d2" }}>
            <b>Fecha:</b>
          </span>{" "}
          {new Date().toLocaleDateString()}
        </div>
        <label style={{ fontWeight: 700, color: "#388e3c", marginBottom: 4 }}>
          Fondo fijo
        </label>
        <input
          type="number"
          value={fondoFijo}
          onChange={(e) => setFondoFijo(e.target.value)}
          required
          placeholder="Ingrese el monto del fondo fijo"
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #bdbdbd",
            fontSize: 16,
            marginBottom: 2,
          }}
        />
        <label style={{ fontWeight: 700, color: "#388e3c", marginBottom: 4 }}>
          Efectivo
        </label>
        <input
          type="number"
          value={efectivo}
          onChange={(e) => setEfectivo(e.target.value)}
          required={!isApertura}
          placeholder="0.00"
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #bdbdbd",
            fontSize: 16,
            marginBottom: 2,
          }}
        />
        <label style={{ fontWeight: 700, color: "#388e3c", marginBottom: 4 }}>
          Tarjeta
        </label>
        <input
          type="number"
          value={tarjeta}
          onChange={(e) => setTarjeta(e.target.value)}
          required={!isApertura}
          placeholder="0.00"
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #bdbdbd",
            fontSize: 16,
            marginBottom: 2,
          }}
        />
        <label style={{ fontWeight: 700, color: "#388e3c", marginBottom: 4 }}>
          Transferencias
        </label>
        <input
          type="number"
          value={transferencias}
          onChange={(e) => setTransferencias(e.target.value)}
          required={!isApertura}
          placeholder="0.00"
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #bdbdbd",
            fontSize: 16,
            marginBottom: 2,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 10,
            alignItems: "center",
          }}
        >
          {showGuardar ? (
            <button
              type="submit"
              disabled={loading || aperturaLoading}
              style={{
                background: "#1976d2",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                padding: "12px 0",
                fontWeight: 700,
                fontSize: 20,
                cursor: "pointer",
                flex: 1,
                boxShadow: "0 2px 8px #1976d222",
              }}
            >
              {loading ? "Guardando..." : "Guardar cierre"}
            </button>
          ) : (
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                textAlign: "center",
                color: "#616161",
                borderRadius: 8,
                border: "1px dashed #e0e0e0",
                background: "#fafafa",
                fontWeight: 600,
              }}
            >
              Rellene los campos requeridos para ver el botón
            </div>
          )}
        </div>
        {aperturaLoading && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#1976d2" }}>
            Cargando apertura...
          </div>
        )}
        {/* drawerMessage removido */}
        {error && <div style={{ color: "red", fontWeight: 600 }}>{error}</div>}
        {loading && (
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <div
              className="loader"
              style={{
                width: 48,
                height: 48,
                border: "6px solid #1976d2",
                borderTop: "6px solid #fff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto",
              }}
            />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
            <div
              style={{
                color: "#1976d2",
                fontWeight: 700,
                fontSize: 18,
                marginTop: 10,
              }}
            >
              Guardando cierre...
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
