import { useEffect, useState } from 'react';

interface GastosViewProps {
  onBack?: () => void;
}

interface Gasto {
  id: number;
  fecha: string;
  monto: string;
  motivo: string;
}
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zyziaizfmfvtibhpqwda.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY'
);

export default function GastosView({ onBack }: GastosViewProps) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [montoTotal, setMontoTotal] = useState(0);
  const [nuevoGasto, setNuevoGasto] = useState({ fecha: '', monto: '', motivo: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [editGasto, setEditGasto] = useState({ fecha: '', monto: '', motivo: '' });

  useEffect(() => {
    fetchGastos();
  }, []);

  async function fetchGastos() {
    let query = supabase.from('gastos').select('*').order('fecha', { ascending: false });
    if (fechaDesde && fechaHasta) {
      query = supabase.from('gastos').select('*').gte('fecha', fechaDesde).lte('fecha', fechaHasta).order('fecha', { ascending: false });
    }
    const { data } = await query;
    setGastos(data || []);
    calcularTotal(data || []);
  }

  function calcularTotal(data: Gasto[]) {
    const total = data.reduce((sum, g) => sum + parseFloat(g.monto), 0);
    setMontoTotal(total);
  }

  async function agregarGasto() {
    if (!nuevoGasto.fecha || !nuevoGasto.monto || !nuevoGasto.motivo) return;
    await supabase.from('gastos').insert([
      { fecha: nuevoGasto.fecha, monto: nuevoGasto.monto, motivo: nuevoGasto.motivo }
    ]);
    setNuevoGasto({ fecha: '', monto: '', motivo: '' });
    fetchGastos();
  }

  async function eliminarGasto(id: number) {
    await supabase.from('gastos').delete().eq('id', id);
    fetchGastos();
  }

  async function guardarEdicion() {
    if (!editGasto.fecha || !editGasto.monto || !editGasto.motivo) return;
    await supabase.from('gastos').update(editGasto).eq('id', editId);
    setEditId(null);
    setEditGasto({ fecha: '', monto: '', motivo: '' });
    fetchGastos();
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px #1976d222', padding: 32 }}>
      {onBack && (
        <button onClick={onBack} style={{ marginBottom: 18, background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
          Volver
        </button>
      )}
      <h2 style={{ color: '#1976d2', marginBottom: 24 }}>Gastos</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        <button onClick={fetchGastos} style={{ background: '#388e3c', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 18px', fontWeight: 600 }}>Filtrar</button>
      </div>
      <div style={{ marginBottom: 24, fontWeight: 700, fontSize: 20, color: '#388e3c' }}>
        Total en rango: L {montoTotal.toFixed(2)}
      </div>
        <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 18 }}>Agregar nuevo gasto</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <input type="date" value={nuevoGasto.fecha} onChange={e => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })} />
          <input type="number" placeholder="Monto" value={nuevoGasto.monto} onChange={e => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })} />
          <input type="text" placeholder="Motivo" value={nuevoGasto.motivo} onChange={e => setNuevoGasto({ ...nuevoGasto, motivo: e.target.value })} />
          <button onClick={agregarGasto} style={{ background: '#388e3c', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 18px', fontWeight: 600 }}>Agregar</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: 8, border: '1px solid #eee' }}>Fecha</th>
            <th style={{ padding: 8, border: '1px solid #eee' }}>Monto</th>
            <th style={{ padding: 8, border: '1px solid #eee' }}>Motivo</th>
            <th style={{ padding: 8, border: '1px solid #eee' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {gastos.map(g => (
            editId === g.id ? (
              <tr key={g.id}>
                <td><input type="date" value={editGasto.fecha} onChange={e => setEditGasto({ ...editGasto, fecha: e.target.value })} /></td>
                <td><input type="number" value={editGasto.monto} onChange={e => setEditGasto({ ...editGasto, monto: e.target.value })} /></td>
                <td><input type="text" value={editGasto.motivo} onChange={e => setEditGasto({ ...editGasto, motivo: e.target.value })} /></td>
                <td>
                  <button onClick={guardarEdicion} style={{ background: '#1976d2', color: '#fff', borderRadius: 6, border: 'none', padding: '4px 12px', fontWeight: 600 }}>Guardar</button>
                  <button onClick={() => setEditId(null)} style={{ background: '#d32f2f', color: '#fff', borderRadius: 6, border: 'none', padding: '4px 12px', fontWeight: 600, marginLeft: 6 }}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={g.id}>
                <td>{g.fecha}</td>
                <td>L {parseFloat(g.monto).toFixed(2)}</td>
                <td>{g.motivo}</td>
                <td>
                  <button onClick={() => { setEditId(g.id); setEditGasto({ fecha: g.fecha, monto: g.monto, motivo: g.motivo }); }} style={{ background: '#1976d2', color: '#fff', borderRadius: 6, border: 'none', padding: '4px 12px', fontWeight: 600 }}>Editar</button>
                  <button onClick={() => eliminarGasto(g.id)} style={{ background: '#d32f2f', color: '#fff', borderRadius: 6, border: 'none', padding: '4px 12px', fontWeight: 600, marginLeft: 6 }}>Eliminar</button>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
   
    </div>
  );
}
