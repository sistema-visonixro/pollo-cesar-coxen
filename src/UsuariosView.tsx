import { useEffect, useState } from "react";

interface Usuario {
  id: string;
  nombre: string;
  codigo: string;
  clave: string;
  rol: string;
  ip?: string;
}

interface UsuariosViewProps {
  onBack: () => void;
}

export default function UsuariosView({ onBack }: UsuariosViewProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<Usuario>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const API_URL = "https://zyziaizfmfvtibhpqwda.supabase.co/rest/v1/usuarios";
  const API_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY";

  // Cargar usuarios
  useEffect(() => {
    fetch(API_URL + "?select=*", {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setUsuarios(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar usuarios");
        setLoading(false);
      });
  }, []);

  // ✅ CORREGIDO: Cálculos de límites (DESPUÉS de hooks)
  const totalUsuarios = usuarios.length;
  const adminCount = usuarios.filter((u) => u.rol === "Admin").length;
  const subAdminCount = usuarios.filter((u) => u.rol === "sub-Admin").length;
  const cajeroCount = usuarios.filter((u) => u.rol === "cajero").length;

  const limiteTotal = totalUsuarios >= 6;
  const limiteAdmin = form.rol === "admin" && adminCount >= 1;
  const limiteSubAdmin = form.rol === "sub-Admin" && subAdminCount >= 1;
  const limiteCajero = form.rol === "cajero" && cajeroCount >= 4;
  const limitePorRol = limiteAdmin || limiteSubAdmin || limiteCajero;

  const errorLimite = limiteTotal
    ? "No se pueden agregar más de 6 usuarios."
    : limiteAdmin
    ? "Solo puede haber 1 usuario admin."
    : limiteSubAdmin
    ? "Solo puede haber 1 usuario sub-Admin."
    : limiteCajero
    ? "Solo puede haber 4 cajeros."
    : "";

  // Crear o editar usuario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limiteTotal || limitePorRol) {
      setError(errorLimite);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (editId) {
        await fetch(`${API_URL}?id=eq.${editId}`, {
          method: "PATCH",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(form),
        });
      } else {
        await fetch(API_URL, {
          method: "POST",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(form),
        });
      }
      setForm({});
      setEditId(null);
      // Recargar datos
      const res = await fetch(API_URL + "?select=*", {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      setUsuarios(await res.json());
    } catch {
      setError("Error al guardar usuario");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar usuario permanentemente?")) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
        },
      });
      // Recargar datos
      const res = await fetch(API_URL + "?select=*", {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      setUsuarios(await res.json());
    } catch {
      setError("Error al eliminar usuario");
    }
    setLoading(false);
  };

  const handleEdit = (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm(usuario);
  };

  const handleNew = () => { // Se usa en el código
    setEditId(null);
    setForm({});
  };

  return (
    <div
      className="usuarios-enterprise"
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
          --text-secondary: #b0b3c1;
          --border: #2d3748;
          --shadow: 0 10px 30px rgba(0,0,0,0.3);
          --shadow-hover: 0 20px 40px rgba(0,0,0,0.4);
          --success: #2e7d32;
          --danger: #c62828;
          --warning: #f57c00;
        }

        .usuarios-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0;
        }

        .header {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
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

        .btn-back:hover {
          background: rgba(255,255,255,0.15);
          border-color: var(--text-secondary);
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .btn-primary {
          background: linear-gradient(135deg, #1e88e5, #42a5f5);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(30,136,229,0.4);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
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
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
          margin-bottom: 2rem;
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
          background: rgba(76,175,80,0.2); 
          color: #4caf50; 
        }

        .btn-edit:hover { background: rgba(76,175,80,0.3); }

        .btn-delete { 
          background: rgba(198,40,40,0.2); 
          color: #c62828; 
        }

        .btn-delete:hover { background: rgba(198,40,40,0.3); }

        .form-section {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 2rem;
          border: 1px solid var(--border);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-input {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #1e88e5;
          box-shadow: 0 0 0 3px rgba(30,136,229,0.1);
        }

        .form-input::placeholder {
          color: var(--text-secondary);
        }

        .error {
          background: rgba(198,40,40,0.1);
          color: #c62828;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid var(--danger);
          margin-bottom: 1rem;
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
          .main-content { padding: 1rem; }
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← Volver
          </button>
          <h1 className="page-title">Gestión de Usuarios</h1>
        </div>
     
      </header>

      <main className="main-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{totalUsuarios}</div>
            <div className="stat-label">Total Usuarios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{adminCount}</div>
            <div className="stat-label">Administradores</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{subAdminCount}</div>
            <div className="stat-label">Sub-Administradores</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{cajeroCount}</div>
            <div className="stat-label">Cajeros</div>
          </div>
        </div>

        {/* Error */}
        {(error || errorLimite) && (
          <div className="error">⚠️ {error || errorLimite}</div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="loading">⏳ Cargando usuarios...</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Rol</th>
                  <th>IP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre}</strong>
                    </td>
                    <td>{u.codigo}</td>
                    <td
                      style={{
                        color:
                          u.rol === "admin"
                            ? "#1e88e5"
                            : u.rol === "sub-Admin"
                            ? "#f57c00"
                            : "#4caf50",
                      }}
                    >
                      {u.rol}
                    </td>
                    <td>{u.ip || "-"}</td>
                    <td>
                      <button
                        className="btn-table btn-edit"
                        onClick={() => handleEdit(u)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-table btn-delete"
                        onClick={() => handleDelete(u.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Formulario */}
        <div className="form-section">
          <h3 style={{ color: "var(--text-primary)", marginBottom: "1rem" }}>
            {editId ? "✏️ Editar Usuario" : "👤 Nuevo Usuario"}
          </h3>
          <form onSubmit={handleSubmit} className="form-grid">
            <input
              className="form-input"
              type="text"
              placeholder="Nombre completo"
              value={form.nombre || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: e.target.value }))
              }
              required
            />
            <input
              className="form-input"
              type="text"
              placeholder="Código único"
              value={form.codigo || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, codigo: e.target.value }))
              }
              required
            />
            <input
              className="form-input"
              type="password"
              placeholder="Contraseña"
              value={form.clave || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, clave: e.target.value }))
              }
              required
            />
            <select
              className="form-input"
              value={form.rol || "cajero"}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              <option value="cajero">Cajero</option>
              <option value="sub-Admin">Sub-Administrador</option>
              <option value="admin">Administrador</option>
            </select>
            <input
              className="form-input"
              type="text"
              placeholder="IP (opcional)"
              value={form.ip || ""}
              onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || limiteTotal || limitePorRol}
              style={{ gridColumn: "1/-1", justifySelf: "start" }}
            >
              {loading
                ? "⏳ Guardando..."
                : editId
                ? "💾 Guardar Cambios"
                : "✅ Crear Usuario"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
