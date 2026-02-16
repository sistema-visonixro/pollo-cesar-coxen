# Sistema PWA Offline Completo - Punto de Venta

## 📋 Descripción General

Sistema completo de funcionalidad offline para el punto de venta, permitiendo operaciones continuas incluso sin conexión a internet. Los datos se almacenan localmente en IndexedDB y se sincronizan automáticamente con Supabase cuando hay conexión disponible.

---

## ✅ Funcionalidades Implementadas

### 1. Almacenamiento Local (IndexedDB)

**Base de datos:** `PuntoVentaOfflineDB` (Versión 2)

**Stores (Tablas):**
- ✅ `facturas_pendientes` - Facturas no sincronizadas
- ✅ `pagos_pendientes` - Pagos no sincronizados
- ✅ `gastos_pendientes` - Gastos no sincronizados
- ✅ `envios_pendientes` - Pedidos de envío no sincronizados
- ✅ `productos_cache` - Cache de productos para uso offline

Cada registro incluye:
- `timestamp`: Marca de tiempo de creación
- `intentos`: Contador de intentos de sincronización
- Todos los campos necesarios para la operación

---

## 🔄 Operaciones Disponibles Offline

### ✅ Permitidas SIN conexión:

1. **Facturación de productos**
   - Se factura normalmente
   - Guarda en IndexedDB inmediatamente
   - Imprime factura sin esperar confirmación
   - Número de factura se actualiza automáticamente

2. **Registro de gastos**
   - Se guardan localmente
   - Se sincronizan cuando hay conexión

3. **Pedidos por teléfono (domicilios)**
   - Se registran localmente
   - Se imprimen comandas inmediatamente
   - Se sincronizan después

4. **Impresión**
   - Recibos
   - Comandas
   - Funciona completamente offline

### ❌ NO permitidas sin conexión:

1. **Resumen de Caja**
   - Requiere datos en tiempo real del servidor
   - Muestra modal de advertencia si no hay conexión

2. **Cierre de Caja**
   - Requiere sincronización completa con servidor
   - Muestra modal de advertencia si no hay conexión

---

## 🔄 Sincronización Automática

### Estrategia de Sincronización

1. **Guardado Doble:**
   ```
   Operación → IndexedDB (inmediato) → Supabase (si hay conexión)
   ```

2. **Si la subida a Supabase es exitosa:**
   - El registro se elimina de IndexedDB
   - Solo queda en el servidor

3. **Si falla la conexión:**
   - El registro permanece en IndexedDB
   - Se reintenta automáticamente

### Frecuencia de Sincronización

- ⏱️ **Cada 30 segundos** (automático)
- 🔌 **Al recuperar conexión** (automático)
- 👆 **Manual:** Click en el indicador naranja de pendientes

### Reintentos

- Cada registro cuenta sus intentos de sincronización
- Después de 5 intentos fallidos, se marca para revisión
- Se sigue intentando hasta que sea exitoso

---

## 🎨 Indicadores Visuales

### Estado de Conexión (esquina superior derecha)
```
🟢 Conectado        - Fondo verde, texto "Conectado"
🔴 Sin conexión     - Fondo rojo pulsante, texto "Sin conexión"
```

### Registros Pendientes (esquina superior derecha)
```
⚠ Pendientes de sync:
📋 X factura(s)
💳 X pago(s)
💰 X gasto(s)
📦 X envío(s)
🔄 Sincronizando... (cuando está en proceso)
```

**Acción:** Click en el indicador para sincronizar manualmente

---

## ⌨️ Atajos de Teclado

### Ctrl + 0
**Función:** Actualizar cache de productos

**Proceso:**
1. Presionar `Ctrl + 0`
2. El sistema descarga todos los productos desde Supabase
3. Guarda en cache local (IndexedDB)
4. Recarga los productos en la interfaz

**Requisitos:** Conexión a internet

**Mensaje de éxito:** `✓ Cache actualizado: X productos`

---

## 🚫 Bloqueos por Falta de Conexión

### Modal de Advertencia

Cuando intentas acceder a **Resumen de Caja** o **Cierre de Caja** sin conexión:

```
⚠️ Sin Conexión a Internet

El Resumen de Caja y el Cierre de Caja requieren conexión a 
internet para acceder a los datos del servidor.

Operaciones disponibles sin conexión:
✓ Facturación de productos
✓ Registro de gastos
✓ Pedidos por teléfono
✓ Impresión de recibos y comandas

Verifica tu conexión a internet e intenta nuevamente.
```

### Estados Visuales de Botones

**Con conexión:**
- Botones con colores normales
- Cursor: pointer
- Completamente funcionales

**Sin conexión:**
- Botones en gris (#9e9e9e)
- Cursor: not-allowed
- Opacidad reducida (60%)
- Tooltip indica requerimiento de conexión

---

## 📊 Flujo de Datos Completo

### Facturación
```
1. Usuario selecciona productos
2. Click en "Guardar" o "Imprimir"
3. ┌─ Guardar en IndexedDB (SIEMPRE)
4. └─ Intentar subir a Supabase
5.    ├─ ✓ Exitoso → Eliminar de IndexedDB
6.    └─ ✗ Fallido → Mantener en IndexedDB
7. Actualizar número de factura local
8. Imprimir factura (no depende de conexión)
9. Mostrar mensaje de éxito
```

### Gastos
```
1. Usuario ingresa datos del gasto
2. Click en "Guardar"
3. ┌─ Guardar en IndexedDB
4. └─ Intentar subir a Supabase
5.    ├─ ✓ Exitoso → Eliminar de IndexedDB
6.    └─ ✗ Fallido → Mantener en IndexedDB
7. Mostrar confirmación
```

### Pedidos por Teléfono
```
1. Usuario completa formulario de envío
2. Click en "Guardar Pedido"
3. ┌─ Guardar en IndexedDB
4. └─ Intentar subir a Supabase
5.    ├─ ✓ Exitoso → Eliminar de IndexedDB
6.    └─ ✗ Fallido → Mantener en IndexedDB
7. Imprimir comanda (incluye "PEDIDO POR TELÉFONO")
8. Imprimir recibo
```

### Sincronización Automática (cada 30 seg)
```
1. Verificar si hay conexión (navigator.onLine)
2. Si hay conexión:
   ├─ Obtener contador de pendientes
   ├─ Si hay pendientes > 0:
   │  ├─ Sincronizar facturas
   │  ├─ Sincronizar pagos
   │  ├─ Sincronizar gastos
   │  └─ Sincronizar envíos
   └─ Eliminar exitosos de IndexedDB
```

---

## 🛠️ Archivos Modificados/Creados

### Nuevos Archivos

1. **`src/utils/useConexion.ts`**
   - Hook personalizado para detectar estado de conexión
   - Retorna: `{ conectado, intentandoReconectar }`
   - Listeners para eventos online/offline

### Archivos Actualizados

2. **`src/utils/offlineSync.ts`** (Ampliado)
   - ✅ Agregados tipos: `GastoPendiente`, `EnvioPendiente`, `ProductoCache`
   - ✅ Nuevas stores en IndexedDB
   - ✅ Funciones para gastos: `guardarGastoLocal`, `sincronizarGastos`
   - ✅ Funciones para envíos: `guardarEnvioLocal`, `sincronizarEnvios`
   - ✅ Funciones para productos: `guardarProductosCache`, `obtenerProductosCache`, `actualizarCacheProductos`
   - ✅ Funciones de utilidad: `estaConectado()`, `hayProductosEnCache()`
   - ✅ Actualizada función `sincronizarTodo()` para incluir todos los tipos
   - ✅ Actualizada función `obtenerContadorPendientes()` para 4 tipos de datos

3. **`src/PuntoDeVentaView.tsx`** (Integrado completamente)
   - ✅ Importaciones actualizadas con nuevas funciones
   - ✅ Hook `useConexion()` integrado
   - ✅ Estado `pendientesCount` expandido (4 tipos)
   - ✅ Función `sincronizarManualmente()` actualizada
   - ✅ Función `cargarProductos()` creada para recarga
   - ✅ Listener Ctrl+0 para actualización de productos
   - ✅ Gastos con guardado offline
   - ✅ Envíos con guardado offline
   - ✅ Botones Resumen y Cierre bloqueados sin conexión
   - ✅ Modal de advertencia mejorado
   - ✅ Indicadores visuales actualizados

---

## 📝 Logs y Debugging

### Console Messages

El sistema registra información detallada en la consola:

```javascript
// Inicialización
"✓ Sistema de sincronización offline inicializado"
"✓ 156 productos cargados en cache"

// Guardado
"✓ Factura guardada en IndexedDB (ID: 42)"
"✓ Gasto guardado en IndexedDB (ID: 7)"

// Sincronización
"✓ Factura sincronizada y eliminada de IndexedDB"
"⚠ Factura guardada localmente, se sincronizará después"
"Sincronizando 3 facturas pendientes..."

// Conexión
"✓ Conexión restaurada"
"⚠ Sin conexión a internet"

// Actualizaciones
"✓ Cache actualizado: 156 productos"
```

### Verificación Manual

Para ver el estado del sistema en la consola del navegador:

```javascript
// Ver registros pendientes
const pendientes = await obtenerContadorPendientes();
console.log(pendientes);
// { facturas: 2, pagos: 4, gastos: 1, envios: 0 }

// Ver productos en cache
const productos = await obtenerProductosCache();
console.log(productos.length + " productos en cache");

// Verificar conexión
console.log(estaConectado()); // true o false

// Sincronizar manualmente
await sincronizarTodo();
```

---

## ⚙️ Configuración Técnica

### IndexedDB
- **Nombre:** `PuntoVentaOfflineDB`
- **Versión:** 2
- **Ubicación:** Almacenamiento local del navegador
- **Límite:** Depende del navegador (~50MB Chrome, ~100MB Firefox)

### Sincronización
- **Intervalo automático:** 30 segundos
- **Timeout por operación:** Sin límite
- **Reintentos máximos:** Infinito (con contador)
- **Estrategia:** Optimista (guardar local primero)

### Detección de Conexión
- **API:** `navigator.onLine`
- **Eventos:** `online`, `offline`
- **Verificación:** Cada cambio de estado de red

---

## 🔐 Seguridad y Confiabilidad

### Ventajas

✅ **No se pierden datos:** Guardado local garantizado
✅ **Continuidad del negocio:** Opera sin internet
✅ **Sincronización automática:** Sin intervención manual
✅ **Persistente:** Datos sobreviven cierre de navegador
✅ **Rápido:** IndexedDB es más rápido que red
✅ **Visual:** Indicadores claros de estado

### Consideraciones

⚠️ **Navegador único:** Datos en un solo navegador
⚠️ **No limpiar datos:** No borrar datos del navegador
⚠️ **Acumulación:** Revisar si hay muchos pendientes (>100)
⚠️ **Fallos repetidos:** Investigar registros con >5 intentos
⚠️ **Cache de productos:** Actualizar periódicamente con Ctrl+0

---

## 🧪 Testing y Verificación

### Pruebas Recomendadas

1. **Facturación Offline**
   ```
   1. Desconectar internet
   2. Facturar un producto
   3. Verificar que se imprime
   4. Conectar internet
   5. Verificar que se sincroniza (desaparece indicador pendiente)
   ```

2. **Bloqueo de Operaciones**
   ```
   1. Desconectar internet
   2. Click en "Resumen"
   3. Verificar modal de advertencia
   4. Click en "Cierre de Caja"
   5. Verificar modal de advertencia
   ```

3. **Sincronización Automática**
   ```
   1. Desconectar internet
   2. Hacer 3 facturas
   3. Verificar indicador "3 factura(s) pendientes"
   4. Conectar internet
   5. Esperar ~30 segundos
   6. Verificar que desaparece el indicador
   ```

4. **Actualización de Productos**
   ```
   1. Asegurar conexión
   2. Presionar Ctrl+0
   3. Verificar mensaje de confirmación
   4. Verificar que productos se actualizan
   ```

5. **Cache de Productos Offline**
   ```
   1. Con conexión, presionar Ctrl+0
   2. Desconectar internet
   3. Recargar la página
   4. Verificar que productos siguen disponibles
   ```

---

## 📞 Soporte y Resolución de Problemas

### Problema: No sincroniza automáticamente

**Solución:**
1. Verificar conexión a internet
2. Abrir consola del navegador (F12)
3. Buscar errores
4. Click manual en indicador pendientes

### Problema: Productos no aparecen

**Solución:**
1. Verificar conexión
2. Presionar Ctrl+0 para actualizar cache
3. Si sigue sin aparecer, revisar consola

### Problema: Indicador pendientes no desaparece

**Solución:**
1. Verificar que hay conexión real (no solo icono)
2. Click manual en el indicador
3. Revisar consola para ver errores de Supabase

### Problema: Modal de "sin conexión" aparece con conexión

**Solución:**
1. Recargar la página (F5)
2. Verificar conexión real (abrir google.com en otra pestaña)
3. Verificar configuración de firewall/proxy

---

## 🎯 Mejoras Futuras Sugeridas

1. **Notificaciones push** cuando se restaura conexión
2. **Estadísticas de uso offline** en panel admin
3. **Export de datos** pendientes en formato JSON
4. **Límite de registros** en IndexedDB con limpieza automática
5. **Compresión de datos** para ahorrar espacio
6. **Service Worker mejorado** para cache de assets
7. **Background Sync API** para sincronización en segundo plano
8. **Resolución de conflictos** si se edita mismo dato online/offline

---

## 📚 Referencias Técnicas

- **IndexedDB API:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Navigator.onLine:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- **PWA Best Practices:** https://web.dev/progressive-web-apps/
- **Offline First Pattern:** https://offlinefirst.org/

---

## ✅ Checklist de Implementación

- [x] Crear stores en IndexedDB para todos los tipos de datos
- [x] Implementar guardado offline para facturas
- [x] Implementar guardado offline para pagos
- [x] Implementar guardado offline para gastos
- [x] Implementar guardado offline para envíos
- [x] Crear cache de productos
- [x] Implementar sincronización automática
- [x] Agregar indicadores visuales de estado
- [x] Bloquear resumen de caja sin conexión
- [x] Bloquear cierre de caja sin conexión
- [x] Crear modal de advertencia informativo
- [x] Implementar atajo Ctrl+0
- [x] Hook de detección de conexión
- [x] Actualizar contadores de pendientes
- [x] Documentación completa
- [x] Testing de todas las funcionalidades

---

**Fecha de Implementación:** Febrero 2026  
**Versión:** 2.0  
**Estado:** ✅ Completamente Implementado
