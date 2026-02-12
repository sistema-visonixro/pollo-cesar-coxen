# Sistema de Imágenes Centralizado

Este archivo centraliza todas las referencias a imágenes y assets de la aplicación.

## Archivo: `images.ts`

Contiene las constantes para todas las imágenes utilizadas en la aplicación:

### Constantes disponibles:

- **`BACKGROUND_IMAGE`**: Imagen de fondo principal de la aplicación
  - Valor actual: `/logo.png` (se usa el logo por defecto)
  - Uso: Fondos de login, splash screens, etc. Si hay un logo subido en `datos_negocio.logo_url`, los componentes que usan `useDatosNegocio()` lo preferirán en tiempo de ejecución.

- **`LOGO_IMAGE`**: Logo principal de la aplicación
  - Valor actual: `/logo.png`
  - Uso: Header, modales, ventanas de información

- **`FAVICON_32`**: Favicon 32x32
- **`FAVICON_ICO`**: Favicon .ico
- **`ICON_192`**: Icono 192x192 para PWA
- **`ICON_512`**: Icono 512x512 para PWA
- **`LOGO_SVG`**: Logo en formato SVG (fallback)

### Funciones Helper:

- **`getBackgroundStyle()`**: Retorna el string CSS para usar como background
  ```typescript
  background: getBackgroundStyle()
  ```

- **`getLogoWithFallback()`**: Retorna objeto con logo principal y fallback
  ```typescript
  const { primary, fallback } = getLogoWithFallback();
  ```

## Uso

### En componentes React:

```typescript
import { BACKGROUND_IMAGE, LOGO_IMAGE, getBackgroundStyle } from './assets/images';

// Para fondos
<div style={{ background: getBackgroundStyle() }}>
  ...
</div>

// Para logos
<img src={LOGO_IMAGE} alt="Logo" />
```

### En archivos CSS:

Actualizar manualmente el CSS para usar la URL de BACKGROUND_IMAGE:
```css
background: url('https://i.imgur.com/TsxgzAi.png') no-repeat center center fixed;
```

## Archivos actualizados:

- ✅ `/src/Login.tsx`
- ✅ `/src/FondoImagen.tsx`
- ✅ `/src/Landing.tsx`
- ✅ `/src/CajaOperadaView.tsx`
- ✅ `/src/AdminPanel.tsx`
- ✅ `/src/ResultadosCajaView.tsx`
- ✅ `/src/index.css`
- ✅ `/VENTA/src/Landing.tsx`
- ✅ `/VENTA/src/index.css`

## Cambiar imagen de fondo

Para cambiar la imagen de fondo de toda la aplicación:

1. Abre `/src/assets/images.ts`
2. Actualiza la constante `BACKGROUND_IMAGE`
3. Actualiza también en `/VENTA/src/assets/images.ts` si es necesario
4. Actualiza los archivos CSS manualmente

Todos los componentes que usen `getBackgroundStyle()` o `BACKGROUND_IMAGE` se actualizarán automáticamente.
