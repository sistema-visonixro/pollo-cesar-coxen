import { useState } from "react";
import FondoImagen from "./FondoImagen";
import { supabase } from "./supabaseClient";

interface AperturaViewProps {
  usuarioActual: { nombre: string } | null;
  caja: string | null;
}

export default function AperturaView({
  usuarioActual,
  caja,
}: AperturaViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [fondoFijo, setFondoFijo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const registrarApertura = async () => {
    setLoading(true);
    setError("");
    if (!caja || caja === "" || caja === null || caja === undefined) {
      setError(
        'No se puede registrar apertura: el valor de "caja" es nulo o vacío. Contacte al administrador.'
      );
      setLoading(false);
      return;
    }
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().slice(0, 10);
    // Verificar si ya hay apertura hoy
    const { data: aperturas } = await supabase
      .from("cierres")
      .select("*")
      .eq("tipo_registro", "apertura")
      .eq("cajero", usuarioActual?.nombre)
      .eq("caja", caja)
      .gte("fecha", fechaHoy + "T00:00:00")
      .lte("fecha", fechaHoy + "T23:59:59");
    if (aperturas && aperturas.length > 0) {
      window.location.href = "/punto-de-venta";
      setLoading(false);
      return;
    }
    // Registrar apertura
    const { error: insertError } = await supabase.from("cierres").insert([
      {
        tipo_registro: "apertura",
        cajero: usuarioActual?.nombre,
        caja,
        fondo_fijo_registrado: parseFloat(fondoFijo),
        fondo_fijo: 0,
        efectivo_registrado: 0,
        efectivo_dia: 0,
        monto_tarjeta_registrado: 0,
        monto_tarjeta_dia: 0,
        transferencias_registradas: 0,
        transferencias_dia: 0,
        diferencia: 0,
      },
    ]);
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      // Verificar de nuevo y redirigir
      const { data: aperturas2 } = await supabase
        .from("cierres")
        .select("*")
        .eq("tipo_registro", "apertura")
        .eq("cajero", usuarioActual?.nombre)
        .eq("caja", caja)
        .gte("fecha", fechaHoy + "T00:00:00")
        .lte("fecha", fechaHoy + "T23:59:59");
      if (aperturas2 && aperturas2.length > 0) {
        window.location.href = "/punto-de-venta";
      }
    }
  };

  return (
    <FondoImagen>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100vw",
        }}
      >
        <button
          style={{
            fontSize: 28,
            padding: "24px 48px",
            borderRadius: 16,
            background: "#1976d2",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            boxShadow: "0 2px 12px #1976d222",
            cursor: "pointer",
            marginBottom: 32,
          }}
          onClick={() => setShowModal(true)}
        >
          Registrar Apertura
        </button>
        {showModal && (
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
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 8px 32px #1976d222",
                padding: 32,
                minWidth: 350,
              }}
            >
              <h2 style={{ color: "#1976d2", marginBottom: 18 }}>
                Fondo Fijo de Caja
              </h2>
              <input
                type="number"
                value={fondoFijo}
                onChange={(e) => setFondoFijo(e.target.value)}
                placeholder="Ingrese fondo fijo"
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 18,
                  marginBottom: 18,
                  width: "100%",
                }}
              />
              <div
                style={{ display: "flex", gap: 16, justifyContent: "center" }}
              >
                <button
                  onClick={registrarApertura}
                  disabled={loading || !fondoFijo}
                  style={{
                    background: "#1976d2",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    padding: "10px 32px",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  Registrar
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "#d32f2f",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                    padding: "10px 32px",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
              {error && (
                <div style={{ color: "red", marginTop: 12 }}>{error}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </FondoImagen>
  );
}
