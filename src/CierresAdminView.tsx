import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function CierresAdminView({
  onVolver,
}: {
  onVolver?: () => void;
}) {
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().slice(0, 10);
  });
  const [cierres, setCierres] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroId, setFiltroId] = useState<number | null>(null);
  const [showClaveModal, setShowClaveModal] = useState(false);
  const [clave, setClave] = useState<string>("");
  const [loadingClave, setLoadingClave] = useState(false);
  const [claveError, setClaveError] = useState<string>("");
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [cajaCierre, setCajaCierre] = useState<any>(null);
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [cierreError, setCierreError] = useState("");
  const [valoresCierre, setValoresCierre] = useState<any | null>(null);

  useEffect(() => {
    cargarCierres();
  }, [fecha]);

  const cargarCierres = async () => {
    setLoading(true);
    try {
      let query = supabase.from("cierres").select("*");
      if (fecha) {
        query = query
          .gte("fecha", fecha + "T00:00:00")
          .lte("fecha", fecha + "T23:59:59");
      }
      const { data, error } = await query;
      if (!error) {
        setCierres(data || []);
      }
    } catch (error) {
      console.error("Error loading cierres:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClaveModal = async () => {
    setShowClaveModal(true);
    await fetchClave();
  };

  const fetchClave = async () => {
    setLoadingClave(true);
    setClaveError("");
    try {
      const { data, error } = await supabase
        .from("claves_autorizacion")
        .select("clave")
        .eq("id", 1)
        .single();
      if (error) {
        setClaveError(`Error al obtener la clave: ${error.message}`);
      } else {
        setClave(data?.clave || "");
      }
    } catch (error) {
      setClaveError("Error de conexión");
    } finally {
      setLoadingClave(false);
    }
  };

  const actualizarClave = async () => {
    setLoadingClave(true);
    setClaveError("");
    try {
      const nuevoClave = Math.floor(100000 + Math.random() * 900000).toString();
      const { error } = await supabase
        .from("claves_autorizacion")
        .update({ clave: nuevoClave })
        .eq("id", 1);
      if (error) {
        setClaveError("Error al actualizar la clave");
      } else {
        setClave(nuevoClave);
      }
    } catch (error) {
      setClaveError("Error de conexión");
    } finally {
      setLoadingClave(false);
    }
  };

  const handleVerCaja = (apertura: any) => {
    setFiltroId(apertura.id);
  };

  const handleAbrirCierre = async (apertura: any) => {
    setCajaCierre(apertura);
    setCierreError("");
    await calcularValoresCierre(apertura);
    setShowCierreModal(true);
  };

  const calcularValoresCierre = async (apertura: any) => {
    const fechaCierre = apertura.fecha;
    const cajero = apertura.cajero;
    const caja = apertura.caja;

    const { data: aperturas } = await supabase
      .from("cierres")
      .select("fondo_fijo_registrado")
      .eq("tipo_registro", "apertura")
      .eq("cajero", cajero)
      .eq("caja", caja)
      .gte("fecha", fechaCierre.slice(0, 10) + "T00:00:00")
      .lte("fecha", fechaCierre.slice(0, 10) + "T23:59:59");

    const fondoFijoDia =
      aperturas && aperturas.length > 0
        ? parseFloat(aperturas[0].fondo_fijo_registrado)
        : 0;

    const desde = fechaCierre.slice(0, 10) + "T00:00:00";
    const hasta = fechaCierre.slice(0, 10) + "T23:59:59";

    const [
      { data: pagosEfectivo },
      { data: pagosTarjeta },
      { data: pagosTrans },
    ] = await Promise.all([
      supabase
        .from("pagos")
        .select("monto, fecha_hora")
        .eq("tipo", "Efectivo")
        .eq("cajero", cajero)
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta),
      supabase
        .from("pagos")
        .select("monto, fecha_hora")
        .eq("tipo", "Tarjeta")
        .eq("cajero", cajero)
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta),
      supabase
        .from("pagos")
        .select("monto, fecha_hora")
        .eq("tipo", "Transferencia")
        .eq("cajero", cajero)
        .gte("fecha_hora", desde)
        .lte("fecha_hora", hasta),
    ]);

    const efectivoDia =
      pagosEfectivo?.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0) || 0;
    const tarjetaDia =
      pagosTarjeta?.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0) || 0;
    const transferenciasDia =
      pagosTrans?.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0) || 0;

    const fondoFijoRegistrado = 0;
    const efectivoRegistrado = 0;
    const montoTarjetaRegistrado = 0;
    const transferenciasRegistradas = 0;

    const diferencia =
      efectivoDia + tarjetaDia + transferenciasDia + fondoFijoDia;
    const observacion = diferencia === 0 ? "cuadrado" : "sin aclarar";

    setValoresCierre({
      fondoFijoRegistrado,
      fondoFijoDia,
      efectivoRegistrado,
      efectivoDia,
      montoTarjetaRegistrado,
      tarjetaDia,
      transferenciasRegistradas,
      transferenciasDia,
      diferencia,
      observacion,
    });
  };

  let cierresFiltrados: any[] = cierres;
  if (filtroId !== null) {
    cierresFiltrados = cierres.filter((c: any) => c.id === filtroId);
  }

  const aperturasFiltradas = cierres.filter(
    (c) =>
      c.tipo_registro === "apertura" &&
      (fecha ? c.fecha.slice(0, 10) === fecha : true)
  );

  const cajasAbiertasList = aperturasFiltradas.filter((ap) => {
    return !cierres.some(
      (ci) =>
        ci.tipo_registro === "cierre" &&
        ci.caja === ap.caja &&
        ci.cajero === ap.cajero &&
        ci.fecha.slice(0, 10) === ap.fecha.slice(0, 10)
    );
  });
  const cajasAbiertas = cajasAbiertasList.length;

  const sumaDiferencia = cierres
    .filter(
      (c) => c.tipo_registro === "cierre" && c.observacion === "sin aclarar"
    )
    .reduce((sum, c) => sum + (Number(c.diferencia) || 0), 0);

  const handleCerrarCaja = async () => {
    if (!cajaCierre || !valoresCierre) return;

    setCerrandoCaja(true);
    setCierreError("");

    try {
      const cierre = {
        tipo_registro: "cierre",
        caja: cajaCierre.caja,
        cajero: cajaCierre.cajero,
        fecha: cajaCierre.fecha,
        fondo_fijo_registrado: valoresCierre.fondoFijoRegistrado,
        fondo_fijo: valoresCierre.fondoFijoDia,
        efectivo_registrado: valoresCierre.efectivoRegistrado,
        efectivo_dia: valoresCierre.efectivoDia,
        monto_tarjeta_registrado: valoresCierre.montoTarjetaRegistrado,
        monto_tarjeta_dia: valoresCierre.tarjetaDia,
        transferencias_registradas: valoresCierre.transferenciasRegistradas,
        transferencias_dia: valoresCierre.transferenciasDia,
        diferencia: valoresCierre.diferencia,
        observacion: valoresCierre.observacion,
      };

      const { error } = await supabase.from("cierres").insert([cierre]);
      if (error) {
        setCierreError("Error al registrar el cierre: " + error.message);
      } else {
        setShowCierreModal(false);
        setCajaCierre(null);
        setValoresCierre(null);
        await cargarCierres();
      }
    } catch (error) {
      setCierreError("Error de conexión");
    } finally {
      setCerrandoCaja(false);
    }
  };

  const handleAclararCierre = async (cierreId: number) => {
    try {
      const { error } = await supabase
        .from("cierres")
        .update({ observacion: "aclarado" })
        .eq("id", cierreId);
      if (!error) {
        await cargarCierres();
      }
    } catch (error) {
      console.error("Error aclarando cierre:", error);
    }
  };

  return (
    <div
      className="cierres-enterprise"
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "100vh",
        minWidth: "100vw",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <style>{`
        body, #root {
          width: 100vw !important;
          height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: block !important;
          max-width: none !important;
          background: unset !important;
        }
        :root {
          --primary: #1a1a2e;
          --secondary: #16213e;
          --accent: #0f3460;
          --text-primary: #ffffff;
          --text-secondary: #ffffff;
          --border: #2d3748;
          --shadow: 0 10px 30px rgba(0,0,0,0.3);
          --shadow-hover: 0 20px 40px rgba(0,0,0,0.4);
          --success: #2e7d32;
          --danger: #c62828;
          --warning: #f57c00;
          --info: #1976d2;
        }

        .cierres-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2rem;
          color: #fff;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          color: #fff;
        }

        .header {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
          color: #fff;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #fff;
        }

        .btn-back {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-title {
          color: #fff;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #fff;
        }

        .date-input {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
          color: #fff;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
          color: #fff;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .stat-icon { 
          font-size: 2rem; 
          margin-bottom: 0.5rem; 
          color: #fff;
        }

        .stat-title { 
          color: #fff;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value { 
          font-size: 2rem; 
          font-weight: 800; 
          margin-bottom: 1rem;
          color: #fff;
        }

        .open-card { 
          border-left: 4px solid var(--success); 
        }

        .open-card .stat-icon { color: var(--success); }
        .open-card .stat-value { color: var(--success); }

        .alert-card { 
          border-left: 4px solid var(--warning); 
        }

        .alert-card .stat-icon { color: var(--warning); }
        .alert-card .stat-value { color: var(--warning); }

        .open-list {
          margin-top: 1rem;
          max-height: 200px;
          overflow-y: auto;
          color: #fff;
        }

        .open-item {
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #fff;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 0.75rem;
          border-radius: 6px;
          margin-left: 4px;
          color: #fff;
        }

        .btn-close { 
          background: var(--danger); 
          color: #fff; 
        }

        .btn-view { 
          background: var(--success); 
          color: #fff; 
        }

        .clave-btn {
          width: 100%;
          background: linear-gradient(135deg, #9c27b0, #ba68c8);
          color: #fff;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          margin-top: 1rem;
        }

        .title {
          color: #fff;
          font-weight: 700;
          font-size: 1.75rem;
          margin-bottom: 2rem;
          text-align: center;
        }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
          color: #fff;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          color: #fff;
        }

        .table th {
          background: rgba(255,255,255,0.08);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: #fff;
          border-bottom: 1px solid var(--border);
        }

        .table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          color: #fff;
        }

        .status-sin-aclarar { 
          color: var(--danger); 
          background: rgba(198,40,40,0.1); 
          padding: 4px 8px; 
          border-radius: 6px; 
          font-weight: 600; 
        }

        .status-cuadrado { 
          color: var(--success); 
          background: rgba(46,125,50,0.1); 
          padding: 4px 8px; 
          border-radius: 6px; 
          font-weight: 600; 
        }

        .status-aclarado { 
          color: var(--info); 
          background: rgba(25,118,210,0.1); 
          padding: 4px 8px; 
          border-radius: 6px; 
          font-weight: 600; 
        }

        .btn-aclarar {
          background: var(--success);
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 4px 10px;
          cursor: pointer;
          font-size: 0.75rem;
          margin-left: 8px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
          min-width: 400px;
          max-width: 90vw;
          max-height: 90vh;
          overflow-y: auto;
          color: #fff;
        }

        .modal-title {
          color: #fff;
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .clave-display {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: 6px;
          text-align: center;
          background: linear-gradient(135deg, #9c27b0, #ba68c8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 1rem 0;
        }

        .valores-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
          margin: 1rem 0;
          color: #fff;
        }

        .valor-item {
          background: rgba(255,255,255,0.05);
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
          border: 1px solid var(--border);
          color: #fff;
        }

        .valor-diferencia {
          font-weight: 700;
          font-size: 1.1rem;
          color: #fff;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: #fff;
        }

        @media (max-width: 768px) {
          .header { flex-direction: column; gap: 1rem; }
          .stats-grid { grid-template-columns: 1fr; }
          .open-item { flex-direction: column; gap: 8px; text-align: center; }
          .valores-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="container">
        <header className="header">
          <div className="header-left">
            <button
              className="btn-back"
              onClick={onVolver ? onVolver : () => window.history.back()}
            >
              ← Volver
            </button>
            <h1 className="page-title">🔒 Cierres Administrativos</h1>
          </div>
          <div className="header-controls">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="date-input"
            />
            <button className="btn-secondary" onClick={() => setFecha("")}>
              Todos
            </button>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card open-card">
            <div className="stat-icon">🟢</div>
            <div className="stat-title">Cajas abiertas</div>
            <div className="stat-value">{cajasAbiertas}</div>
            {cajasAbiertasList.length > 0 && (
              <div className="open-list">
                {cajasAbiertasList.map((ap, idx) => (
                  <div key={idx} className="open-item">
                    <span>
                      <strong>Caja:</strong> {ap.caja} |{" "}
                      <strong>Cajero:</strong> {ap.cajero}
                    </span>
                    <div>
                      <button
                        className="btn-small btn-view"
                        onClick={() => handleVerCaja(ap)}
                      >
                        👁️ Ver
                      </button>
                      <button
                        className="btn-small btn-close"
                        onClick={() => handleAbrirCierre(ap)}
                      >
                        🔒 Cerrar
                      </button>
                    </div>
                  </div>
                ))}
                {filtroId !== null && (
                  <button
                    className="btn-small btn-secondary"
                    onClick={() => setFiltroId(null)}
                    style={{ width: "100%" }}
                  >
                    Quitar filtro
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="stat-card alert-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-title">Diferencia sin aclarar</div>
            <div className="stat-value">
              L{" "}
              {sumaDiferencia.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <button className="clave-btn" onClick={handleOpenClaveModal}>
              🔑 Clave Aclaración
            </button>
          </div>
        </div>

        <h2 className="title">📊 Cierres Registrados</h2>
        {loading ? (
          <div className="loading">⏳ Cargando cierres...</div>
        ) : (
          <div
            className="table-container"
            style={{
              maxWidth: "1800px",
              width: "100%",
              margin: "0 auto",
              overflowX: "auto",
              padding: "0.5rem",
            }}
          >
            <table
              className="table"
              style={{
                fontSize: "0.85rem",
                minWidth: "1100px",
                width: "max-content",
              }}
            >
              <thead>
                <tr>
                  {cierresFiltrados.length > 0 &&
                    Object.keys(cierresFiltrados[0]).map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0.5rem",
                          minWidth: "120px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.replace(/_/g, " ").toUpperCase()}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {cierresFiltrados.map((c, idx) => (
                  <tr key={c.id || idx}>
                    {Object.keys(c).map((col) => {
                      const valor = c[col];
                      const esObservacion = col === "observacion";
                      let className = "";
                      if (esObservacion) {
                        if (valor === "sin aclarar")
                          className = "status-sin-aclarar";
                        else if (valor === "cuadrado")
                          className = "status-cuadrado";
                        else if (valor === "aclarado")
                          className = "status-aclarado";
                      }
                      return (
                        <td
                          key={col}
                          className={className}
                          style={{
                            padding: "0.5rem",
                            minWidth: "120px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {valor}
                          {esObservacion && valor === "sin aclarar" && (
                            <button
                              className="btn-aclarar"
                              onClick={() => handleAclararCierre(c.id)}
                            >
                              ✅ Aclarar
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Cierre - CORREGIDO */}
        {showCierreModal && cajaCierre && (
          <div
            className="modal-overlay"
            onClick={() => setShowCierreModal(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">🔒 Cerrar Caja</h3>
              <div
                style={{
                  margin: "1rem 0",
                  padding: "1rem",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <p>
                  <strong>📦 Caja:</strong> {cajaCierre.caja}
                </p>
                <p>
                  <strong>👤 Cajero:</strong> {cajaCierre.cajero}
                </p>
                <p>
                  <strong>📅 Fecha:</strong> {cajaCierre.fecha.slice(0, 10)}
                </p>
                {valoresCierre && (
                  <div className="valores-grid">
                    <div className="valor-item">
                      <div>Fondo fijo</div>
                      <div>L {valoresCierre.fondoFijoDia.toFixed(2)}</div>
                    </div>
                    <div className="valor-item">
                      <div>Efectivo</div>
                      <div>L {valoresCierre.efectivoDia.toFixed(2)}</div>
                    </div>
                    <div className="valor-item">
                      <div>Tarjeta</div>
                      <div>L {valoresCierre.tarjetaDia.toFixed(2)}</div>
                    </div>
                    <div className="valor-item">
                      <div>Transferencias</div>
                      <div>L {valoresCierre.transferenciasDia.toFixed(2)}</div>
                    </div>
                    <div
                      className="valor-item valor-diferencia"
                      style={{
                        color:
                          valoresCierre.diferencia === 0
                            ? "var(--success)"
                            : "var(--danger)",
                        background:
                          valoresCierre.diferencia === 0
                            ? "rgba(46,125,50,0.1)"
                            : "rgba(198,40,40,0.1)",
                      }}
                    >
                      <div>
                        <strong>Total</strong>
                      </div>
                      <div>
                        <strong>L {valoresCierre.diferencia.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {cierreError && (
                <p style={{ color: "var(--danger)", margin: "1rem 0" }}>
                  {cierreError}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowCierreModal(false);
                    setValoresCierre(null);
                  }}
                  disabled={cerrandoCaja}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleCerrarCaja}
                  disabled={cerrandoCaja}
                >
                  {cerrandoCaja ? "⏳ Cerrando..." : "✅ Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Clave - CORREGIDO */}
        {showClaveModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowClaveModal(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">🔑 Clave de Aclaración</h3>
              {loadingClave ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  ⏳ Cargando...
                </div>
              ) : claveError ? (
                <p style={{ color: "var(--danger)", textAlign: "center" }}>
                  {claveError}
                </p>
              ) : (
                <div className="clave-display">{clave}</div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                }}
              >
                <button
                  className="btn-secondary"
                  onClick={() => setShowClaveModal(false)}
                  disabled={loadingClave}
                >
                  Cerrar
                </button>
                <button
                  className="btn-primary"
                  onClick={actualizarClave}
                  disabled={loadingClave}
                >
                  {loadingClave ? "⏳ Actualizando..." : "🔄 Nueva Clave"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
