import { useEffect, useState } from 'react';

interface CaiFactura {
  id: string;
  cai: string;
  rango_desde: number;
  rango_hasta: number;
  caja_asignada: string;
  cajero_id: string;
  creado_en?: string;
}

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
}

const API_URL = 'https://zyziaizfmfvtibhpqwda.supabase.co/rest/v1/cai_facturas';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY';
const USUARIOS_URL = 'https://zyziaizfmfvtibhpqwda.supabase.co/rest/v1/usuarios?rol=eq.cajero';

interface CaiFacturasViewProps {
  onBack?: () => void;
}

export default function CaiFacturasView({ onBack }: CaiFacturasViewProps) {
  const [facturas, setFacturas] = useState<CaiFactura[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<CaiFactura>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch(API_URL + '?select=*', {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setFacturas(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar facturas');
        setLoading(false);
      });
    fetch(USUARIOS_URL, {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then(res => res.json())
      .then(data => setUsuarios(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const body = {
      ...form,
      rango_desde: Number(form.rango_desde),
      rango_hasta: Number(form.rango_hasta),
    };
    let res;
    if (editId) {
      res = await fetch(`${API_URL}?id=eq.${editId}`, {
        method: 'PATCH',
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });
    }
    await res.json();
    setShowModal(false);
    setLoading(false);
    fetch(API_URL + '?select=*', {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then(res => res.json())
      .then(data => setFacturas(data));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar registro?')) return;
    setLoading(true);
    await fetch(`${API_URL}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    });
    fetch(API_URL + '?select=*', {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
    })
      .then(res => res.json())
      .then(data => setFacturas(data));
    setLoading(false);
  };

  const handleEdit = (factura: CaiFactura) => {
    setEditId(factura.id);
    setForm(factura);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditId(null);
    setForm({});
    setShowModal(true);
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: 32 }}>
      <h2 style={{ color: '#1976d2', marginBottom: 24 }}>CAI y Facturas</h2>
      <button onClick={handleNew} style={{ marginBottom: 16 }}>Nuevo CAI</button>
      {onBack && (
        <button onClick={onBack} style={{ marginBottom: 16, marginLeft: 12, background: '#eee', color: '#1976d2', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 15, border: '1px solid #1976d2' }}>
          Volver
        </button>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#e3f2fd' }}>
              <th>CAI</th>
              <th>Rango Desde</th>
              <th>Rango Hasta</th>
              <th>Caja Asignada</th>
              <th>Cajero</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{f.cai}</td>
                <td>{f.rango_desde}</td>
                <td>{f.rango_hasta}</td>
                <td>{f.caja_asignada}</td>
                <td>{usuarios.find(u => u.id === f.cajero_id)?.nombre || 'Sin asignar'}</td>
                <td>
                  <button onClick={() => handleEdit(f)} style={{ marginRight: 8 }}>Editar</button>
                  <button onClick={() => handleDelete(f.id)} style={{ color: 'red' }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(25, 118, 210, 0.18)',
            padding: 32,
            minWidth: 350,
            maxWidth: 420,
            width: '100%',
            position: 'relative',
          }}>
            <button
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: 12, right: 16, fontSize: 22, background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer' }}
            >×</button>
            <h3 style={{ color: '#1976d2', marginBottom: 18 }}>{editId ? 'Editar CAI' : 'Nuevo CAI'}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                type="text"
                placeholder="CAI"
                value={form.cai || ''}
                onChange={e => setForm(f => ({ ...f, cai: e.target.value }))}
                required
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
              />
              <input
                type="number"
                placeholder="Rango desde"
                value={form.rango_desde || ''}
                onChange={e => setForm(f => ({ ...f, rango_desde: Number(e.target.value) }))}
                required
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
              />
              <input
                type="number"
                placeholder="Rango hasta"
                value={form.rango_hasta || ''}
                onChange={e => setForm(f => ({ ...f, rango_hasta: Number(e.target.value) }))}
                required
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
              />
              <input
                type="text"
                placeholder="Caja asignada"
                value={form.caja_asignada || ''}
                onChange={e => setForm(f => ({ ...f, caja_asignada: e.target.value }))}
                required
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
              />
              <select
                value={form.cajero_id || ''}
                onChange={e => setForm(f => ({ ...f, cajero_id: e.target.value }))}
                required
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 16 }}
              >
                <option value="">Selecciona cajero</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
              <button type="submit" style={{ background: '#1976d2', color: '#fff', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 16 }}>
                {editId ? 'Guardar cambios' : 'Agregar CAI'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
