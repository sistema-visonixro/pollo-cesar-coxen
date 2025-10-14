
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function FacturasEmitidasView({ onBack }: FacturasEmitidasViewProps) {
	const [facturas, setFacturas] = useState<Factura[]>([]);
	const [desde, setDesde] = useState('');
	const [hasta, setHasta] = useState('');
	const [loading, setLoading] = useState(false);
	const [modalFactura, setModalFactura] = useState<Factura | null>(null);

	useEffect(() => {
		fetchFacturas();
		// eslint-disable-next-line
	}, []);

	async function fetchFacturas() {
		setLoading(true);
		let query = supabase.from('facturas').select('*');
		if (desde && hasta) {
			query = query.gte('fecha_hora', desde).lte('fecha_hora', hasta + ' 23:59:59');
		}
		const { data, error } = await query.order('fecha_hora', { ascending: false });
		if (!error && data) {
			setFacturas(data as Factura[]);
		}
		setLoading(false);
	}

	function handleFiltrar() {
		fetchFacturas();
	}

	return (
		<div style={{ padding: 32, background: 'linear-gradient(135deg, #e3f0ff 0%, #f8faff 100%)', minHeight: '100vh' }}>
			<div style={{ maxWidth: 1200, margin: '0 auto', background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px #0002', padding: 32 }}>
				<h2 style={{ color: '#1976d2', fontWeight: 800, fontSize: 32, marginBottom: 16, letterSpacing: 1 }}>Facturas Emitidas</h2>
				<div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', justifyContent: 'space-between' }}>
					<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
						<label style={{ fontWeight: 600, color: '#1976d2' }}>Desde:
							<input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #b0c4de', fontSize: 15 }} />
						</label>
						<label style={{ fontWeight: 600, color: '#1976d2' }}>Hasta:
							<input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #b0c4de', fontSize: 15 }} />
						</label>
						<button onClick={handleFiltrar} style={{ background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '8px 24px', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 8px #1976d233' }}>Filtrar</button>
					</div>
					<div style={{ fontWeight: 600, color: '#1976d2', fontSize: 18 }}>
						Total facturas: {facturas.length}
					</div>
				</div>
				<div style={{ overflowX: 'auto', marginTop: 8 }}>
					{loading ? (
						<div style={{ textAlign: 'center', padding: 32 }}>
							<div className="loader" style={{ margin: '0 auto', width: 48, height: 48, border: '6px solid #1976d2', borderTop: '6px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
							<p style={{ color: '#1976d2', fontWeight: 600, marginTop: 16 }}>Cargando...</p>
						</div>
					) : (
						<table style={{ width: '100%', borderCollapse: 'collapse', background: '#f8faff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0001' }}>
							<thead>
								<tr style={{ background: '#1976d2', color: '#fff', fontSize: 16 }}>
									<th style={{ padding: 12, fontWeight: 700 }}>ID</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Fecha/Hora</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Factura</th>
									<th style={{ padding: 12, fontWeight: 700 }}>CAI</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Cajero</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Caja</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Sub Total</th>
									<th style={{ padding: 12, fontWeight: 700 }}>ISV 15%</th>
									<th style={{ padding: 12, fontWeight: 700 }}>ISV 18%</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Total</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Productos</th>
									<th style={{ padding: 12, fontWeight: 700 }}>Cliente</th>
								</tr>
							</thead>
							<tbody>
								{facturas.map(f => (
									<tr
										key={f.id}
										style={{ borderBottom: '1px solid #e3f0ff', fontSize: 15, cursor: 'pointer', transition: 'background 0.2s' }}
										onClick={() => setModalFactura(f)}
										onMouseEnter={e => (e.currentTarget.style.background = '#e3f0ff')}
										onMouseLeave={e => (e.currentTarget.style.background = '')}
									>
										<td style={{ padding: 10 }}>{f.id}</td>
										<td style={{ padding: 10 }}>{f.fecha_hora?.replace('T', ' ').slice(0, 19)}</td>
										<td style={{ padding: 10 }}>{f.factura}</td>
										<td style={{ padding: 10 }}>{f.cai}</td>
										<td style={{ padding: 10 }}>{f.cajero}</td>
										<td style={{ padding: 10 }}>{f.caja || ''}</td>
										<td style={{ padding: 10 }}>{parseFloat(f.sub_total).toFixed(2)}</td>
										<td style={{ padding: 10 }}>{parseFloat(f.isv_15).toFixed(2)}</td>
										<td style={{ padding: 10 }}>{parseFloat(f.isv_18).toFixed(2)}</td>
										<td style={{ padding: 10, fontWeight: 700, color: '#1976d2' }}>{parseFloat(f.total).toFixed(2)}</td>
										<td style={{ padding: 10, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#555' }}>
											{(() => {
												try {
													const arr = JSON.parse(f.productos);
													if (Array.isArray(arr)) {
														return arr.map((p: any) => `${p.nombre} (${p.cantidad})`).join(', ');
													}
												} catch {
													return '';
												}
												return '';
											})()}
										</td>
										<td style={{ padding: 10 }}>{f.cliente}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
				{onBack && (
					<div style={{ textAlign: 'right', marginTop: 40 }}>
						<button
							onClick={onBack}
							style={{ background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '10px 32px', fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #1976d233' }}
						>Volver</button>
					</div>
				)}

				{/* Modal de detalles de factura */}
				{modalFactura && (
					<div style={{
						position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0007', zIndex: 9999,
						display: 'flex', alignItems: 'center', justifyContent: 'center',
					}}>
						<div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px #0003', padding: 32, minWidth: 340, maxWidth: 480, position: 'relative' }}>
							<h3 style={{ color: '#1976d2', fontWeight: 800, fontSize: 24, marginBottom: 18 }}>Detalle de Factura</h3>
							<table style={{ width: '100%', fontSize: 16 }}>
								<tbody>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>ID:</td><td>{modalFactura.id}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Fecha/Hora:</td><td>{modalFactura.fecha_hora?.replace('T', ' ').slice(0, 19)}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Factura:</td><td>{modalFactura.factura}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>CAI:</td><td>{modalFactura.cai}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Cajero:</td><td>{modalFactura.cajero}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Caja:</td><td>{modalFactura.caja || ''}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Cliente:</td><td>{modalFactura.cliente}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Sub Total:</td><td>{parseFloat(modalFactura.sub_total).toFixed(2)}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>ISV 15%:</td><td>{parseFloat(modalFactura.isv_15).toFixed(2)}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>ISV 18%:</td><td>{parseFloat(modalFactura.isv_18).toFixed(2)}</td></tr>
									<tr><td style={{ fontWeight: 600, color: '#1976d2' }}>Total:</td><td style={{ fontWeight: 700, color: '#1976d2' }}>{parseFloat(modalFactura.total).toFixed(2)}</td></tr>
									<tr>
										<td style={{ fontWeight: 600, color: '#1976d2' }}>Productos:</td>
										<td>
											{(() => {
												try {
													const arr = JSON.parse(modalFactura.productos);
													if (Array.isArray(arr)) {
														return (
															<ul style={{ margin: 0, paddingLeft: 18 }}>
																{arr.map((p: any, idx: number) => (
																	<li key={idx}>{p.nombre} - Cantidad: {p.cantidad} - Precio: L {p.precio}</li>
																))}
															</ul>
														);
													}
												} catch {
													return '';
												}
												return '';
											})()}
										</td>
									</tr>
								</tbody>
							</table>
							<button
								onClick={() => setModalFactura(null)}
								style={{ position: 'absolute', top: 18, right: 18, background: '#1976d2', color: '#fff', borderRadius: 8, border: 'none', padding: '6px 18px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
							>Cerrar</button>
						</div>
					</div>
				)}
			</div>
			<style>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
}
