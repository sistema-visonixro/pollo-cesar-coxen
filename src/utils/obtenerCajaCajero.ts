import { supabase } from '../supabaseClient';

export async function obtenerCajaCajero(cajero: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('cai_facturas')
    .select('caja_asignada')
    .eq('cajero_id', cajero)
    .single();
  if (error || !data) return null;
  return data.caja_asignada || null;
}
