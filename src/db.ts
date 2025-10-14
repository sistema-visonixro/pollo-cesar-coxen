// db.ts: Módulo para IndexedDB y sincronización con Supabase

import { createClient } from '@supabase/supabase-js';

const DB_NAME = 'pdv_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'facturas';

export function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFacturaOffline(factura: any) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(factura);
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFacturasOffline() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise<any[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Sincronización con Supabase
const supabase = createClient(
  'https://zyziaizfmfvtibhpqwda.supabase.co',
  'public-anon-key'
);

export async function syncFacturasToSupabase() {
  const facturas = await getFacturasOffline();
  for (const factura of facturas) {
    // Aquí podrías agregar lógica para evitar duplicados
    await supabase.from('facturas').upsert(factura);
  }
}

// Ejemplo de uso:
// saveFacturaOffline({ id: 1, ... })
// getFacturasOffline().then(console.log)
// syncFacturasToSupabase()
