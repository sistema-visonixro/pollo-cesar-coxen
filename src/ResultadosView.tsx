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
  const [mesFiltro, setMesFiltro] = useState('');
  // Obtener usuario actual de localStorage
  const usuarioActual = (() => {
    try {
      const stored = localStorage.getItem('usuario');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    fetchDatos();
  }, [desde, hasta]);

  // Si el usuario no es admin, mostrar mensaje y bloquear acceso
  if (!usuarioActual || (usuarioActual.rol !== 'admin' && usuarioActual.rol !== 'Admin')) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff', fontSize: 24, fontWeight: 700 }}>
        Acceso restringido: solo administradores pueden ver el dashboard financiero.
      </div>
    );
  }

  async function fetchDatos() {
    try {
      let factQuery = supabase.from('facturas').select('*').order('fecha_hora', { ascending: false });
      let gastQuery = supabase.from('gastos').select('*').order('fecha', { ascending: false });
      
      if (desde && hasta) {
        factQuery = supabase.from('facturas').select('*').gte('fecha_hora', desde).lte('fecha_hora', hasta).order('fecha_hora', { ascending: false });
        gastQuery = supabase.from('gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false });
      }
      
      const [{ data: factData }, { data: gastData }] = await Promise.all([factQuery, gastQuery]);
      setFacturas(factData || []);
      setGastos(gastData || []);
      calcularMensual(factData || [], gastData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  function calcularMensual(facturas: any[], gastos: any[]) {
    const ventasPorMes: { [mes: string]: number } = {};
    facturas.forEach(f => {
      const mes = f.fecha_hora?.slice(0, 7);
      ventasPorMes[mes] = (ventasPorMes[mes] || 0) + parseFloat(f.total || 0);
    });
    
    const gastosPorMes: { [mes: string]: number } = {};
    gastos.forEach(g => {
      const mes = g.fecha?.slice(0, 7);
      gastosPorMes[mes] = (gastosPorMes[mes] || 0) + parseFloat(g.monto || 0);
    });
    
    const meses = Array.from(new Set([...Object.keys(ventasPorMes), ...Object.keys(gastosPorMes)])).sort();
    const resumen = meses.map(mes => ({
      mes,
      ventas: ventasPorMes[mes] || 0,
      gastos: gastosPorMes[mes] || 0,
      balance: (ventasPorMes[mes] || 0) - (gastosPorMes[mes] || 0),
    }));
    
    setVentasMensuales(resumen);
    const totalVentas = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
    setBalance(totalVentas - totalGastos);
  }

  const mesesDisponibles = ventasMensuales.map(r => r.mes);
  const facturasFiltradas = mesFiltro ? facturas.filter(f => f.fecha_hora?.slice(0, 7) === mesFiltro) : facturas;
  const gastosFiltrados = mesFiltro ? gastos.filter(g => g.fecha?.slice(0, 7) === mesFiltro) : gastos;

  const totalVentas = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
  const facturasCount = facturas.length;
  const gastosCount = gastos.length;

  return (
    <div className="resultados-enterprise" style={{ width: '100vw', height: '100vh', minHeight: '100vh', minWidth: '100vw', margin: 0, padding: 0, boxSizing: 'border-box', overflow: 'auto' }}>
      <style>{`
        body, #root {
          width: 100vw !important;
          height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: block !important;
          max-width: none !important;
          background: unset !important;
        }
        .resultados-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden;
        }
        :root {
          --primary: #1a1a2e;
          --secondary: #16213e;
          --accent: #0f3460;
          --text-primary: #ffffff;
          --text-secondary: #b0b3c1;
          --border: #2d3748;
          --shadow: 0 10px 30px rgba(0,0,0,0.3);
          --shadow-hover: 0 20px 40px rgba(0,0,0,0.4);
          --success: #2e7d32;
          --danger: #c62828;
          --warning: #f57c00;
          --info: #1e88e5;
        }

        .resultados-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 0;
        }

        .header {
          background: rgba(26, 26, 46, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: rgba(255,255,255,0.1);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .filters {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255,255,255,0.1);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .filter-group label {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.95rem;
        }

        .filter-input, .filter-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .btn-filter {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .kpi-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .kpi-value {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .kpi-success .kpi-value { color: var(--success); }
        .kpi-danger .kpi-value { color: var(--danger); }
        .kpi-info .kpi-value { color: var(--info); }

        .kpi-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .table-title {
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .btn-secondary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
        }

        .table th, .table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .table th {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
          font-weight: 600;
        }

        .charts-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 2rem;
          box-shadow: var(--shadow);
        }

        .charts-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 2rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .filters { flex-direction: column; gap: 1rem; }
          .filter-group { justify-content: center; }
          .main-content { padding: 1rem; }
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          {onBack && (
            <button className="btn-back" onClick={onBack}>
              ← Volver
            </button>
          )}
          <h1 className="page-title">📊 Dashboard Financiero</h1>
        </div>
      </header>

      <main className="main-content">
        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>📅 Desde:</label>
            <input 
              type="date" 
              value={desde} 
              onChange={e => setDesde(e.target.value)} 
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>hasta:</label>
            <input 
              type="date" 
              value={hasta} 
              onChange={e => setHasta(e.target.value)} 
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>📊 Mes:</label>
            <select 
              value={mesFiltro} 
              onChange={e => setMesFiltro(e.target.value)} 
              className="filter-select"
            >
              <option value="">Todos</option>
              {mesesDisponibles.map(mes => (
                <option key={mes} value={mes}>{mes}</option>
              ))}
            </select>
          </div>
          <button className="btn-filter" onClick={fetchDatos}>
            🔍 Filtrar
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-success">
            <div className="kpi-value">L {totalVentas.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
            <div className="kpi-label">Total Ventas</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">L {totalGastos.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
            <div className="kpi-label">Total Gastos</div>
          </div>
          <div className="kpi-card kpi-info">
            <div className="kpi-value">L {balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
            <div className="kpi-label">{balance >= 0 ? '✅ Ganancia' : '❌ Pérdida'}</div>
          </div>
          <div className="kpi-card kpi-success">
            <div className="kpi-value">{facturasCount}</div>
            <div className="kpi-label">Facturas</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">{gastosCount}</div>
            <div className="kpi-label">Gastos</div>
          </div>
        </div>

        {/* Tablas */}
        <div className="content-grid">
          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">📋 Facturas Recientes</h3>
                {onVerFacturasEmitidas && (
                  <button className="btn-secondary" onClick={onVerFacturasEmitidas}>
                    Ver todas
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cajero</th>
                      <th>Factura</th>
                      <th>Cliente</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.slice(0, 10).map(f => (
                      <tr key={f.id}>
                        <td>{f.fecha_hora?.slice(0, 10)}</td>
                        <td>{f.cajero}</td>
                        <td>{f.factura}</td>
                        <td>{f.cliente}</td>
                        <td style={{ color: 'var(--success)' }}>L {parseFloat(f.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">💸 Gastos</h3>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastosFiltrados.slice(0, 10).map(g => (
                      <tr key={g.id}>
                        <td>{g.fecha}</td>
                        <td style={{ color: 'var(--danger)' }}>L {parseFloat(g.monto || 0).toFixed(2)}</td>
                        <td>{g.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <div className="charts-container">
          <h3 className="charts-title">📈 Análisis Mensual</h3>
          <div className="charts-grid">
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={ventasMensuales} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={'var(--border)'} />
                  <XAxis dataKey="mes" stroke={'var(--text-secondary)'} />
                  <YAxis stroke={'var(--text-secondary)'} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(26,26,46,0.95)', 
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="ventas" fill="url(#ventas)" name="Ventas" />
                  <Bar dataKey="gastos" fill="url(#gastos)" name="Gastos" />
                  <defs>
                    <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={'var(--success)'} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={'var(--success)'} stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="gastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={'var(--danger)'} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={'var(--danger)'} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={ventasMensuales} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={'var(--border)'} />
                  <XAxis dataKey="mes" stroke={'var(--text-secondary)'} />
                  <YAxis stroke={'var(--text-secondary)'} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(26,26,46,0.95)', 
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="balance" 
                    stroke={balance >= 0 ? 'var(--success)' : 'var(--danger)'}
                    strokeWidth={3} 
                    name="Balance Mensual"
                    dot={{ fill: balance >= 0 ? 'var(--success)' : 'var(--danger)', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}