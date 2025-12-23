import AdminEditModal from "./AdminEditModal";
// ...existing code...
import { useEffect, useState } from "react";

interface Usuario {
  id: string;
  nombre: string;
  codigo: string;
  clave: string;
  rol: string;
  email?: string;
  caja?: string;
  ip?: string;
}

interface UsuariosViewProps {
  onBack: () => void;
}

export default function UsuariosView({ onBack }: UsuariosViewProps) {
  // Estados para el modal de edición de Admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEditId, setAdminEditId] = useState<string | null>(null);
  const [adminNombre, setAdminNombre] = useState("");
  const [adminClave, setAdminClave] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  const handleAdminUpdate = (adminUser: Usuario) => {
    setAdminNombre(adminUser.nombre || "");
    setAdminClave("");
    setAdminEmail(adminUser.email || "");
    setAdminEditId(adminUser.id);
    setShowAdminModal(true);
  };

  const handleAdminModalClose = () => {
    setShowAdminModal(false);
    setAdminEditId(null);
    setAdminNombre("");
    setAdminClave("");
    setAdminError("");
  };

  const handleAdminModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Debe tener mínimo 6 caracteres, al menos una letra y un signo
    if (
      !/^.*(?=.{6,})(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/.test(
        adminClave
      )
    ) {
      setAdminError(
        "La contraseña debe tener mínimo 6 caracteres, incluir una letra y un signo."
      );
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    try {
      await fetch(`${API_URL}?id=eq.${adminEditId}`, {
        method: "PATCH",
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          nombre: adminNombre,
          clave: adminClave,
          email: adminEmail,
        }),
      });
      // Recargar datos
      const res = await fetch(API_URL + "?select=*", {
        headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
      });
      const nuevosUsuarios = await res.json();
      setUsuarios(nuevosUsuarios);
      handleAdminModalClose();
    } catch {
      setAdminError("Error al guardar cambios");
    }
    setAdminLoading(false);
  };
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Partial<Usuario>>({});
  const [showModal, setShowModal] = useState(false);
  // Lista de cajas sugeridas (puedes modificar o cargar dinámicamente)
  const cajasDisponibles = ["caja1", "caja2", "caja3", "caja4", "caja5"];
  const [editId, setEditId] = useState<string | null>(null);

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/usuarios`;
  const API_KEY = import.meta.env.VITE_SUPABASE_KEY || "";

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
  const cajeroCount = usuarios.filter((u) => u.rol === "cajero").length;

  const limiteTotal = totalUsuarios >= 6;
  const limiteAdmin = form.rol === "admin" && adminCount >= 1;
  const limiteCajero = form.rol === "cajero" && cajeroCount >= 5;
  const limitePorRol = limiteAdmin || limiteCajero;

  const errorLimite = limiteTotal
    ? "No se pueden agregar más de 6 usuarios."
    : limiteAdmin
    ? "Solo puede haber 1 usuario admin."
    : limiteCajero
    ? "Solo puede haber 5 cajeros."
    : "";

  // Crear o editar usuario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limiteTotal || limitePorRol) {
      setError(errorLimite);
      return;
    }
    // Validación de contraseña: mínimo 6 caracteres, al menos una letra y un signo
    const clave = form.clave || "";
    if (
      !/^.*(?=.{6,})(?=.*[A-Za-z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).*$/.test(
        clave
      )
    ) {
      setError(
        "La contraseña debe tener mínimo 6 caracteres, incluir una letra y un signo."
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Forzar el valor del rol a 'cajero' o 'admin' según el select
      const rolVal =
        form.rol === "cajero" || form.rol === "admin" ? form.rol : "cajero";
      const formToSend = { ...form, rol: rolVal };
      if (editId) {
        await fetch(`${API_URL}?id=eq.${editId}`, {
          method: "PATCH",
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(formToSend),
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
          body: JSON.stringify(formToSend),
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

  // Eliminada la función de eliminación para prohibir borrar usuarios desde la UI;
  // solo se permite actualizar/editar usuarios.

  const handleEdit = (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm({
      nombre: usuario.nombre || "",
      codigo: usuario.codigo || "",
      clave: "", // Nunca mostrar la clave anterior
      rol: usuario.rol || "cajero",
      email: usuario.email || "",
      caja: usuario.caja || "",
      ip: usuario.ip || "",
    });
    setShowModal(true);
  };

  // const handleNew = () => {}; // Eliminado para evitar error TS6133

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
          --primary: #ffffff;
          --secondary: #f8fafc;
          --accent: #3b82f6;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --border: #e2e8f0;
          --shadow: 0 4px 20px rgba(0,0,0,0.06);
          --shadow-hover: 0 12px 32px rgba(0,0,0,0.12);
          --success: #10b981;
          --danger: #ef4444;
          --warning: #f59e0b;
        }

        .usuarios-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
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
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: #f1f5f9;
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
          background: #e2e8f0;
          border-color: var(--accent);
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
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
          box-shadow: 0 4px 12px rgba(59,130,246,0.4);
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
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--accent);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-top: 0.25rem;
        }

        .table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
          margin-bottom: 2rem;
          border: 1px solid var(--border);
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
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
          background: #f8fafc;
        }

        .btn-table {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight:#dbeafe; 
          color: #3b82f6; 
        }

        .btn-edit:hover { 
          background: #bfdbfe; 
          transform: scale(1.05);
        }

        .btn-delete { 
          background: #fee2e2; 
          color: #ef4444; 
        }

        .btn-delete:hover { 
          background: #fecaca; 
          transform: scale(1.05);
        }

        .form-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .form-input {
          background: #f8fafc;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
          background: whitewhite; border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; gap: 12px; align-items: center; box-shadow: 0 6px 18px rgba(0,0,0,0.06); transition: all 0.2s ease; }
        .user-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .user-avatar-sm { width: 56px; height: 56px; border-radius: 999px; display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; background:linear-gradient(135deg,#3b82f6,#8b5cf6); flex-shrink:0; }
        .user-body { flex:1; min-width:0; }
        .user-name { font-weight:700; color:var(--text-primary); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-meta { color:var(--text-secondary); font-size:13px; }

        .error {
          background: #fee2e2;
          color: #ef44440 0 3px rgba(30,136,229,0.1);
        }

        .form-input::placeholder {
          color: var(--text-secondary);
        }

        /* Cards para móvil (ocultas por defecto) */
        .cards-grid { display: none; }
        .user-card { background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; gap: 12px; align-items: center; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
        .user-avatar-sm { width: 56px; height: 56px; border-radius: 999px; display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; background:linear-gradient(135deg,#1e88e5,#42a5f5); flex-shrink:0; }
        .user-body { flex:1; min-width:0; }
        .user-name { font-weight:700; color:var(--text-primary); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .user-meta { color:var(--text-secondary); font-size:13px; }

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
          /* Mostrar cards y ocultar tabla en móvil */
          .table { display: none; }
          .table-container { box-shadow: none; }
          .cards-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
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
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Caja</th>
                  <th>IP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td style={{ color: "#43a047", fontWeight: 700 }}>
                      {u.id}
                    </td>
                    <td>
                      <strong>{u.nombre}</strong>
                    </td>
                    <td>{u.codigo}</td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {u.email || "-"}
                    </td>
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
                    <td style={{ color: "#43a047", fontWeight: 700 }}>
                      {u.caja || "-"}
                    </td>
                    <td>{u.ip || "-"}</td>
                    <td>
                      {u.rol !== "Admin" && (
                        <button
                          className="btn-table btn-edit"
                          onClick={() => handleEdit(u)}
                        >
                          Editar
                        </button>
                      )}
                      {u.rol === "Admin" && (
                        <button
                          className="btn-table btn-update"
                          onClick={() => handleAdminUpdate(u)}
                          style={{
                            background: "#1976d2",
                            color: "#fff",
                            marginLeft: 8,
                          }}
                        >
                          Actualizar
                        </button>
                      )}
                      {/* Eliminado botón de eliminar: sólo se permite editar/actualizar */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Cards view para móviles (oculto en escritorio) */}
            <div className="cards-grid" style={{ marginTop: 8 }}>
              {usuarios.map((u) => (
                <div className="user-card" key={u.id}>
                  <div className="user-avatar-sm">
                    {u.nombre?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="user-body">
                    <div className="user-name">
                      {u.nombre}{" "}
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        #{u.codigo}
                      </span>
                    </div>
                    <div className="user-meta">
                      {u.rol} · Caja: {u.caja || "-"} · IP: {u.ip || "-"}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {u.rol !== "Admin" && (
                      <button
                        className="btn-table btn-edit"
                        onClick={() => handleEdit(u)}
                      >
                        Editar
                      </button>
                    )}
                    {u.rol === "Admin" && (
                      <button
                        className="btn-table btn-update"
                        onClick={() => handleAdminUpdate(u)}
                        style={{ background: "#1976d2", color: "#fff" }}
                      >
                        Actualizar
                      </button>
                    )}
                    {/* Eliminado botón de eliminar en vista móvil */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón para abrir modal de nuevo usuario */}
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <button
            style={{
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 32px",
              fontWeight: 700,
              fontSize: 18,
              cursor: "pointer",
              boxShadow: "0 2px 8px #1976d222",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => {
              setEditId(null);
              setForm({
                nombre: "",
                codigo: "",
                clave: "",
                rol: "cajero",
                email: "",
                caja: "",
                ip: "",
              });
              setTimeout(() => setShowModal(true), 0);
            }}
          >
            <span role="img" aria-label="nuevo usuario">
              👤
            </span>{" "}
            Nuevo Usuario
          </button>
        </div>

        {/* Modal para crear/editar usuario */}
        <AdminEditModal
          open={showAdminModal}
          nombre={adminNombre}
          clave={adminClave}
          email={adminEmail}
          loading={adminLoading}
          error={adminError}
          onClose={handleAdminModalClose}
          onChangeNombre={setAdminNombre}
          onChangeClave={setAdminClave}
          onChangeEmail={setAdminEmail}
          onSubmit={handleAdminModalSubmit}
        />
        {showModal && (white",
                borderRadius: 24,
                padding: 32,
                minWidth: 320,
                maxWidth: 400,
                width: "100%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                position: "relative",
                color: var(--text-primary),
                border: "1px solid #e2e8f0",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "#f1f5f9",
                  border: "none",
                  color: var(--text-primary),
                  fontSize: 24,
                  cursor: "pointer",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
              <h3 style={{ color: var(--text-primary), marginBottom: "1rem", fontSize: "1.5rem", fontWeight: 800
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: 24,
                  cursor: "pointer",
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
              <h3 style={{ color: "#ffffff", marginBottom: "1rem" }}>
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
                  style={{ color: "#43a047", fontWeight: 700 }}
                />
                <input
                  className="form-input"
                  type="email"
                  placeholder="Email (opcional)"
                  value={form.email || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  style={{ color: "#43a047" }}
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
                  style={{ color: "#43a047", fontWeight: 700 }}
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
                  style={{ color: "#43a047", fontWeight: 700 }}
                />
                <select
                  className="form-input"
                  value="cajero"
                  disabled
                  style={{ color: "#43a047", fontWeight: 700 }}
                >
                  <option value="cajero">Cajero</option>
                </select>
                <select
                  className="form-input"
                  value={form.caja || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, caja: e.target.value }))
                  }
                  required
                  style={{ color: "#43a047", fontWeight: 700 }}
                >
                  <option value="">Selecciona caja</option>
                  {cajasDisponibles
                    .filter((caja) => {
                      // Permitir la caja si no está ocupada o si es la que tiene el usuario editado
                      const ocupada = usuarios.some(
                        (u) => u.caja === caja && (!editId || u.id !== editId)
                      );
                      return !ocupada || (editId && form.caja === caja);
                    })
                    .map((caja) => (
                      <option key={caja} value={caja}>
                        {caja}
                      </option>
                    ))}
                </select>
                {/* <input
                  className="form-input"
                  type="text"
                  placeholder="IP (opcional)"
                  value={form.ip || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ip: e.target.value }))
                  }
                /> */}
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
            {/* Fin del modal */}
          </div>
        )}
      </main>
    </div>
  );
}
