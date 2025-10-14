import type { FC } from 'react';

type ViewType = 'home' | 'puntoDeVenta' | 'admin' | 'usuarios' | 'inventario' | 'cai' | 'resultados' | 'gastos';

const cards: { label: string; icon: string; view: ViewType }[] = [
  { label: 'Usuarios', icon: '👤', view: 'usuarios' },
  { label: 'Inventario', icon: '📦', view: 'inventario' },
  { label: 'Cai y facturas', icon: '🧾', view: 'cai' },
 
  { label: 'Resultados de venta', icon: '📈', view: 'resultados' },
  { label: 'Gastos', icon: '💸', view: 'gastos' },
];

interface AdminPanelProps {
  onSelect: (view: ViewType) => void;
  user: any;
}

const AdminPanel: FC<AdminPanelProps> = ({ onSelect, user }) => (
  <div style={{ textAlign: 'center', marginTop: 40 }}>
    <h1 style={{ color: '#1976d2', fontWeight: 700, letterSpacing: 1 }}>Panel de Administrador</h1>
    <p style={{ fontSize: 18, color: '#333', marginBottom: 32 }}>Bienvenido, <b>{user.nombre}</b> (Admin)</p>
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 32,
      marginTop: 32,
    }}>
      {cards.map(card => (
        <div
          key={card.label}
          onClick={() => onSelect(card.view)}
          style={{
            cursor: 'pointer',
            width: 200,
            height: 200,
            background: 'linear-gradient(135deg, #e3f2fd 0%, #fff 100%)',
            borderRadius: 24,
            boxShadow: '0 8px 32px rgba(25, 118, 210, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 600,
            border: '2px solid #1976d2',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.07)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(25, 118, 210, 0.22)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(25, 118, 210, 0.12)';
          }}
        >
          <span style={{
            fontSize: 64,
            marginBottom: 18,
            color: '#1976d2',
            textShadow: '0 2px 8px rgba(25, 118, 210, 0.18)',
            background: 'linear-gradient(135deg, #1976d2 40%, #64b5f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 6px #1976d2aa)',
          }}>{card.icon}</span>
          <span style={{
            fontSize: 22,
            color: '#1976d2',
            fontWeight: 700,
            letterSpacing: 1,
            textShadow: '0 1px 4px #1976d222',
          }}>{card.label}</span>
        </div>
      ))}
    </div>
  </div>
);

export default AdminPanel;
