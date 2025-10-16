import { useEffect, useState } from "react";
// Imagen de fondo personalizada
import { supabase } from "./supabaseClient";

export default function ResultadosCajaView() {
  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clave, setClave] = useState("");
  const [validando, setValidando] = useState(false);
  const [correcto, setCorrecto] = useState(false);
  // const [mostrarCerrar, setMostrarCerrar] = useState(false); // Eliminado para evitar error TS6133

  // Obtener usuario actual de localStorage
  const usuarioActual = (() => {
    try {
      const stored = localStorage.getItem("usuario");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const fetchCierres = async () => {
      setLoading(true);
      // Obtener fecha actual en formato YYYY-MM-DD
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const fechaHoy = `${yyyy}-${mm}-${dd}`;

      // Consultar registros de tipo 'cierre' entre las 00:00 y 23:59 del día actual
      const fechaInicio = `${fechaHoy} 00:00:00`;
      const fechaFin = `${fechaHoy} 23:59:59`;
      let query = supabase
        .from("cierres")
        .select("*")
        .eq("tipo_registro", "cierre")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin);
      // Si el usuario es cajero, filtrar por su id
      if (usuarioActual && usuarioActual.rol === "cajero") {
        query = query.eq("cajero_id", usuarioActual.id);
      }
      const { data, error } = await query;
      if (!error && data) {
        setCierres(data);
      }
      setLoading(false);
    };
    fetchCierres();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        overflowY: "auto",
        height: "100vh",
      }}
    >
      <style>{`
        @media (max-width: 600px) {
          .caja-responsive {
            padding: 16px !important;
            min-width: 0 !important;
            max-width: 98vw !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 16px #1976d222 !important;
          }
          .caja-responsive h2 {
            font-size: 1.3rem !important;
          }
          .caja-responsive img {
            width: 120px !important;
            height: 120px !important;
          }
        }
      `}</style>
      <div
        className="caja-responsive"
        style={{
          background: "linear-gradient(135deg, #e3f2fd 0%, #fff 100%)",
          borderRadius: 24,
          boxShadow: "0 12px 36px #1976d244",
          padding: "3vw 4vw 3vw 4vw",
          minWidth: 320,
          maxWidth: 480,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          margin: "auto",
          alignItems: "center",
          border: "1px solid #bbdefb",
          maxHeight: "98vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <img
            src="https://i.imgur.com/UiSIq00.jpeg"
            alt="Logo"
            style={{
              width: "clamp(120px, 30vw, 205px)",
              height: "clamp(120px, 28vw, 200px)",
              borderRadius: "50%",
              objectFit: "cover",
              boxShadow: "0 2px 8px #1976d222",
              background: "#fff",
              transition: "width 0.3s, height 0.3s",
            }}
          />
        </div>
        <h2
          style={{
            color: "#1976d2",
            marginBottom: 10,
            fontWeight: 900,
            fontSize: "clamp(1.3rem, 6vw, 2rem)",
            letterSpacing: 1.5,
            textShadow: "0 2px 8px #1976d222",
            textAlign: "center",
            transition: "font-size 0.3s",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "6px 18px",
              background: "#e3f2fd",
              borderRadius: 12,
              boxShadow: "0 2px 8px #1976d222",
            }}
          >
            Resultados de Caja
          </span>
        </h2>
        {/* Mostrar cajero, caja y fecha debajo del título */}
        {cierres.length > 0 && (
          <div
            style={{
              marginBottom: 18,
              fontSize: "clamp(1rem, 4vw, 1.1rem)",
              color: "#1976d2",
              background: "#e3f2fd",
              borderRadius: 12,
              padding: "10px 4vw",
              fontWeight: 700,
              boxShadow: "0 2px 8px #1976d222",
              textAlign: "center",
              border: "1px solid #bbdefb",
              transition: "font-size 0.3s, padding 0.3s",
            }}
          >
            <span style={{ marginRight: 18 }}>
              <b>Cajero:</b>{" "}
              <span style={{ color: "#1565c0" }}>{cierres[0].cajero}</span>
            </span>
            <span style={{ marginRight: 18 }}>
              <b>Caja:</b>{" "}
              <span style={{ color: "#1565c0" }}>{cierres[0].caja}</span>
            </span>
            <span>
              <b>Fecha:</b>{" "}
              <span style={{ color: "#1565c0" }}>
                {new Date(cierres[0].fecha).toLocaleDateString()}
              </span>
            </span>
          </div>
        )}
        {loading ? (
          <p>Cargando...</p>
        ) : cierres.length === 0 ? (
          <p>No hay cierres registrados hoy.</p>
        ) : (
          <>
            {/* Tabla de cierres oculta intencionalmente */}
            {/* Cálculos de diferencias y total */}
            <div
              style={{
                marginTop: 30,
                padding: "6vw 4vw",
                background: "linear-gradient(135deg, #fffde7 0%, #fff 100%)",
                borderRadius: 16,
                boxShadow: "0 4px 16px #fbc02d44",
                border: "1px solid #ffe082",
                width: "100%",
                maxWidth: 400,
                transition: "padding 0.3s",
              }}
            >
              <h3
                style={{
                  color: "#d32f2f",
                  fontWeight: 900,
                  fontSize: 22,
                  marginBottom: 18,
                  textAlign: "center",
                  letterSpacing: 1,
                }}
              >
                DIFERENCIA
              </h3>
              {cierres.length > 0 &&
                cierres
                  .filter(cierre => {
                    // Filtrar por usuario actual y fecha actual
                    if (!usuarioActual) return false;
                    const hoy = new Date();
                    const yyyy = hoy.getFullYear();
                    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
                    const dd = String(hoy.getDate()).padStart(2, "0");
                    const fechaHoy = `${yyyy}-${mm}-${dd}`;
                    const fechaCierre = cierre.fecha?.slice(0, 10);
                    return (
                      cierre.cajero_id === usuarioActual.id &&
                      fechaCierre === fechaHoy
                    );
                  })
                  .map((cierre, idx) => {
                  // Parsear valores numéricos
                  const fondoFijoRegistrado =
                    parseFloat(cierre.fondo_fijo_registrado) || 0;
                  const fondoFijo = parseFloat(cierre.fondo_fijo) || 0;
                  const montoTarjetaDia =
                    parseFloat(cierre.monto_tarjeta_dia) || 0;
                  const transferenciasRegistradas =
                    parseFloat(cierre.transferencias_registradas) || 0;
                  const transferenciasDia =
                    parseFloat(cierre.transferencias_dia) || 0;

                  const efectivoRegistrado =
                    parseFloat(cierre.efectivo_registrado) || 0;
                  const efectivoDia = parseFloat(cierre.efectivo_dia) || 0;
                  const montoTarjetaRegistrado =
                    parseFloat(cierre.monto_tarjeta_registrado) || 0;
                  // montoTarjetaDia ya está definido
                  // transferenciasRegistradas ya está definido
                  // transferenciasDia ya está definido

                  const diferenciaEfectivo = efectivoRegistrado - efectivoDia;
                  const diferenciaTarjeta =
                    montoTarjetaRegistrado - montoTarjetaDia;
                  const diferenciaTransferencia =
                    transferenciasRegistradas - transferenciasDia;

                  return (
                    <div key={idx} style={{ marginBottom: 10 }}>
                      <div>
                        <b>FONDO FIJO:</b>{" "}
                        {(fondoFijoRegistrado - fondoFijo).toFixed(2)}
                      </div>
                      <div>
                        <b>EFECTIVO:</b> {diferenciaEfectivo.toFixed(2)}
                      </div>
                      <div>
                        <b>TARJETA:</b> {diferenciaTarjeta.toFixed(2)}
                      </div>
                      <div>
                        <b>TRANSFERENCIA:</b>{" "}
                        {diferenciaTransferencia.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              {cierres.length > 0 && (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: 18 }}>
                    TOTAL:{" "}
                    {(() => {
                      let total = 0;
                      cierres.forEach((cierre) => {
                        const fondoFijoRegistrado =
                          parseFloat(cierre.fondo_fijo_registrado) || 0;
                        const fondoFijo = parseFloat(cierre.fondo_fijo) || 0;
                        const efectivoRegistrado =
                          parseFloat(cierre.efectivo_registrado) || 0;
                        const efectivoDia =
                          parseFloat(cierre.efectivo_dia) || 0;
                        const montoTarjetaRegistrado =
                          parseFloat(cierre.monto_tarjeta_registrado) || 0;
                        const montoTarjetaDia =
                          parseFloat(cierre.monto_tarjeta_dia) || 0;
                        const transferenciasRegistradas =
                          parseFloat(cierre.transferencias_registradas) || 0;
                        const transferenciasDia =
                          parseFloat(cierre.transferencias_dia) || 0;
                        const diferenciaFondoFijo =
                          fondoFijoRegistrado - fondoFijo;
                        const diferenciaEfectivo =
                          efectivoRegistrado - efectivoDia;
                        const diferenciaTarjeta =
                          montoTarjetaRegistrado - montoTarjetaDia;
                        const diferenciaTransferencia =
                          transferenciasRegistradas - transferenciasDia;
                        total +=
                          diferenciaFondoFijo +
                          diferenciaEfectivo +
                          diferenciaTarjeta +
                          diferenciaTransferencia;
                      });
                      return total.toFixed(2);
                    })()}
                  </div>
                  {/* Input y botón si el total es distinto de 0 */}
                  {(() => {
                    let total = 0;
                    cierres.forEach((cierre) => {
                      const efectivoRegistrado =
                        parseFloat(cierre.efectivo_registrado) || 0;
                      const efectivoDia = parseFloat(cierre.efectivo_dia) || 0;
                      const montoTarjetaRegistrado =
                        parseFloat(cierre.monto_tarjeta_registrado) || 0;
                      const montoTarjetaDia =
                        parseFloat(cierre.monto_tarjeta_dia) || 0;
                      const transferenciasRegistradas =
                        parseFloat(cierre.transferencias_registradas) || 0;
                      const transferenciasDia =
                        parseFloat(cierre.transferencias_dia) || 0;
                      const diferenciaEfectivo =
                        efectivoRegistrado - efectivoDia;
                      const diferenciaTarjeta =
                        montoTarjetaRegistrado - montoTarjetaDia;
                      const diferenciaTransferencia =
                        transferenciasRegistradas - transferenciasDia;
                      total +=
                        diferenciaEfectivo +
                        diferenciaTarjeta +
                        diferenciaTransferencia;
                    });
                    if (total !== 0) {
                      if (validando) {
                        return (
                          <div
                            style={{
                              marginTop: 24,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
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
                              Validando clave...
                            </div>
                          </div>
                        );
                      }
                      if (correcto) {
                        // Actualizar observacion y recargar automáticamente
                        (async () => {
                          const today = new Date();
                          const yyyy = today.getFullYear();
                          const mm = String(today.getMonth() + 1).padStart(
                            2,
                            "0"
                          );
                          const dd = String(today.getDate()).padStart(2, "0");
                          const fechaHoy = `${yyyy}-${mm}-${dd}`;
                          const { data: cierreHoy } = await supabase
                            .from("cierres")
                            .select("id")
                            .eq("tipo_registro", "cierre")
                            .gte("fecha", fechaHoy + "T00:00:00")
                            .lte("fecha", fechaHoy + "T23:59:59")
                            .single();
                          if (cierreHoy && cierreHoy.id) {
                            await supabase
                              .from("cierres")
                              .update({ observacion: "aclarado" })
                              .eq("id", cierreHoy.id);
                          }
                          window.location.reload();
                        })();
                        return (
                          <div
                            style={{
                              marginTop: 24,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                color: "#388e3c",
                                fontWeight: 700,
                                fontSize: 20,
                              }}
                            >
                              Correcto, aclarando...
                            </div>
                          </div>
                        );
                      }
                      return (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setValidando(true);
                            // Ocultar card de diferencias
                            // Consultar clave en Supabase
                            const { data, error } = await supabase
                              .from("claves_autorizacion")
                              .select("clave")
                              .eq("id", 1)
                              .single();
                            if (
                              !error &&
                              data &&
                              String(data.clave) === clave
                            ) {
                              setTimeout(() => {
                                setValidando(false);
                                setCorrecto(true);
                                setTimeout(() => {
                                  setCorrecto(false);
                                  // setMostrarCerrar(true); // Eliminado para evitar error TS2304
                                }, 100);
                              }, 800);
                            } else {
                              setValidando(false);
                              setCorrecto(false);
                              alert("Clave incorrecta");
                            }
                          }}
                          style={{
                            marginTop: 24,
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <label
                            htmlFor="claveAclaracion"
                            style={{ fontWeight: 600 }}
                          >
                            CLAVE DE ACLARACION
                          </label>
                          <input
                            id="claveAclaracion"
                            type="text"
                            value={clave}
                            onChange={(e) => setClave(e.target.value)}
                            style={{
                              padding: 8,
                              borderRadius: 6,
                              border: "1px solid #1976d2",
                              fontSize: 16,
                            }}
                          />
                          <button
                            type="submit"
                            style={{
                              padding: "10px 18px",
                              background: "#1976d2",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 16,
                              cursor: "pointer",
                            }}
                          >
                            GUARDAR
                          </button>
                        </form>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
