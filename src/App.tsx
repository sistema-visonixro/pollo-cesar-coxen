import CierresAdminView from "./CierresAdminView";
import { useState, useEffect } from "react";
import Login from "./Login";
import CajaOperadaView from "./CajaOperadaView";
import Landing from "./Landing";
import AdminPanel from "./AdminPanel";
import UsuariosView from "./UsuariosView";
import InventarioView from "./InventarioView";
import PuntoDeVentaView from "./PuntoDeVentaView";
import AperturaView from "./AperturaView";
import { verificarAperturaHoy } from "./utils/verificarApertura";
import { obtenerCajaCajero } from "./utils/obtenerCajaCajero";
import CaiFacturasView from "./CaiFacturasView";
import GastosView from "./GastosView";
import ResultadosView from "./ResultadosView";
import ResultadosCajaView from "./ResultadosCajaView";
import FacturasEmitidasView from "./FacturasEmitidasView";
import "./App.css";

function App() {
  const [user, setUser] = useState<any>(() => {
    const stored = localStorage.getItem("usuario");
    return stored ? JSON.parse(stored) : null;
  });
  const [showLanding, setShowLanding] = useState(false);
  const [view, setView] = useState<
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
    | "cierreadmin"
  >("home");
  const [aperturaPendiente, setAperturaPendiente] = useState(false);
  const [cajaApertura, setCajaApertura] = useState<string | null>(null);

  // Cuando el usuario inicia sesión, mostrar landing
  useEffect(() => {
    if (user) {
      setShowLanding(true);
    }
  }, [user]);

  // Cuando termina el landing, mostrar la vista según el rol
  const handleLandingFinish = async () => {
    setShowLanding(false);
    if (user.rol === "Admin") {
      setView("admin");
    } else if (user.rol === "cajero") {
      // Obtener caja desde cai_facturas
      const caja = await obtenerCajaCajero(user.id);
      setCajaApertura(caja);
      // Verificar apertura de caja
      const tieneApertura = await verificarAperturaHoy(user.nombre, caja || "");
      // Verificar si ya existe cierre registrado hoy y consultar diferencia/observacion
      const hoy = new Date().toISOString().slice(0, 10);
      const { data: cierresHoy } = await import("./supabaseClient").then(
        ({ supabase }) =>
          supabase
            .from("cierres")
            .select("diferencia, observacion")
            .eq("cajero", user.nombre)
            .eq("caja", caja)
            .eq("tipo_registro", "cierre")
            .gte("fecha", hoy + "T00:00:00")
            .lte("fecha", hoy + "T23:59:59")
      );
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
      } else if (tieneApertura) {
        setView("puntoDeVenta");
      } else {
        setAperturaPendiente(true);
        setView("apertura");
      }
    } else {
      setView("home");
    }
  };

  // Guardar usuario en localStorage al iniciar sesión
  const handleLogin = (usuario: any) => {
    setUser(usuario);
    localStorage.setItem("usuario", JSON.stringify(usuario));
  };

  // Limpiar usuario al cerrar sesión
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("usuario");
    setView("home");
  };

  // Render condicional después de los hooks
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (showLanding) {
      return <Landing onFinish={handleLandingFinish} />;
    }

  if (view === "resultadosCaja") {
    return (
      <>
        <ResultadosCajaView />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "cajaOperada") {
    return <CajaOperadaView onCerrarSesion={handleLogout} />;
  }

  if (view === "admin") {
    return (
      <>
        <AdminPanel onSelect={setView} user={user} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "usuarios") {
    return (
      <>
        <UsuariosView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "inventario") {
    return (
      <>
        <InventarioView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "cai") {
    return (
      <>
        <CaiFacturasView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "gastos") {
    return (
      <>
        <GastosView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "resultados") {
    return (
      <>
        <ResultadosView
          onBack={() => setView("admin")}
          onVerFacturasEmitidas={() => setView("facturasEmitidas")}
        />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "facturasEmitidas") {
    return (
      <>
        <FacturasEmitidasView onBack={() => setView("resultados")} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "apertura" && aperturaPendiente && user) {
    return (
      <>
        <AperturaView usuarioActual={user} caja={cajaApertura} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "puntoDeVenta") {
    return (
      <>
        <PuntoDeVentaView setView={setView} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </>
    );
  }

  if (view === "cierreadmin") {
    return <CierresAdminView onVolver={() => setView("admin")} />;
  }

  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      {/* Elementos de bienvenida, código y cerrar sesión ocultos globalmente */}
    </div>
  );
}

export default App;
