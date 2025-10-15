import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zyziaizfmfvtibhpqwda.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY"
);

interface GastosViewProps {
  onBack?: () => void;
}

interface Gasto {
  id: number;
  fecha: string;
  monto: string;
  motivo: string;
}

export default function GastosView({ onBack }: GastosViewProps) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [montoTotal, setMontoTotal] = useState(0);
  const [nuevoGasto, setNuevoGasto] = useState({
    fecha: "",
    monto: "",
    motivo: "",
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editGasto, setEditGasto] = useState({
    fecha: "",
    monto: "",
    motivo: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGastos();
  }, []);

  async function fetchGastos() {
    setLoading(true);
    try {
      let query = supabase
        .from("gastos")
        .select("*")
        .order("fecha", { ascending: false });
      if (fechaDesde && fechaHasta) {
        query = supabase
          .from("gastos")
          .select("*")
          .gte("fecha", fechaDesde)
          .lte("fecha", fechaHasta)
          .order("fecha", { ascending: false });
      }
      const { data } = await query;
      setGastos(data || []);
      calcularTotal(data || []);
    } catch (error) {
      console.error("Error fetching gastos:", error);
    } finally {
      setLoading(false);
    }
  }

  function calcularTotal(data: Gasto[]) {
    const total = data.reduce(
      (sum, g) => sum + parseFloat(g.monto?.toString() || "0"),
      0
    );
    setMontoTotal(total);
  }

  async function agregarGasto() {
    if (!nuevoGasto.fecha || !nuevoGasto.monto || !nuevoGasto.motivo) return;
    setLoading(true);
    try {
      await supabase
        .from("gastos")
        .insert([
          {
            fecha: nuevoGasto.fecha,
            monto: nuevoGasto.monto,
            motivo: nuevoGasto.motivo,
          },
        ]);
      setNuevoGasto({ fecha: "", monto: "", motivo: "" });
      fetchGastos();
    } catch (error) {
      console.error("Error adding gasto:", error);
    }
  }

  async function eliminarGasto(id: number) {
    if (!window.confirm("¿Eliminar este gasto permanentemente?")) return;
    setLoading(true);
    try {
      await supabase.from("gastos").delete().eq("id", id);
      fetchGastos();
    } catch (error) {
      console.error("Error deleting gasto:", error);
    }
  }

  async function guardarEdicion() {
    if (!editGasto.fecha || !editGasto.monto || !editGasto.motivo) return;
    setLoading(true);
    try {
      await supabase.from("gastos").update(editGasto).eq("id", editId);
      setEditId(null);
      setEditGasto({ fecha: "", monto: "", motivo: "" });
      fetchGastos();
    } catch (error) {
      console.error("Error updating gasto:", error);
    }
  }

  const totalGastos = gastos.length;
  const promedioGasto =
    totalGastos > 0 ? (montoTotal / totalGastos).toFixed(2) : "0.00";

  return (
    <div
      className="gastos-enterprise"
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
        .gastos-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden;
        }
        :root {
          --primary: #1a1a2e;
          --secondary: #16213e;
          --accent: #0f3460;
          --text-primary: #ffffff;
          --text-secondary: #b0b3c1;
          --border: #2d3748;
          --shadow: 0 10px 30px rgba(0,0,0,0.3);
          --shadow-hover: 0 20px 40px rgba(0,0,0,0.4);
          --success: #2e7d32;
          --danger: #c62828;
          --warning: #f57c00;
          --info: #1976d2;
        }

        .gastos-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2rem;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
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
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: rgba(255,255,255,0.1);
          color: var(--text-primary);
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
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--danger);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .filters {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-input {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
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

        .form-section {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-input {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          background: rgba(255,255,255,0.08);
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border);
        }

        .table td {
          padding: 1rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .table tr:hover {
          background: rgba(255,255,255,0.05);
        }

        .btn-table {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-right: 8px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .btn-edit { 
          background: rgba(255,152,0,0.2); 
          color: #ff9800; 
        }

        .btn-delete { 
          background: rgba(198,40,40,0.2); 
          color: #c62828; 
        }

        .btn-save { 
          background: var(--success); 
          color: white; 
        }

        .btn-cancel { 
          background: var(--danger); 
          color: white; 
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .header { flex-direction: column; gap: 1rem; }
          .filters, .form-grid { grid-template-columns: 1fr; }
          .gastos-enterprise { padding: 1rem; }
        }
      `}</style>

      <div className="container">
        <header className="header">
          <div className="header-left">
            {onBack && (
              <button className="btn-back" onClick={onBack}>
                ← Volver
              </button>
            )}
            <h1 className="page-title">💸 Control de Gastos</h1>
          </div>
        </header>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">
              L{" "}
              {montoTotal.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Total Gastos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalGastos}</div>
            <div className="stat-label">Registros</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">L {promedioGasto}</div>
            <div className="stat-label">Promedio</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters">
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="filter-input"
            placeholder="Desde"
          />
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="filter-input"
            placeholder="Hasta"
          />
          <button
            className="btn-primary"
            onClick={fetchGastos}
            disabled={loading}
          >
            {loading ? "⏳" : "🔍"} Filtrar
          </button>
        </div>

        {/* Formulario Nuevo Gasto */}
        <div className="form-section">
          <h3 style={{ color: "var(--text-primary)", marginBottom: "1rem" }}>
            ➕ Nuevo Gasto
          </h3>
          <div className="form-grid">
            <input
              type="date"
              value={nuevoGasto.fecha}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })
              }
              className="form-input"
              required
            />
            <input
              type="number"
              placeholder="Monto (L)"
              value={nuevoGasto.monto}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, monto: e.target.value })
              }
              className="form-input"
              required
              step="0.01"
            />
            <input
              type="text"
              placeholder="Motivo del gasto"
              value={nuevoGasto.motivo}
              onChange={(e) =>
                setNuevoGasto({ ...nuevoGasto, motivo: e.target.value })
              }
              className="form-input"
              required
            />
            <button
              onClick={agregarGasto}
              className="btn-primary"
              disabled={
                loading ||
                !nuevoGasto.fecha ||
                !nuevoGasto.monto ||
                !nuevoGasto.motivo
              }
            >
              {loading ? "⏳" : "✅"} Agregar
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div className="table-container">
          {loading ? (
            <div className="loading">⏳ Cargando gastos...</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Motivo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) =>
                  editId === g.id ? (
                    <tr key={g.id}>
                      <td>
                        <input
                          type="date"
                          value={editGasto.fecha}
                          onChange={(e) =>
                            setEditGasto({
                              ...editGasto,
                              fecha: e.target.value,
                            })
                          }
                          className="form-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editGasto.monto}
                          onChange={(e) =>
                            setEditGasto({
                              ...editGasto,
                              monto: e.target.value,
                            })
                          }
                          className="form-input"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editGasto.motivo}
                          onChange={(e) =>
                            setEditGasto({
                              ...editGasto,
                              motivo: e.target.value,
                            })
                          }
                          className="form-input"
                        />
                      </td>
                      <td>
                        <button
                          onClick={guardarEdicion}
                          className="btn-table btn-save"
                          disabled={loading}
                        >
                          💾
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="btn-table btn-cancel"
                          disabled={loading}
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={g.id}>
                      <td>{g.fecha}</td>
                      <td style={{ color: "var(--danger)" }}>
                        L {parseFloat(g.monto).toFixed(2)}
                      </td>
                      <td>{g.motivo}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditId(g.id);
                            setEditGasto({
                              fecha: g.fecha,
                              monto: g.monto,
                              motivo: g.motivo,
                            });
                          }}
                          className="btn-table btn-edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => eliminarGasto(g.id)}
                          className="btn-table btn-delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
