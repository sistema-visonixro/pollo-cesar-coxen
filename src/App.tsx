import React, { useState, useEffect } from "react";
import CierresAdminView from "./CierresAdminView";
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
import EtiquetasView from "./EtiquetasView";
import ReciboView from "./ReciboView";
import "./App.css";
import { supabase } from "./supabaseClient";

// Asumimos que supabase está disponible globalmente o importado; si no, agrégalo como import
// import { supabase } from './supabase'; // Descomenta y ajusta si es necesario

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
    | "etiquetas"
    | "recibo"
    | "cajaOperada"
    | "cierreadmin"
  >("home");
  const [aperturaPendiente, setAperturaPendiente] = useState(false);
  const [cajaApertura, setCajaApertura] = useState<string | null>(null);

  // Verificar id de usuario en localStorage al cargar la app
  useEffect(() => {
    // Solo ejecutar si no estamos ya en /login
    if (window.location.pathname === "/login") return;
    try {
      const stored = localStorage.getItem("usuario");
      const usuario = stored ? JSON.parse(stored) : null;
      if (!usuario || !usuario.id) {
        localStorage.removeItem("usuario");
        localStorage.removeItem("rol");
        localStorage.removeItem("caja");
        localStorage.removeItem("id");
        window.location.href = "/login";
      }
    } catch {
      localStorage.removeItem("usuario");
      localStorage.removeItem("rol");
      localStorage.removeItem("caja");
      localStorage.removeItem("id");
      window.location.href = "/login";
    }
  }, []);

  // Cuando el usuario inicia sesión, mostrar landing
  useEffect(() => {
    if (user) {
      setShowLanding(true);
    }
  }, [user]);

  // Cuando termina el landing, mostrar la vista según el rol y lógica de caja
  const handleLandingFinish = async () => {
    setShowLanding(false);

    if (!user) return;

    // Obtener caja del cajero
    const caja = await obtenerCajaCajero(user.id);
    setCajaApertura(caja);

    // Verificar apertura hoy solo si caja no es null
    let tieneApertura = false;
    if (caja) {
      tieneApertura = await verificarAperturaHoy(user.id, caja);
    }
    
  if (user.rol === "cajero") {
      // Lógica para cajeros: verificar cierres de hoy
      const hoy = new Date().toISOString().slice(0, 10);
      const { data: cierresHoy, error } = await supabase
        .from("cierres")
        .select("diferencia, observacion")
        .eq("cajero", user.nombre)
        .eq("caja", caja)
        .eq("tipo_registro", "cierre")
        .gte("fecha", `${hoy}T00:00:00`)
        .lte("fecha", `${hoy}T23:59:59`);

      if (error) {
        console.error("Error al verificar cierres:", error);
        setView("home");
        return;
      }

      if (cierresHoy && cierresHoy.length > 0) {
        const cierre = cierresHoy[0];
        if (cierre.diferencia !== 0 && cierre.observacion === "sin aclarar") {
          setView("resultadosCaja");
        } else if (cierre.diferencia !== 0 && cierre.observacion === "aclarado") {
          setView("cajaOperada");
        } else if (cierre.diferencia === 0 && cierre.observacion === "cuadrado") {
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
    } else if (user.rol === "Admin") {
      setView("admin");
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
    window.location.href = "/login"; // Opcional: redirigir explícitamente
  };

  // Render condicional
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (showLanding) {
    return <Landing onFinish={handleLandingFinish} />;
  }

  // Vistas comunes
  if (view === "resultadosCaja") {
    return (
      <>
        <ResultadosCajaView />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
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
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "etiquetas" && user?.rol === "Admin") {
    return <EtiquetasView onBack={() => setView("admin")} />;
  }

  if (view === "recibo" && user?.rol === "Admin") {
    return <ReciboView onBack={() => setView("admin")} />;
  }

  if (view === "usuarios" && user?.rol === "Admin") {
    return (
      <>
        <UsuariosView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "inventario" && user?.rol === "Admin") {
    return (
      <>
        <InventarioView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "cai" && user?.rol === "Admin") {
    return (
      <>
        <CaiFacturasView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "gastos" && user?.rol === "Admin") {
    return (
      <>
        <GastosView onBack={() => setView("admin")} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "resultados" && user?.rol === "Admin") {
    return (
      <>
        <ResultadosView
          onBack={() => setView("admin")}
          onVerFacturasEmitidas={() => setView("facturasEmitidas")}
        />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "facturasEmitidas" && user?.rol === "Admin") {
    return (
      <>
        <FacturasEmitidasView onBack={() => setView("resultados")} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "apertura" && aperturaPendiente && user?.rol === "cajero") {
    return (
      <>
        <AperturaView usuarioActual={user} caja={cajaApertura} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "puntoDeVenta" && user?.rol === "cajero") {
    return (
      <>
        <PuntoDeVentaView setView={setView} />
        <div style={{ textAlign: "center", marginTop: 20 }}></div>
      </>
    );
  }

  if (view === "cierreadmin" && user?.rol === "Admin") {
    return <CierresAdminView onVolver={() => setView("admin")} />;
  }

  // Vista por defecto (home) - puedes agregar un componente Home si existe
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      
      <p style={{ fontSize: 22, fontWeight: 700, color: "#1976d2", marginBottom: 18 }}>
        Bienvenido, {user?.nombre}. 
      </p>
      
    </div>
  );
}

export default App;