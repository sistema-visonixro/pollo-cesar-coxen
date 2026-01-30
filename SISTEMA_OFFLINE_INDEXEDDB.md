# Sistema de Sincronización Offline con IndexedDB

## 📋 Descripción

Este sistema permite que el punto de ventas continúe funcionando sin conexión a internet, guardando automáticamente todas las facturas y pagos en IndexedDB (base de datos local del navegador) y sincronizándolos con Supabase cuando se restaure la conexión.

## 🎯 Características

### ✅ Funcionamiento Automático
- **Sin configuración manual**: El sistema se activa automáticamente al cargar el punto de ventas
- **Doble guardado**: Siempre guarda primero en IndexedDB y luego intenta sincronizar con Supabase
- **Sin pérdida de datos**: Si falla la conexión, los datos quedan seguros en IndexedDB

### 🔄 Sincronización Inteligente
- **Automática cada 30 segundos**: Si hay conexión, sincroniza registros pendientes
- **Al recuperar conexión**: Detecta automáticamente cuando vuelve internet y sincroniza
- **Manual**: Click en el indicador de pendientes para sincronizar manualmente
- **Reintentos**: Si un registro falla 5 veces, se marca para revisión

### 📊 Indicadores Visuales
- **Estado de conexión** (esquina superior derecha):
  - 🟢 Verde: Conectado
  - 🔴 Rojo: Sin conexión (con animación pulsante)
  
- **Registros pendientes** (esquina superior derecha):
  - 📋 Facturas pendientes
  - 💳 Pagos pendientes
  - 🔄 Estado de sincronización

## 🏗️ Arquitectura

### Flujo de Datos

```
┌─────────────────┐
│  Punto de Venta │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   IndexedDB     │  ◄── Guarda SIEMPRE primero
│  (Local Browser)│
└────────┬────────┘
         │
         ▼ (intenta sincronizar)
┌─────────────────┐
│    Supabase     │  ◄── Si tiene conexión
│   (PostgreSQL)  │
└────────┬────────┘
         │
         ▼ (si es exitoso)
┌─────────────────┐
│ Elimina registro│
│  de IndexedDB   │
└─────────────────┘
```

### Componentes

#### 1. **offlineSync.ts**
Sistema principal de sincronización que maneja:
- Inicialización de IndexedDB
- Guardado de facturas y pagos locales
- Sincronización con Supabase
- Contador de registros pendientes
- Listeners de eventos de conexión

#### 2. **PuntoDeVentaView.tsx**
Integración con la interfaz:
- Uso de funciones de offlineSync
- Actualización de indicadores visuales
- Manejo de errores
- Sincronización manual

## 📦 Almacenamiento

### Tablas de IndexedDB

#### `facturas_pendientes`
```typescript
{
  id: number (auto-increment)
  fecha_hora: string
  cajero: string
  cajero_id: string | null
  caja: string
  cai: string
  factura: string
  cliente: string
  productos: string (JSON)
  sub_total: string
  isv_15: string
  isv_18: string
  total: string
  timestamp: number
  intentos: number
}
```

#### `pagos_pendientes`
```typescript
{
  id: number (auto-increment)
  tipo: string
  monto: number
  banco: string | null
  tarjeta: string | null
  factura: string | null
  autorizador: string | null
  referencia: string | null
  usd_monto: number | null
  fecha_hora: string
  cajero: string
  cajero_id: string | null
  cliente: string
  factura_venta: string
  recibido: number
  cambio: number
  timestamp: number
  intentos: number
}
```

## 🚀 Uso

### Automático
El sistema funciona automáticamente. No se requiere ninguna acción del usuario.

### Sincronización Manual
Si deseas forzar una sincronización:
1. Busca el indicador de registros pendientes (esquina superior derecha)
2. Haz click en el indicador naranja
3. El sistema intentará sincronizar todos los registros pendientes

## 🔧 Funciones Principales

### Guardar Datos

```typescript
// Guardar una factura
const idLocal = await guardarFacturaLocal(factura);

// Guardar pagos
const idsLocales = await guardarPagosLocal(pagos);
```

### Sincronizar

```typescript
// Sincronizar todo automáticamente
const resultado = await sincronizarTodo();

// Sincronizar solo facturas
const resultadoFacturas = await sincronizarFacturas();

// Sincronizar solo pagos
const resultadoPagos = await sincronizarPagos();
```

### Consultar Estado

```typescript
// Obtener contador de pendientes
const { facturas, pagos } = await obtenerContadorPendientes();
```

## 🛡️ Seguridad y Confiabilidad

### Ventajas
- ✅ **No se pierden datos**: Siempre se guarda localmente primero
- ✅ **Funciona offline**: El negocio puede operar sin conexión
- ✅ **Sincronización automática**: No requiere intervención manual
- ✅ **Persistente**: Los datos se mantienen aunque se cierre el navegador
- ✅ **Rápido**: IndexedDB es más rápido que localStorage

### Consideraciones
- ⚠️ Los datos se almacenan en el navegador (no cambiar de navegador o limpiar datos del navegador)
- ⚠️ Si se acumulan muchos registros pendientes (>100), sincronizar manualmente
- ⚠️ Revisar regularmente que no haya registros con más de 5 intentos fallidos

## 🔍 Monitoreo

### En la Consola del Navegador
El sistema registra información detallada:

```
✓ Sistema de sincronización offline inicializado
✓ Factura guardada en IndexedDB (ID: 1)
✓ Factura sincronizada y eliminada de IndexedDB
⚠ Sin conexión. Factura guardada localmente
🔄 Sincronizando 3 facturas pendientes...
```

### Códigos de Estado
- `✓` = Operación exitosa
- `⚠` = Advertencia (sin conexión)
- `❌` = Error

## 🆘 Solución de Problemas

### Los registros no se sincronizan
1. Verificar que hay conexión a internet
2. Verificar la consola del navegador para ver errores
3. Intentar sincronización manual haciendo click en el indicador
4. Verificar que Supabase está funcionando correctamente

### Acumulación de registros pendientes
1. Verificar la conexión a internet
2. Revisar la consola para ver errores específicos
3. Contactar al administrador si hay errores de permisos en Supabase

### El navegador se quedó sin espacio
IndexedDB tiene un límite de almacenamiento. Si se acumulan demasiados registros:
1. Sincronizar manualmente
2. Si persiste, contactar al administrador para revisar la base de datos

## 📝 Logs y Debugging

Para activar logs detallados, abre la consola del navegador (F12) y ejecuta:

```javascript
// Ver todos los registros pendientes
const { facturas, pagos } = await obtenerContadorPendientes();
console.log('Pendientes:', { facturas, pagos });

// Forzar sincronización
await sincronizarTodo();
```

## 🎨 Personalización

### Intervalo de sincronización automática
En [offlineSync.ts](src/utils/offlineSync.ts) línea ~425:

```typescript
setInterval(async () => {
  // Cambiar 30000 (30 segundos) al intervalo deseado en milisegundos
}, 30000);
```

### Máximo de reintentos
En [offlineSync.ts](src/utils/offlineSync.ts) línea ~351 y ~406:

```typescript
if (intentos >= 5) { // Cambiar 5 al número deseado
  console.error(`Registro ha fallado ${intentos} veces`);
}
```

## 📚 Referencias

- [IndexedDB API](https://developer.mozilla.org/es/docs/Web/API/IndexedDB_API)
- [Supabase Documentation](https://supabase.com/docs)
- [Online/Offline Events](https://developer.mozilla.org/es/docs/Web/API/Navigator/onLine)

---

**Desarrollado para Punto de Venta Pollodonaconcha**  
*Sistema de sincronización offline implementado en Enero 2026*
