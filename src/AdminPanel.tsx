import type { FC } from "react";

type ViewType =
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
  | "cierreadmin";

const cards: {
  label: string;
  icon: string;
  view: ViewType;
  color: string;
  subtitle: string;
}[] = [
  {
    label: "Gestión de Usuarios",
    icon: "👥",
    view: "usuarios",
    color: "#1e88e5",
    subtitle: "Roles y permisos",
  },
  {
    label: "Control de Inventario",
    icon: "📦",
    view: "inventario",
    color: "#2e7d32",
    subtitle: "Stock y productos",
  },
  {
    label: "CAI y Facturación",
    icon: "🧾",
    view: "cai",
    color: "#f57c00",
    subtitle: "Documentos fiscales",
  },
  {
    label: "Reportes Financieros",
    icon: "📊",
    view: "resultados",
    color: "#c62828",
    subtitle: "Análisis de ventas",
  },
  {
    label: "Registro de Gastos",
    icon: "💰",
    view: "gastos",
    color: "#6a1b9a",
    subtitle: "Control presupuestario",
  },
  {
    label: "Cierre de Caja",
    icon: "🔒",
    view: "cierreadmin",
    color: "#f57c00",
    subtitle: "Conciliación diaria",
  },
];

interface AdminPanelProps {
  onSelect: (view: ViewType) => void;
  user: any;
}

const AdminPanel: FC<AdminPanelProps> = ({ onSelect, user }) => (
  <div
    className="admin-panel-enterprise"
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
      }

      * {
        box-sizing: border-box;
      }

      .admin-panel-enterprise {
        min-height: 100vh;
        background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow-x: hidden;
      }
      
      .container {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        max-width: none;
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      
      .header {
        background: rgba(26, 26, 46, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--border);
        padding: 2rem 2.5rem;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      
      .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        margin: 0;
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--text-primary);
        text-decoration: none;
      }
      
      .user-info {
        display: flex;
        align-items: center;
        gap: 16px;
        color: var(--text-secondary);
      }
      
      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1e88e5, #42a5f5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: white;
        font-size: 1.1rem;
      }
      
      .user-details h1 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .user-role {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin: 0;
      }
      
      .main-content {
        padding: 3rem 2.5rem;
        max-width: 1400px;
        margin: 0 auto;
      }
      
      .welcome-section {
        text-align: center;
        margin-bottom: 4rem;
      }
      
      .welcome-title {
        font-size: clamp(2rem, 4vw, 3.5rem);
        font-weight: 700;
        background: linear-gradient(135deg, var(--text-primary) 0%, #e0e7ff 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 1rem 0;
        letter-spacing: -0.02em;
      }
      
      .welcome-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
        margin: 0;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        line-height: 1.6;
      }
      
      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 2rem;
      }
      
      .card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(16px);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 2rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      
      .card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--card-color), transparent);
      }
      
      .card:hover {
        transform: translateY(-8px);
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--text-secondary);
        box-shadow: var(--shadow-hover);
      }
      
      .card-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 1.5rem;
      }
      
      .card-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.75rem;
        background: linear-gradient(135deg, var(--card-color), var(--card-color)80);
        color: white;
        flex-shrink: 0;
      }
      
      .card-content h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1.3;
      }
      
      .card-subtitle {
        margin: 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-weight: 400;
      }
      
      .card-footer {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: flex-end;
      }
      
      .card-arrow {
        color: var(--text-secondary);
        transition: color 0.3s ease;
      }
      
      .card:hover .card-arrow {
        color: var(--text-primary);
        transform: translateX(4px);
      }
      
      @media (max-width: 1024px) {
        .cards-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .main-content { padding: 2rem 1.5rem; }
        .header { padding: 1.5rem; }
      }
      
      @media (max-width: 768px) {
        .header-content { flex-direction: column; gap: 1rem; text-align: center; }
        .cards-grid { grid-template-columns: 1fr; max-width: 100%; }
        .main-content { padding: 1.5rem 1rem; }
        .header { padding: 1.5rem 1rem; }
        .welcome-section { margin-bottom: 2rem; }
      }
      
      @media (max-width: 480px) {
        .card { padding: 1.5rem; }
        .card-header { gap: 12px; }
        .card-icon { width: 48px; height: 48px; font-size: 1.5rem; }
      }
    `}</style>

    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <img
              src="https://i.imgur.com/4M9UCRM.jpeg"
              alt="Logo"
              style={{
                width: 418,
                height: 158,
                borderRadius: 12,
                objectFit: "cover",
              }}
            />
            <span
              style={{
                display: "block",
                textAlign: "center",
                fontWeight: 800,
                fontSize: "1.7rem",
                color: "#fff",
                marginTop: "0.5rem",
                letterSpacing: "2px",
              }}
            >
              pollos cesar
            </span>
          </div>
        </div>
        <div className="user-info">
          <div className="user-avatar">
            {user.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <h1>{user.nombre}</h1>
            <p className="user-role">Administrador</p>
          </div>
        </div>
      </div>
    </header>

    <main className="main-content">
      <div className="welcome-section">
        <h1 className="welcome-title">Panel de Control</h1>
       
      </div>

      <div className="cards-grid">
        {cards.map((card) => (
          <div
            key={card.view}
            className="card"
            onClick={() => onSelect(card.view)}
            style={{ "--card-color": card.color } as React.CSSProperties}
          >
            <div className="card-header">
              <div
                className="card-icon"
                style={{ "--card-color": card.color } as React.CSSProperties}
              >
                {card.icon}
              </div>
              <div className="card-content">
                <h3>{card.label}</h3>
                <p className="card-subtitle">{card.subtitle}</p>
              </div>
            </div>
            <div className="card-footer">
              <span className="card-arrow">→</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  </div>
);

export default AdminPanel;
