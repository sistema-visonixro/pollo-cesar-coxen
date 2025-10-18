// Pequeño wrapper para QZ Tray
// Funciones: connect, disconnect, getPrinters, printHTML

type QZ = any;

let qzInstance: QZ | null = null;
let connected = false;

function getQZ(): QZ | null {
  // @ts-ignore
  return (window as any).qz || null;
}

export async function connect(): Promise<void> {
  const qz = getQZ();
  if (!qz) throw new Error("QZ Tray no está cargado");
  qzInstance = qz;
  return new Promise((resolve, reject) => {
    try {
      qz.websocket.connect().then(() => {
        connected = true;
        resolve();
      }).catch((err: any) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

export async function disconnect(): Promise<void> {
  if (!qzInstance) return;
  try {
    await qzInstance.websocket.disconnect();
  } finally {
    connected = false;
    qzInstance = null;
  }
}

export async function getPrinters(): Promise<string[]> {
  const qz = getQZ();
  if (!qz) return [];
  try {
    const printers = await qz.printers.find();
    return printers;
  } catch (err) {
    return [];
  }
}

export async function printHTML(html: string, options?: {printer?: string}) {
  const qz = getQZ();
  if (!qz) throw new Error("QZ Tray no está disponible");
  // Crear config
  const cfg = qz.configs.create(options?.printer || null);
  // QZ puede imprimir HTML pasando un objeto tipo 'html'
  const data = [{ type: 'html', format: 'plain', data: html }];
  return qz.print(cfg, data);
}

// Enviar datos raw (bytes) a la impresora. `bytes` es un Uint8Array o Array<number>
export async function printRaw(bytes: Uint8Array | number[], options?: {printer?: string}) {
  const qz = getQZ();
  if (!qz) throw new Error("QZ Tray no está disponible");
  const cfg = qz.configs.create(options?.printer || null);
  // QZ acepta datos raw como base64
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const base64 = btoa(binary);
  const data = [{ type: 'raw', format: 'base64', data: base64 }];
  return qz.print(cfg, data);
}

// Enviar datos raw a partir de una cadena hex (ej: '1B700019FA')
export async function printRawHex(hex: string, options?: {printer?: string}) {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substr(i, 2), 16));
  }
  return printRaw(new Uint8Array(bytes), options);
}

// Comando ESC/POS para abrir gaveta. Este es un comando común: ESC p 0 25 250 -> 1B 70 00 19 FA
export async function openCashDrawer(options?: {printer?: string}) {
  // Comando: 0x1B 0x70 0x00 0x19 0xFA
  return printRawHex('1B700019FA', options);
}

export function isAvailable(): boolean {
  return !!getQZ();
}

export function isConnected(): boolean {
  return connected;
}

export async function status(): Promise<{ available: boolean; connected: boolean }> {
  const qz = getQZ();
  const available = !!qz;
  if (!qz) return { available: false, connected: false };
  try {
    // Algunas versiones exponen websocket.isActive()
    const active = qz.websocket && typeof qz.websocket.isActive === 'function'
      ? await qz.websocket.isActive()
      : connected;
    return { available, connected: !!active };
  } catch (err) {
    return { available, connected: connected };
  }
}

export default {
  connect,
  disconnect,
  getPrinters,
  printHTML,
  printRaw,
  printRawHex,
  openCashDrawer,
  isAvailable,
  isConnected,
  status,
};
