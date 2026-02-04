# PuntoDeVenta
## 🔄 Sistema de Actualización Automática PWA

Esta aplicación está configurada para **actualizarse automáticamente** sin intervención del usuario.

### Cómo funciona:

1. **Detección automática**: La app verifica cada 60 segundos si hay una nueva versión disponible
2. **Actualización inmediata**: Cuando detecta una nueva versión, se actualiza automáticamente sin pedir confirmación
3. **Service Worker optimizado**: Usa `skipWaiting()` y `claim()` para activarse inmediatamente

### Para desplegar una nueva versión:

1. **Actualizar el número de versión** en dos lugares:
   - `public/version.json`: Cambia el número de versión (ej: `"1.4.0"` → `"1.4.1"`)
   - `public/service-worker.js`: Cambia `CACHE_NAME` (ej: `"pdv-cache-v1.3.0"` → `"pdv-cache-v1.4.1"`)

2. **Hacer build y deploy**:
   ```bash
   npm run build
   vercel --prod
   ```

3. **Resultado**: Todas las PWA instaladas se actualizarán automáticamente en un máximo de 60 segundos

### Notas importantes:

- ✅ Los usuarios NO verán ningún modal de actualización
- ✅ La app se recargará automáticamente cuando haya una nueva versión
- ✅ El Service Worker limpia los caches antiguos automáticamente
- ✅ Funciona tanto en navegador como en PWA instalada
- ⚠️ Asegúrate de cambiar AMBOS archivos (version.json y service-worker.js) al desplegar