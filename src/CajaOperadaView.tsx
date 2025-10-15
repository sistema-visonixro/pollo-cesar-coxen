import React from "react";

export default function CajaOperadaView({
  onCerrarSesion,
}: {
  onCerrarSesion: () => void;
}) {
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
      <div
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
            color: "#d32f2f",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 1,
          }}
        >
          Caja ya fue operada
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: 18,
            color: "#333",
            marginBottom: 18,
          }}
        >
          Disponible nuevamente el próximo día
        </p>
        <button
          onClick={onCerrarSesion}
          style={{
            padding: "14px",
            borderRadius: 8,
            background: "#1976d2",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 18,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px #1976d222",
            marginTop: 8,
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
