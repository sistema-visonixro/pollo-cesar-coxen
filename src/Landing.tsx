import React, { useEffect } from 'react';

interface LandingProps {
  onFinish: () => void;
  user: any;
}

export default function Landing({ onFinish, user }: LandingProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 700);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `url('https://i.imgur.com/4M9UCRM.jpeg') no-repeat center center fixed`,
      backgroundSize: 'cover',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.7)',
        borderRadius: 16,
        padding: 40,
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#1976d2' }}>¡Bienvenido, {user.nombre}!</h1>
        <p>Accediendo al sistema...</p>
      </div>
    </div>
  );
}
