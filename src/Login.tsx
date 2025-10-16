import { useState } from "react";
import CajaOperadaView from "./CajaOperadaView";
import { supabase } from "./supabaseClient";

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [cajaOperada, setCajaOperada] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
          "https://zyziaizfmfvtibhpqwda.supabase.co/rest/v1/usuarios?select=*",
        {
          headers: {
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY",
          },
        }
      );
      const users = await res.json();
      const user = users.find(
        (u: any) => u.codigo === codigo && u.clave === clave
      );
      if (user) {
        // Si es cajero, verificar si ya hizo apertura y cierre hoy
        if (user.rol === "cajero") {
          const hoy = new Date().toISOString().slice(0, 10);
          const caja = user.caja || user.caja_asignada || "";
          // Consultar aperturas y cierres
          const aperturas = await supabase
            .from("cierres")
            .select("id")
            .eq("tipo_registro", "apertura")
            .eq("cajero", user.nombre)
            .eq("caja", caja)
            .gte("fecha", hoy + "T00:00:00")
            .lte("fecha", hoy + "T23:59:59");
          const cierres = await supabase
            .from("cierres")
            .select("id")
            .eq("tipo_registro", "cierre")
            .eq("cajero", user.nombre)
            .eq("caja", caja)
            .gte("fecha", hoy + "T00:00:00")
            .lte("fecha", hoy + "T23:59:59");
          if (
            aperturas.data &&
            aperturas.data.length > 0 &&
            cierres.data &&
            cierres.data.length > 0
          ) {
            setCajaOperada(true);
            setLoading(false);
            return;
          }
        }
          setShowSplash(true);
          setTimeout(() => {
            // Guardar id, usuario, rol y caja en localStorage
            localStorage.setItem("usuario", JSON.stringify({ id: user.id, usuario: user.nombre, rol: user.rol, caja: user.caja }));
            onLogin(user);
            window.location.reload();
          }, 2000);
      } else {
        setError("Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  if (cajaOperada) {
    return (
      <CajaOperadaView
        onCerrarSesion={() => {
          localStorage.removeItem("usuario");
          window.location.href = "/login";
        }}
      />
    );
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "url(https://i.imgur.com/UiSIq00.jpeg) center/cover no-repeat",
        zIndex: 9999,
      }}
    >
      {showSplash ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background:
              "url(https://i.imgur.com/UiSIq00.jpeg) center/cover no-repeat",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              borderRadius: 24,
              padding: 48,
              boxShadow: "0 4px 24px #0002",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <img
              src="https://i.imgur.com/UiSIq00.jpeg"
              alt="Logo"
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                marginBottom: 16,
                boxShadow: "0 2px 8px #1976d233",
              }}
            />
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#1976d2",
                marginBottom: 8,
              }}
            >
              Cargando...
            </div>
            <div
              style={{
                width: 60,
                height: 60,
                border: "6px solid #1976d2",
                borderTop: "6px solid #fff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              background: "rgba(255,255,255,0.92)",
              borderRadius: 20,
              boxShadow: "0 8px 32px #1976d244",
              padding: 40,
              minWidth: 320,
              maxWidth: 370,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 18,
              margin: "auto",
              alignItems: "center",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                marginBottom: 16,
                color: "#1976d2",
                fontWeight: 900,
                fontSize: 28,
                letterSpacing: 1,
              }}
            >
              Iniciar sesión
            </h2>
            <input
              type="text"
              placeholder="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
              }}
            />
            <input
              type="password"
              placeholder="Clave"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
              style={{
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "14px",
                borderRadius: 8,
                background: "#1976d2",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 18,
                border: "none",
                cursor: "pointer",
                transition: "background 0.2s",
                marginTop: 8,
                textAlign: "center",
                boxShadow: "0 2px 8px #1976d222",
              }}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
            {error && (
              <p style={{ color: "red", textAlign: "center" }}>{error}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
