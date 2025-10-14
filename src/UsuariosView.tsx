import { useEffect, useState } from 'react';

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
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<Usuario>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const API_URL = 'https://zyziaizfmfvtibhpqwda.supabase.co/rest/v1/usuarios';
  const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY';

  // Obtener usuarios
  useEffect(() => {
    fetch(API_URL + '?select=*', {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setUsuarios(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar usuarios');
        setLoading(false);
      });
  }, []);

  // Crear o editar usuario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editId) {
        // Editar
        await fetch(`${API_URL}?id=eq.${editId}`, {
          method: 'PATCH',
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(form),
        });
      } else {
        // Crear
        await fetch(API_URL, {
          method: 'POST',
          headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(form),
        });
      }
      window.location.reload();
    } catch {
      setError('Error al guardar usuario');
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar usuario?')) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
        },
      });
      window.location.reload();
    } catch {
      setError('Error al eliminar usuario');
      setLoading(false);
    }
  };

  // Preparar edición
  const handleEdit = (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm(usuario);
  };

  // Preparar nuevo
  const handleNew = () => {
    setEditId(null);
    setForm({});
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', background: 'rgba(255,255,255,0.95)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: '#fff',
            color: '#1976d2',
            border: '2px solid #1976d2',
            borderRadius: 8,
            padding: '8px 20px',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            marginRight: 16,
            boxShadow: '0 2px 8px #1976d222',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#1976d2';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.color = '#1976d2';
          }}
        >
          ← Volver
        </button>
        <h2 style={{ color: '#1976d2', marginBottom: 0 }}>Usuarios</h2>
      </div>
      <button onClick={handleNew} style={{ marginLeft: 8, marginBottom: 16 }}>Nuevo usuario</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#e3f2fd' }}>
              <th>Nombre</th>
              <th>Código</th>
              <th>Rol</th>
              <th>IP</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{u.nombre}</td>
                <td>{u.codigo}</td>
                <td>{u.rol}</td>
                <td>{u.ip || '-'}</td>
                <td>
                  <button onClick={() => handleEdit(u)} style={{ marginRight: 8 }}>Editar</button>
                  <button onClick={() => handleDelete(u.id)} style={{ color: 'red' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <input
          type="text"
          placeholder="Nombre"
          value={form.nombre || ''}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          required
          style={{ flex: 1, minWidth: 120 }}
        />
        <input
          type="text"
          placeholder="Código"
          value={form.codigo || ''}
          onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
          required
          style={{ flex: 1, minWidth: 120 }}
        />
        <input
          type="password"
          placeholder="Clave"
          value={form.clave || ''}
          onChange={e => setForm(f => ({ ...f, clave: e.target.value }))}
          required
          style={{ flex: 1, minWidth: 120 }}
        />
        <select
          value={form.rol || 'cajero'}
          onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
          style={{ flex: 1, minWidth: 120 }}
        >
          <option value="cajero">Cajero</option>
          <option value="sub-Admin">sub-Admin</option>
        </select>
        <input
          type="text"
          placeholder="IP"
          value={form.ip || ''}
          onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
          style={{ flex: 1, minWidth: 120 }}
        />
        <button type="submit" style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: '8px 24px', fontWeight: 600 }}>
          {editId ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </form>
    </div>
  );
}
