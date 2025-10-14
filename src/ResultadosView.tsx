import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const supabase = createClient(
  'https://zyziaizfmfvtibhpqwda.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5emlhaXpmbWZ2dGliaHBxd2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNjU1MzcsImV4cCI6MjA3NTk0MTUzN30.cLiAwO8kw23reAYLXOQ4AO1xgrTDI_vhXkJCJHGWXLY'
);

interface ResultadosViewProps {
  onBack?: () => void;
  onVerFacturasEmitidas?: () => void;
}

export default function ResultadosView({ onBack, onVerFacturasEmitidas }: ResultadosViewProps) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [ventasMensuales, setVentasMensuales] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchDatos();
  }, [desde, hasta]);

  async function fetchDatos() {
    let factQuery = supabase.from('facturas').select('*').order('fecha_hora', { ascending: false });
    let gastQuery = supabase.from('gastos').select('*').order('fecha', { ascending: false });
    if (desde && hasta) {
      factQuery = supabase.from('facturas').select('*').gte('fecha_hora', desde).lte('fecha_hora', hasta).order('fecha_hora', { ascending: false });
      gastQuery = supabase.from('gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false });
    }
    const { data: factData } = await factQuery;
    const { data: gastData } = await gastQuery;
    setFacturas(factData || []);
    setGastos(gastData || []);
    calcularMensual(factData || [], gastData || []);
  }

  function calcularMensual(facturas: any[], gastos: any[]) {
    // Agrupar ventas por mes
    const ventasPorMes: { [mes: string]: number } = {};
    facturas.forEach(f => {
      const mes = f.fecha_hora?.slice(0, 7); // YYYY-MM
      ventasPorMes[mes] = (ventasPorMes[mes] || 0) + parseFloat(f.total);
    });
    // Agrupar gastos por mes
    const gastosPorMes: { [mes: string]: number } = {};
    gastos.forEach(g => {
      const mes = g.fecha?.slice(0, 7);
      gastosPorMes[mes] = (gastosPorMes[mes] || 0) + parseFloat(g.monto);
    });
    // Balance por mes
    const meses = Array.from(new Set([...Object.keys(ventasPorMes), ...Object.keys(gastosPorMes)])).sort();
    const resumen = meses.map(mes => ({
      mes,
      ventas: ventasPorMes[mes] || 0,
      gastos: gastosPorMes[mes] || 0,
      balance: (ventasPorMes[mes] || 0) - (gastosPorMes[mes] || 0),
    }));
    setVentasMensuales(resumen);
    // Balance total
    const totalVentas = facturas.reduce((sum, f) => sum + parseFloat(f.total), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0);
    setBalance(totalVentas - totalGastos);
  }

  // Filtro por mes
  const [mesFiltro, setMesFiltro] = useState('');

  // Opciones de meses disponibles
  const mesesDisponibles = ventasMensuales.map(r => r.mes);

  // Filtrar facturas y gastos por mes si se selecciona
  const facturasFiltradas = mesFiltro ? facturas.filter(f => f.fecha_hora?.slice(0, 7) === mesFiltro) : facturas;
  const gastosFiltrados = mesFiltro ? gastos.filter(g => g.fecha?.slice(0, 7) === mesFiltro) : gastos;

  // Recibe función de volver por props

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#f8fafc', overflow: 'auto', zIndex: 999, padding: 0 }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '48px 32px 32px 32px' }}>
        {onBack && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 18 }}>
            <button onClick={onBack} style={{ background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '10px 32px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>
              Volver
            </button>
          </div>
        )}
        <h2 style={{ color: '#1976d2', marginBottom: 32, fontSize: 40, fontWeight: 900, letterSpacing: 2, textAlign: 'center' }}>Dashboard de Resultados</h2>
        <div style={{ display: 'flex', gap: 24, marginBottom: 32, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #1976d222', padding: '18px 28px' }}>
            <label style={{ fontWeight: 700, color: '#1976d2', fontSize: 18 }}>Filtrar por fechas:</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }} />
            <span style={{ fontWeight: 700, color: '#1976d2', fontSize: 18 }}>hasta</span>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }} />
            <button onClick={fetchDatos} style={{ background: '#388e3c', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 18px', fontWeight: 600, fontSize: 16, marginLeft: 8 }}>Filtrar</button>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #1976d222', padding: '18px 28px' }}>
            <label style={{ fontWeight: 700, color: '#1976d2', fontSize: 18 }}>Filtrar por mes:</label>
            <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ fontSize: 16, padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }}>
              <option value="">Todos</option>
              {mesesDisponibles.map(mes => (
                <option key={mes} value={mes}>{mes}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px #388e3c22', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 260 }}>
            <div style={{ fontSize: 24, color: '#388e3c', fontWeight: 700, marginBottom: 10 }}>Total Ventas</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#388e3c' }}>L {facturas.reduce((sum, f) => sum + parseFloat(f.total), 0).toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px #d32f2f22', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 260 }}>
            <div style={{ fontSize: 24, color: '#d32f2f', fontWeight: 700, marginBottom: 10 }}>Total Gastos</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#d32f2f' }}>L {gastos.reduce((sum, g) => sum + parseFloat(g.monto), 0).toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px #1976d222', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 260 }}>
            <div style={{ fontSize: 24, color: balance >= 0 ? '#388e3c' : '#d32f2f', fontWeight: 700, marginBottom: 10 }}>Balance</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: balance >= 0 ? '#388e3c' : '#d32f2f' }}>L {balance.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 40, marginBottom: 40 }}>
          <div style={{ flex: 2, background: '#e3f2fd', borderRadius: 20, padding: 32, boxShadow: '0 2px 12px #1976d222', minHeight: 340 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ color: '#1976d2', fontSize: 26, fontWeight: 800, margin: 0 }}>Facturas</h3>
              {onVerFacturasEmitidas && (
                <button
                  onClick={onVerFacturasEmitidas}
                  style={{ background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
                >Ver facturas emitidas</button>
              )}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Fecha</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Cajero</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Factura</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Cliente</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.map(f => (
                    <tr key={f.id}>
                      <td>{f.fecha_hora?.slice(0, 10)}</td>
                      <td>{f.cajero}</td>
                      <td>{f.factura}</td>
                      <td>{f.cliente}</td>
                      <td>L {parseFloat(f.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ flex: 1, background: '#fffde7', borderRadius: 20, padding: 32, boxShadow: '0 2px 12px #fbc02d22', minHeight: 340 }}>
            <h3 style={{ color: '#fbc02d', marginBottom: 22, fontSize: 26, fontWeight: 800 }}>Gastos</h3>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Fecha</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Monto</th>
                    <th style={{ padding: 10, border: '1px solid #eee' }}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFiltrados.map(g => (
                    <tr key={g.id}>
                      <td>{g.fecha}</td>
                      <td>L {parseFloat(g.monto).toFixed(2)}</td>
                      <td>{g.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 20, padding: 40, marginBottom: 32, boxShadow: '0 2px 12px #388e3c22' }}>
          <h3 style={{ color: '#388e3c', marginBottom: 32, fontSize: 28, fontWeight: 900, textAlign: 'center' }}>Gráficas de Ventas y Gastos Mensuales</h3>
          <div style={{ width: '100%', height: 340, display: 'flex', gap: 40 }}>
            <div style={{ flex: 2 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ventasMensuales} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ventas" fill="#388e3c" name="Ventas" />
                  <Bar dataKey="gastos" fill="#d32f2f" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ventasMensuales} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="balance" stroke="#1976d2" strokeWidth={3} name="Balance" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
