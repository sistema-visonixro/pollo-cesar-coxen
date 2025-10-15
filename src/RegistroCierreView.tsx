import { useState } from "react";
import { supabase } from "./supabaseClient";

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

  // Calcular valores automáticos
  async function obtenerValoresAutomaticos() {
    const hoy = new Date().toISOString().slice(0, 10);
    // Fondo fijo del día (apertura)
    const { data: aperturas } = await supabase
      .from("cierres")
      .select("fondo_fijo_registrado")
      .eq("tipo_registro", "apertura")
      .eq("cajero", usuarioActual?.nombre)
      .eq("caja", caja)
      .gte("fecha", hoy + "T00:00:00")
      .lte("fecha", hoy + "T23:59:59");
    const fondoFijoDia =
      aperturas && aperturas.length > 0
        ? parseFloat(aperturas[0].fondo_fijo_registrado)
        : 0;

    // Sumas de pagos del día por tipo y cajero (nombre)
    const desde = hoy + "T00:00:00";
    const hasta = hoy + "T23:59:59";

    const { data: pagosEfectivo } = await supabase
      .from("pagos")
      .select("monto, fecha_hora")
      .eq("tipo", "Efectivo")
      .eq("cajero", usuarioActual?.nombre)
      .gte("fecha_hora", desde)
      .lte("fecha_hora", hasta);
    const efectivoDia = pagosEfectivo
      ? pagosEfectivo.reduce((sum, p) => sum + parseFloat(p.monto), 0)
      : 0;

    const { data: pagosTarjeta } = await supabase
      .from("pagos")
      .select("monto, fecha_hora")
      .eq("tipo", "Tarjeta")
      .eq("cajero", usuarioActual?.nombre)
      .gte("fecha_hora", desde)
      .lte("fecha_hora", hasta);
    const tarjetaDia = pagosTarjeta
      ? pagosTarjeta.reduce((sum, p) => sum + parseFloat(p.monto), 0)
      : 0;

    const { data: pagosTrans } = await supabase
      .from("pagos")
      .select("monto, fecha_hora")
      .eq("tipo", "Transferencia")
      .eq("cajero", usuarioActual?.nombre)
      .gte("fecha_hora", desde)
      .lte("fecha_hora", hasta);
    const transferenciasDia = pagosTrans
      ? pagosTrans.reduce((sum, p) => sum + parseFloat(p.monto), 0)
      : 0;

    return { fondoFijoDia, efectivoDia, tarjetaDia, transferenciasDia };
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const hoy = new Date().toISOString().slice(0, 10);
    // Verificar si ya existe apertura hoy SOLO si se está registrando apertura
    const { data: aperturasHoy } = await supabase
      .from("cierres")
      .select("id")
      .eq("tipo_registro", "apertura")
      .eq("cajero", usuarioActual?.nombre)
      .eq("caja", caja)
      .gte("fecha", hoy + "T00:00:00")
      .lte("fecha", hoy + "T23:59:59");
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
      .eq("cajero", usuarioActual?.nombre)
      .eq("caja", caja)
      .gte("fecha", hoy + "T00:00:00")
      .lte("fecha", hoy + "T23:59:59");
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
      const { fondoFijoDia, efectivoDia, tarjetaDia, transferenciasDia } =
        await obtenerValoresAutomaticos();
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
      const cierre = {
        tipo_registro: "cierre",
        cajero: usuarioActual?.nombre,
        caja,
        fecha: new Date().toISOString(),
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
      const { error } = await supabase.from("cierres").insert([cierre]);
      setLoading(false);
      if (error) {
        alert("Error al guardar: " + error.message);
      } else {
        // Si la diferencia es distinta de 0, redirigir a resultadosCaja
        if (cierre.diferencia !== 0 && typeof onCierreGuardado === "function") {
          onCierreGuardado();
        } else if (typeof onCierreGuardado === "function") {
          onCierreGuardado();
        }
      }
    }, 1000);
  };

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
          style={{
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #bdbdbd",
            fontSize: 16,
            marginBottom: 2,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#1976d2",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 20,
            cursor: "pointer",
            marginTop: 10,
            boxShadow: "0 2px 8px #1976d222",
          }}
        >
          {loading ? "Guardando..." : "Guardar cierre"}
        </button>
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
