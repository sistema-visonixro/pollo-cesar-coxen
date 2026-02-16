import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  guardarDatosNegocioCache,
  obtenerDatosNegocioCache,
} from "./utils/offlineSync";

interface DatosNegocio {
  id?: number;
  nombre_negocio: string;
  rtn: string;
  direccion: string;
  celular: string;
  propietario: string;
  logo_url: string | null;
}

const defaultDatos: DatosNegocio = {
  nombre_negocio: "puntoventa",
  rtn: "",
  direccion: "",
  celular: "",
  propietario: "",
  logo_url: null,
};

let cachedDatos: DatosNegocio | null = null;

export function useDatosNegocio() {
  const [datos, setDatos] = useState<DatosNegocio>(cachedDatos || defaultDatos);
  const [loading, setLoading] = useState(!cachedDatos);

  useEffect(() => {
    if (cachedDatos) return;

    async function cargarDatos() {
      try {
        const { data, error } = await supabase
          .from("datos_negocio")
          .select("*")
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error al cargar datos del negocio:", error);
          throw error; // Lanzar para ir al catch
        }

        if (data) {
          cachedDatos = data;
          setDatos(data);

          // Guardar en IndexedDB para uso offline
          await guardarDatosNegocioCache({
            id: data.id?.toString() || "1",
            nombre_negocio: data.nombre_negocio,
            rtn: data.rtn,
            direccion: data.direccion,
            celular: data.celular,
            propietario: data.propietario,
            logo_url: data.logo_url,
          });
          console.log("✓ Datos del negocio guardados en cache");

          // Actualizar el título de la página
          document.title = data.nombre_negocio || "puntoventa";

          // Actualizar el favicon si hay logo
          if (data.logo_url) {
            updateFavicon(data.logo_url);
          }
        }
      } catch (error) {
        console.error("Error:", error);

        // Intentar cargar desde cache si falla Supabase
        try {
          console.log("🔄 Intentando cargar datos del negocio desde cache...");
          const datosCache = await obtenerDatosNegocioCache();

          if (datosCache) {
            console.log("✓ Datos del negocio recuperados desde cache");
            const datosRecuperados: DatosNegocio = {
              id: parseInt(datosCache.id),
              nombre_negocio: datosCache.nombre_negocio,
              rtn: datosCache.rtn,
              direccion: datosCache.direccion,
              celular: datosCache.celular,
              propietario: datosCache.propietario,
              logo_url: datosCache.logo_url,
            };

            cachedDatos = datosRecuperados;
            setDatos(datosRecuperados);

            // Actualizar el título de la página
            document.title = datosRecuperados.nombre_negocio || "puntoventa";

            // Actualizar el favicon si hay logo
            if (datosRecuperados.logo_url) {
              updateFavicon(datosRecuperados.logo_url);
            }
          } else {
            console.warn("⚠ No hay datos del negocio en cache");
          }
        } catch (cacheError) {
          console.error(
            "Error cargando datos del negocio desde cache:",
            cacheError,
          );
        }
      } finally {
        setLoading(false);
      }
    }

    cargarDatos();
  }, []);

  return { datos, loading };
}

function updateFavicon(logoUrl: string) {
  // Actualizar favicon
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = logoUrl;

  // Actualizar apple-touch-icon si existe
  let appleLink = document.querySelector(
    "link[rel~='apple-touch-icon']",
  ) as HTMLLinkElement;
  if (!appleLink) {
    appleLink = document.createElement("link");
    appleLink.rel = "apple-touch-icon";
    document.head.appendChild(appleLink);
  }
  appleLink.href = logoUrl;
}

// Función para invalidar el cache (llamar después de actualizar en DatosNegocioView)
export function invalidarCacheDatosNegocio() {
  cachedDatos = null;
}
