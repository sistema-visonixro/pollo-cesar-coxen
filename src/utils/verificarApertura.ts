import { supabase } from '../supabaseClient';

export async function verificarAperturaHoy(cajero_id: string, caja: string): Promise<boolean> {
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().slice(0, 10);
  const { data: aperturas } = await supabase
    .from('cierres')
    .select('*')
    .eq('tipo_registro', 'apertura')
    .eq('cajero_id', cajero_id)
    .eq('caja', caja)
    .gte('fecha', fechaHoy + 'T00:00:00')
    .lte('fecha', fechaHoy + 'T23:59:59');
  return !!(aperturas && aperturas.length > 0);
}
