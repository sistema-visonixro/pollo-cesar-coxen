/**
 * Configuración centralizada de imágenes y assets de la aplicación VENTA
 * Todas las referencias a imágenes deben usar estas constantes
 */

// Logo principal de la aplicación
export const LOGO_IMAGE = "/logo.png";

// Imagen de fondo principal (usar logo por defecto)
export const BACKGROUND_IMAGE = LOGO_IMAGE;

// Función helper para obtener la URL del fondo como CSS
export const getBackgroundStyle = () => 
  `url(${BACKGROUND_IMAGE}) center/cover no-repeat`;
