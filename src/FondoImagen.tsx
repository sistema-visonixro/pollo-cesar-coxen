import React from "react";

export default function FondoImagen({
  children,
}: {
  children: React.ReactNode;
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
      {children}
    </div>
  );
}
