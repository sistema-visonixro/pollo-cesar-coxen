// Wrapper robusto para QZ Tray 2.2.5
// Expone los métodos principales de la API QZ Tray y helpers para impresión y apertura de gaveta.
//
// Uso recomendado:
// import qz from './qz';
// await qz.websocket.connect();
// if (await qz.websocket.isActive()) {
//   const printers = await qz.printers.find();
//   const config = qz.configs.create('NOMBRE_IMPRESORA');
//   await qz.print(config, [{ type: 'html', format: 'plain', data: '<h1>Prueba</h1>' }]);
//   // Para abrir gaveta:
//   await qz.print(config, [{ type: 'raw', format: 'hex', data: '1B700019FA' }]);
// }
// QZ Tray TypeScript wrapper removed — stubbed implementation.
// Kept to avoid import errors in existing code. All methods throw or return 'not available'.
export async function getQZInstance(): Promise<any> {
  return null;
}

export const websocket = {
  async connect() { throw new Error('QZ Tray integration removed'); },
  async disconnect() {},
  async isActive() { return false; },
  setErrorCallbacks() {},
  setClosedCallbacks() {},
};

export const printers = {
  async find() { return []; },
  async getDefault() { return null; },
  async details() { return []; },
};

export const configs = {
  async create() { throw new Error('QZ Tray integration removed'); },
  setDefaults() {},
};

export async function print() { throw new Error('QZ Tray integration removed'); }

export const security = { setSignaturePromise() {}, setSignatureAlgorithm() {}, getSignatureAlgorithm() { return null; } };

export const api = { showDebug() {}, getVersion() { return null; }, isVersion() { return false; } };

export function configure() {}
export async function connect() { throw new Error('QZ Tray integration removed'); }
export async function disconnect() {}
export async function getPrinters() { return []; }
export async function printHTML() { throw new Error('QZ Tray integration removed'); }
export async function printRaw() { throw new Error('QZ Tray integration removed'); }
export async function printRawHex() { throw new Error('QZ Tray integration removed'); }
export async function openCashDrawer() { throw new Error('QZ Tray integration removed'); }
export function isAvailable() { return false; }
export function isConnected() { return false; }
export async function status() { return { available: false, connected: false }; }

export default {
  configure,
  connect,
  disconnect,
  getPrinters,
  printHTML,
};
