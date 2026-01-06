import { useEffect, useState } from "react";
import { getLocalDayRange } from "./utils/fechas";
import { supabase } from "./supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { NOMBRE_NEGOCIO_UPPER } from "./empresa";

// use centralized supabase client from src/supabaseClient.ts

interface ResultadosViewProps {
  onBack?: () => void;
  onVerFacturasEmitidas?: () => void;
}

export default function ResultadosView({
  onBack,
  onVerFacturasEmitidas,
}: ResultadosViewProps) {
  // Inicializar los filtros de fecha al día actual (formato YYYY-MM-DD)
  const today = getLocalDayRange().day;
  const [desde, setDesde] = useState(() => today);
  const [hasta, setHasta] = useState(() => today);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [ventasMensuales, setVentasMensuales] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [ventasPorDia, setVentasPorDia] = useState<any[]>([]);
  const [mesFiltro, setMesFiltro] = useState("");
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [cajeroFiltro, setCajeroFiltro] = useState("");
  // Obtener usuario actual de localStorage
  const usuarioActual = (() => {
    try {
      const stored = localStorage.getItem("usuario");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    fetchDatos();
    fetchCajeros();
  }, [desde, hasta]);

  async function fetchCajeros() {
    try {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .order("nombre");
      setCajeros(data || []);
    } catch (error) {
      console.error("Error fetching cajeros:", error);
    }
  }

  // Si el usuario no es admin, mostrar mensaje y bloquear acceso
  if (
    !usuarioActual ||
    (usuarioActual.rol !== "admin" && usuarioActual.rol !== "Admin")
  ) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1a2e",
          color: "#fff",
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        Acceso restringido: solo administradores pueden ver el dashboard
        financiero.
      </div>
    );
  }

  async function fetchDatos() {
    try {
      let factQuery = supabase
        .from("facturas")
        .select("*")
        .order("fecha_hora", { ascending: false });
      let gastQuery = supabase
        .from("gastos")
        .select("*")
        .order("fecha", { ascending: false });

      if (desde && hasta) {
        // Normalizar filtros para incluir las 24 horas del día seleccionado
        const desdeInicio = `${desde} 00:00:00`;
        const hastaFin = `${hasta} 23:59:59`;

        factQuery = supabase
          .from("facturas")
          .select("*")
          .gte("fecha_hora", desdeInicio)
          .lte("fecha_hora", hastaFin)
          .order("fecha_hora", { ascending: false });

        if (cajeroFiltro) {
          factQuery = factQuery.eq("cajero_id", cajeroFiltro);
        }

        // Para tablas que usan campo "fecha" (sin hora) mantener comparación por día
        gastQuery = supabase
          .from("gastos")
          .select("*")
          .gte("fecha", desde)
          .lte("fecha", hasta)
          .order("fecha", { ascending: false });
      }

      const [{ data: factData }, { data: gastData }] = await Promise.all([
        factQuery,
        gastQuery,
      ]);
      setFacturas(factData || []);
      setGastos(gastData || []);
      calcularMensual(factData || [], gastData || []);
      calcularPorDia(factData || []);
      function calcularPorDia(facturas: any[]) {
        // Agrupar ventas por día
        const ventasAgrupadas: { [fecha: string]: number } = {};
        facturas.forEach((fact) => {
          const fecha = fact.fecha_hora.split("T")[0];
          ventasAgrupadas[fecha] =
            (ventasAgrupadas[fecha] || 0) + (fact.total || 0);
        });
        // Convertir a array para la gráfica
        const ventasArray = Object.entries(ventasAgrupadas).map(
          ([fecha, total]) => ({ fecha, total })
        );
        setVentasPorDia(ventasArray);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  async function generarReportePDF() {
    if (!desde || !hasta) {
      alert(
        "Por favor selecciona las fechas Desde y Hasta antes de generar el reporte."
      );
      return;
    }

    // Abrir ventana inmediatamente (acción directa del click) para evitar bloqueo de popups
    const win = window.open("", "_blank");
    if (!win) {
      alert(
        "Popup bloqueado. Por favor permite popups o usa la opción alternativa."
      );
      return;
    }
    // Mostrar placeholder de carga
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Generando reporte...</title></head><body><h3>Cargando reporte...</h3></body></html>`
    );
    win.document.close();

    try {
      // Normalizar rango al mismo formato que usa la vista: 'YYYY-MM-DD HH:MM:SS'
      // (evitamos toISOString() para no introducir desplazamientos por zona horaria)
      const desdeInicio = `${desde} 00:00:00`;
      const hastaFin = `${hasta} 23:59:59`;

      // Consultas paralelas (incluyendo precio_dolar)
      const [factRes, gastRes, pagosRes, cierresRes, precioDolarRes] =
        await Promise.all([
          supabase
            .from("facturas")
            .select("*")
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin)
            .order("fecha_hora", { ascending: true }),
          supabase
            .from("gastos")
            .select("*")
            .gte("fecha", desde)
            .lte("fecha", hasta)
            .order("fecha", { ascending: true }),
          supabase
            .from("pagos")
            .select("*")
            .gte("fecha_hora", desdeInicio)
            .lte("fecha_hora", hastaFin)
            .order("fecha_hora", { ascending: true }),
          supabase
            .from("cierres")
            .select("*")
            .eq("tipo_registro", "cierre")
            // la columna `fecha` puede ser fecha o timestamp; usar comparador por día
            .gte("fecha", desdeInicio)
            .lte("fecha", hastaFin)
            .order("fecha", { ascending: true }),
          supabase
            .from("precio_dolar")
            .select("valor")
            .eq("id", "singleton")
            .limit(1)
            .single(),
        ]);

      const precioDolar = precioDolarRes.data?.valor
        ? Number(precioDolarRes.data.valor)
        : 0;

      const factData = factRes.data || [];
      const gastData = gastRes.data || [];
      const pagosData = pagosRes.data || [];
      const cierresData = cierresRes.data || [];

      const totalFacturas = factData.length;
      const totalVentas = factData.reduce((s: number, f: any) => {
        const val =
          f.total !== undefined && f.total !== null
            ? Number(String(f.total).replace(/,/g, ""))
            : 0;
        return s + (isNaN(val) ? 0 : val);
      }, 0);
      const totalGastos = gastData.reduce(
        (s: number, g: any) => s + parseFloat(g.monto || 0),
        0
      );
      const balanceReporte = totalVentas - totalGastos;
      const rentabilidadPercent =
        totalGastos > 0 ? (balanceReporte / totalGastos) * 100 : null;

      // Desglose de pagos (separar dolares USD de Lps)
      const pagosPorTipo: { [k: string]: number } = {};
      let dolaresUSD = 0;
      pagosData.forEach((p: any) => {
        const tipo = p.tipo || "Desconocido";
        if (tipo === "dolares") {
          // Para dólares, acumular el valor en USD desde usd_monto
          dolaresUSD += parseFloat(p.usd_monto || 0);
        }
        pagosPorTipo[tipo] =
          (pagosPorTipo[tipo] || 0) + parseFloat(p.monto || 0);
      });
      const dolaresLps = pagosPorTipo["dolares"] || 0;

      // Total de todos los pagos (raw) y cálculo de pagos únicos por factura
      const totalPagosRaw = pagosData.reduce((s: number, p: any) => {
        const val =
          p.monto !== undefined && p.monto !== null
            ? Number(String(p.monto).replace(/,/g, ""))
            : 0;
        return s + (isNaN(val) ? 0 : val);
      }, 0);

      // Agrupar pagos por número de factura para no contar facturas repetidas
      const pagosPorFacturaMap = new Map<
        string,
        {
          factura: string;
          monto: number;
          tipos: Set<string>;
          cajero?: string;
          fecha?: string;
        }
      >();
      pagosData.forEach((p: any) => {
        const facturaKey = p.factura
          ? String(p.factura)
          : `__no_fact_${p.id || Math.random()}`;
        const monto =
          p.monto !== undefined && p.monto !== null
            ? Number(String(p.monto).replace(/,/g, ""))
            : 0;
        const tipo = p.tipo || "";
        const fecha = p.fecha_hora || p.fecha || "";
        const cajero = p.cajero || "";
        if (pagosPorFacturaMap.has(facturaKey)) {
          const entry = pagosPorFacturaMap.get(facturaKey)!;
          entry.monto += isNaN(monto) ? 0 : monto;
          if (tipo) entry.tipos.add(tipo);
          // mantener la fecha más temprana
          if (fecha && (!entry.fecha || fecha < entry.fecha))
            entry.fecha = fecha;
        } else {
          const tiposSet = new Set<string>();
          if (tipo) tiposSet.add(tipo);
          pagosPorFacturaMap.set(facturaKey, {
            factura: facturaKey,
            monto: isNaN(monto) ? 0 : monto,
            tipos: tiposSet,
            cajero,
            fecha,
          });
        }
      });

      const pagosUnicosArray = Array.from(pagosPorFacturaMap.values());
      const totalPagosUnique = pagosUnicosArray.reduce(
        (s, p) => s + (p.monto || 0),
        0
      );

      // Debug: comparar facturas y pagos por factura (opcional)
      try {
        console.debug(
          "ReportePDF: facturas count",
          factData.length,
          "pagos count",
          pagosData.length
        );
        console.debug(
          "ReportePDF: totalVentas (facturas)",
          totalVentas,
          "totalPagosRaw (pagos)",
          totalPagosRaw,
          "totalPagosUnique",
          totalPagosUnique
        );
      } catch (e) {}

      // Construir HTML para imprimir
      const titulo = `Reporte Ventas ${desde} → ${hasta}`;
      let html = `<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>`;
      // indicar icono (si existe en /favicon-32.png)
      html += `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`;
      html += `<style>body{font-family: Arial, Helvetica, sans-serif;margin:20px;color:#111}h1,h2{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px;text-align:left}thead th{background:#f2f2f2} .section{margin-top:18px}.report-header{display:flex;align-items:center;gap:16px}.report-logo{width:84px;height:84px;object-fit:contain}.report-title{font-size:28px;font-weight:800}</style>`;
      // Header con logo (intenta cargar /logo.png, si no existe se oculta)
      html += `</head><body>`;
      // intentar usar /favicon-32.png como logo; si falla, caer a /logo.svg
      html += `<div class="report-header"><img class="report-logo" src="/favicon-32.png" alt="logo" onerror="this.onerror=null;this.src='/logo.svg'"/><div><div class="report-title">${NOMBRE_NEGOCIO_UPPER}</div><div style=\"margin-top:6px;color:#444\">${titulo}</div></div></div>`;
      html += `<div class="section"><h2>Resumen</h2><table><tbody>`;
      html += `<tr><th>Total facturas</th><td>${totalFacturas}</td></tr>`;
      html += `<tr><th>Total ventas</th><td>L ${totalVentas.toFixed(
        2
      )}</td></tr>`;
      html += `<tr><th>Total gastos</th><td>L ${totalGastos.toFixed(
        2
      )}</td></tr>`;
      html += `<tr><th>Balance</th><td>L ${balanceReporte.toFixed(
        2
      )}</td></tr>`;
      html += `<tr><th>Rentabilidad</th><td>${
        rentabilidadPercent !== null
          ? rentabilidadPercent.toFixed(2) + "%"
          : "N/A (sin gastos)"
      }</td></tr>`;

      html += `<div class="section"><h2>Pagos</h2>`;
      if (precioDolar > 0) {
        html += `<p style="background:#fff9e6;padding:8px;border-radius:4px;font-size:13px;"><b>Tipo de Cambio:</b> L ${precioDolar.toFixed(
          2
        )} por $1.00 USD</p>`;
      }
      html += `<table><thead><tr><th>Tipo</th><th>Monto</th></tr></thead><tbody>`;
      const tipos = ["efectivo", "transferencia", "tarjeta"];
      tipos.forEach((t) => {
        const m = Number(pagosPorTipo[t] || 0);
        if (m > 0) {
          const mFmt = m.toLocaleString("de-DE", { minimumFractionDigits: 2 });
          const tLabel = t.charAt(0).toUpperCase() + t.slice(1);
          html += `<tr><td>${tLabel}</td><td>L ${mFmt}</td></tr>`;
        }
      });
      // Dólares: mostrar USD, conversión y Lps
      if (dolaresUSD > 0) {
        const dolaresUSDFmt = dolaresUSD.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        const dolaresLpsFmt = dolaresLps.toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        html += `<tr><td>Dólares</td><td><b>$ ${dolaresUSDFmt}</b> <span style="color:#666;font-size:12px;">(L ${dolaresLpsFmt})</span></td></tr>`;
      }
      // Incluir otros tipos si existen
      Object.keys(pagosPorTipo).forEach((t) => {
        if (![...tipos, "dolares"].includes(t)) {
          const m = Number(pagosPorTipo[t] || 0);
          if (m > 0) {
            const mFmt = m.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
            });
            const tLabel = t.charAt(0).toUpperCase() + t.slice(1);
            html += `<tr><td>${tLabel}</td><td>L ${mFmt}</td></tr>`;
          }
        }
      });
      // Total de pagos en el resumen
      const totalPagosFmt = Number(totalPagosUnique || 0).toLocaleString(
        "de-DE",
        { minimumFractionDigits: 2 }
      );
      html += `<tr><th style="text-align:right">Total Pagos (por factura única)</th><th>L ${totalPagosFmt}</th></tr>`;
      // si es distinto, mostrar total raw como referencia
      if (totalPagosRaw !== totalPagosUnique) {
        const totalPagosRawFmt = Number(totalPagosRaw).toLocaleString("de-DE", {
          minimumFractionDigits: 2,
        });
        html += `<tr><th style="text-align:right">Total Pagos (raw)</th><th>L ${totalPagosRawFmt}</th></tr>`;
      }
      html += `</tbody></table></div>`;

      // Sección VALOR DE VENTA POR CATEGORÍA
      html += `<div class="section"><h2>💰 Valor de Venta por Categoría</h2>`;

      // Calcular ventas por categoría y subcategoría consultando tabla productos
      const ventasPorCategoria: { [key: string]: number } = {
        comida: 0,
        bebida: 0,
        complemento: 0,
      };
      const ventasPorSubcategoria: { [key: string]: number } = {};

      // Obtener todos los IDs de productos únicos
      const productosIds = new Set<string>();
      factData.forEach((f: any) => {
        if (f.productos) {
          try {
            // Parsear el string JSON de productos
            const productosArray =
              typeof f.productos === "string"
                ? JSON.parse(f.productos)
                : f.productos;

            if (Array.isArray(productosArray)) {
              productosArray.forEach((prod: any) => {
                if (prod.id) productosIds.add(prod.id);
              });
            }
          } catch (e) {
            console.error("Error parseando productos:", e);
          }
        }
      });

      // Consultar información de productos desde la base de datos
      const { data: productosInfo } = await supabase
        .from("productos")
        .select("id, tipo, subcategoria")
        .in("id", Array.from(productosIds));

      // Crear mapa de productos para búsqueda rápida
      const productosMap = new Map();
      if (productosInfo) {
        productosInfo.forEach((p: any) => {
          productosMap.set(p.id, {
            tipo: p.tipo,
            subcategoria: p.subcategoria,
          });
        });
      }

      // Calcular ventas usando datos reales de productos
      factData.forEach((f: any) => {
        if (f.productos) {
          try {
            // Parsear el string JSON de productos
            const productosArray =
              typeof f.productos === "string"
                ? JSON.parse(f.productos)
                : f.productos;

            if (Array.isArray(productosArray)) {
              productosArray.forEach((prod: any) => {
                const productoInfo = productosMap.get(prod.id);
                if (productoInfo) {
                  const tipo = productoInfo.tipo || "comida";
                  const cantidad = prod.cantidad || 1;
                  const precio = prod.precio || 0;
                  const total = precio * cantidad;

                  // Sumar a categoría principal
                  if (ventasPorCategoria[tipo] !== undefined) {
                    ventasPorCategoria[tipo] += total;
                  }

                  // Si es comida y tiene subcategoría, sumar a subcategoría
                  if (tipo === "comida" && productoInfo.subcategoria) {
                    const subcat = productoInfo.subcategoria;
                    ventasPorSubcategoria[subcat] =
                      (ventasPorSubcategoria[subcat] || 0) + total;
                  }
                }
              });
            }
          } catch (e) {
            console.error("Error parseando productos para cálculo:", e);
          }
        }
      });

      // Tabla de subcategorías de COMIDA
      const subcategorias = Object.keys(ventasPorSubcategoria).sort();
      if (subcategorias.length > 0) {
        html += `<h3 style="margin-top:16px;color:#111;">Comidas por Subcategoría</h3>`;
        html += `<table><thead><tr><th>Subcategoría</th><th>Total Ventas</th></tr></thead><tbody>`;
        subcategorias.forEach((subcat) => {
          const total = ventasPorSubcategoria[subcat];
          const totalFmt = total.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          });
          html += `<tr><td>${subcat}</td><td>L ${totalFmt}</td></tr>`;
        });
        html += `</tbody></table>`;
      }

      // Tabla de categorías principales
      html += `<h3 style="margin-top:16px;color:#111;">Total por Categoría</h3>`;
      html += `<table><thead><tr><th>Categoría</th><th>Total Ventas</th></tr></thead><tbody>`;
      const categorias = [
        { key: "comida", label: "🍗 Comidas" },
        { key: "complemento", label: "🍟 Complementos" },
        { key: "bebida", label: "🥤 Bebidas" },
      ];
      categorias.forEach(({ key, label }) => {
        const total = ventasPorCategoria[key] || 0;
        if (total > 0) {
          const totalFmt = total.toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          });
          html += `<tr><td>${label}</td><td>L ${totalFmt}</td></tr>`;
        }
      });
      const totalCategorias = Object.values(ventasPorCategoria).reduce(
        (sum, val) => sum + val,
        0
      );
      const totalCategoriasFmt = totalCategorias.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
      });
      html += `<tr><th style="text-align:right">Total General</th><th>L ${totalCategoriasFmt}</th></tr>`;
      html += `</tbody></table></div>`;

      html += `<div class="section"><h2>Historial de cierres</h2>`;
      if (cierresData.length === 0) {
        html += `<p>No hay cierres en el rango seleccionado.</p>`;
      } else {
        html += `<table style="font-size:11px;"><thead><tr>`;
        html += `<th>Fecha</th>`;
        html += `<th>Cajero</th>`;
        html += `<th>Caja</th>`;
        html += `<th>Efectivo Reg.</th>`;
        html += `<th>Efectivo Día</th>`;
        html += `<th>Tarjeta Reg.</th>`;
        html += `<th>Tarjeta Día</th>`;
        html += `<th>Transf. Reg.</th>`;
        html += `<th>Transf. Día</th>`;
        html += `<th>Dólares Reg.</th>`;
        html += `<th>Dólares Día</th>`;
        html += `<th>Diferencia</th>`;
        html += `<th>Observación</th>`;
        html += `<th>Referencia</th>`;
        html += `</tr></thead><tbody>`;
        cierresData.forEach((c: any) => {
          const fecha = c.fecha ? c.fecha.slice(0, 19).replace("T", " ") : "";
          const diferencia = parseFloat(c.diferencia || 0);
          const difColor =
            diferencia > 0 ? "#388e3c" : diferencia < 0 ? "#d32f2f" : "#111";
          html += `<tr>`;
          html += `<td>${fecha}</td>`;
          html += `<td>${c.cajero || ""}</td>`;
          html += `<td>${c.caja || ""}</td>`;
          html += `<td>L ${parseFloat(c.efectivo_registrado || 0).toFixed(
            2
          )}</td>`;
          html += `<td>L ${parseFloat(c.efectivo_dia || 0).toFixed(2)}</td>`;
          html += `<td>L ${parseFloat(c.monto_tarjeta_registrado || 0).toFixed(
            2
          )}</td>`;
          html += `<td>L ${parseFloat(c.monto_tarjeta_dia || 0).toFixed(
            2
          )}</td>`;
          html += `<td>L ${parseFloat(
            c.transferencias_registradas || 0
          ).toFixed(2)}</td>`;
          html += `<td>L ${parseFloat(c.transferencias_dia || 0).toFixed(
            2
          )}</td>`;
          html += `<td>$ ${parseFloat(c.dolares_registrado || 0).toFixed(
            2
          )}</td>`;
          html += `<td>$ ${parseFloat(c.dolares_dia || 0).toFixed(2)}</td>`;
          html += `<td style="color:${difColor};font-weight:700;">L ${diferencia.toFixed(
            2
          )}</td>`;
          html += `<td>${c.observacion || ""}</td>`;
          html += `<td>${c.referencia_aclaracion || ""}</td>`;
          html += `</tr>`;
        });
        html += `</tbody></table>`;
      }
      html += `</div>`;

      // Tabla de ventas (facturas)
      html += `<div class="section"><h2>Tabla de Ventas Realizadas</h2>`;
      if (factData.length === 0)
        html += `<p>No hay ventas en el rango seleccionado.</p>`;
      else {
        html += `<table><thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Cajero</th><th>Total</th></tr></thead><tbody>`;
        factData.forEach((f: any) => {
          const fecha = f.fecha_hora
            ? f.fecha_hora.replace("T", " ").slice(0, 19)
            : "";
          const totalFmt = Number(f.total || 0).toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          });
          html += `<tr><td>${fecha}</td><td>${f.factura || ""}</td><td>${
            f.cliente || ""
          }</td><td>${f.cajero || ""}</td><td>L ${totalFmt}</td></tr>`;
        });
        // Fila de total de ventas
        const totalVentasFmt = Number(totalVentas || 0).toLocaleString(
          "de-DE",
          { minimumFractionDigits: 2 }
        );
        html += `<tr><th colspan="4" style="text-align:right">Total Ventas</th><th>L ${totalVentasFmt}</th></tr>`;
        html += `</tbody></table>`;
      }
      html += `</div>`;

      // Tabla de Gastos: incluir detalle de los gastos en el rango seleccionado
      html += `<div class="section"><h2>Tabla de Gastos</h2>`;
      if (gastData.length === 0)
        html += `<p>No hay gastos en el rango seleccionado.</p>`;
      else {
        html += `<table><thead><tr><th>Fecha</th><th>Monto</th><th>Motivo</th></tr></thead><tbody>`;
        gastData.forEach((g: any) => {
          const fecha = g.fecha
            ? g.fecha.replace
              ? g.fecha.replace("T", " ").slice(0, 19)
              : g.fecha
            : "";
          const monto = Number(g.monto || 0).toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          });
          const motivo = g.motivo || "";
          html += `<tr><td>${fecha}</td><td>L ${monto}</td><td>${motivo}</td></tr>`;
        });
        html += `</tbody></table>`;
      }

      // Tabla de pagos
      html += `<div class="section"><h2>Tabla de Pagos (Detalle)</h2>`;
      if (pagosData.length === 0)
        html += `<p>No hay pagos en el rango seleccionado.</p>`;
      else {
        // Mostrar todos los pagos con detalles
        html += `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Factura</th><th>Banco</th><th>Tarjeta</th><th>Ref.</th><th>Monto</th></tr></thead><tbody>`;
        pagosData.forEach((p: any) => {
          const fecha = p.fecha_hora
            ? p.fecha_hora.replace
              ? p.fecha_hora.replace("T", " ").slice(0, 19)
              : p.fecha_hora
            : "";
          const tipo = p.tipo || "";
          const factura = p.factura_venta || p.factura || "";
          const banco = p.banco || "-";
          const tarjeta = p.tarjeta ? `****${p.tarjeta}` : "-";
          const referencia = p.referencia || "-";
          let montoDisplay = "";
          if (tipo === "dolares" && p.usd_monto) {
            const usd = Number(p.usd_monto || 0).toFixed(2);
            const lps = Number(p.monto || 0).toFixed(2);
            montoDisplay = `<b>$ ${usd}</b> <span style="color:#666;font-size:11px;">(L ${lps})</span>`;
          } else {
            montoDisplay = `L ${Number(p.monto || 0).toFixed(2)}`;
          }
          html += `<tr><td>${fecha}</td><td>${tipo}</td><td>${factura}</td><td style="font-size:11px;">${banco}</td><td>${tarjeta}</td><td style="font-size:11px;">${referencia}</td><td>${montoDisplay}</td></tr>`;
        });
        // Fila de totales al final de la tabla de pagos
        html += `<tr><th colspan="6" style="text-align:right">Total Pagos</th><th>L ${totalPagosRaw.toFixed(
          2
        )}</th></tr>`;
        html += `</tbody></table>`;
      }
      html += `</div>`;

      // Reemplazar contenido de la ventana ya abierta y lanzar print
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    } catch (error) {
      console.error("Error generando reporte:", error);
      try {
        win.document.body.innerHTML =
          "<p>Error al generar el reporte. Revisa la consola para más detalles.</p>";
      } catch (e) {}
      alert(
        "Error al generar el reporte. Revisa la consola para más detalles."
      );
    }
  }

  function calcularMensual(facturas: any[], gastos: any[]) {
    const ventasPorMes: { [mes: string]: number } = {};
    facturas.forEach((f) => {
      const mes = f.fecha_hora?.slice(0, 7);
      ventasPorMes[mes] = (ventasPorMes[mes] || 0) + parseFloat(f.total || 0);
    });

    const gastosPorMes: { [mes: string]: number } = {};
    gastos.forEach((g) => {
      const mes = g.fecha?.slice(0, 7);
      gastosPorMes[mes] = (gastosPorMes[mes] || 0) + parseFloat(g.monto || 0);
    });

    const meses = Array.from(
      new Set([...Object.keys(ventasPorMes), ...Object.keys(gastosPorMes)])
    ).sort();
    const resumen = meses.map((mes) => ({
      mes,
      ventas: ventasPorMes[mes] || 0,
      gastos: gastosPorMes[mes] || 0,
      balance: (ventasPorMes[mes] || 0) - (gastosPorMes[mes] || 0),
    }));

    setVentasMensuales(resumen);
    const totalVentas = facturas.reduce(
      (sum, f) => sum + parseFloat(f.total || 0),
      0
    );
    const totalGastos = gastos.reduce(
      (sum, g) => sum + parseFloat(g.monto || 0),
      0
    );
    setBalance(totalVentas - totalGastos);
  }

  const mesesDisponibles = ventasMensuales.map((r) => r.mes);
  const facturasFiltradas = mesFiltro
    ? facturas.filter((f) => f.fecha_hora?.slice(0, 7) === mesFiltro)
    : facturas;
  const gastosFiltrados = mesFiltro
    ? gastos.filter((g) => g.fecha?.slice(0, 7) === mesFiltro)
    : gastos;

  const totalVentas = facturas.reduce(
    (sum, f) => sum + parseFloat(f.total || 0),
    0
  );
  const totalGastos = gastos.reduce(
    (sum, g) => sum + parseFloat(g.monto || 0),
    0
  );
  const facturasCount = facturas.length;
  const gastosCount = gastos.length;

  return (
    <div
      className="resultados-enterprise"
      style={{
        width: "100vw",
        height: "100vh",
        minHeight: "100vh",
        minWidth: "100vw",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <style>{`
        body, #root {
          width: 100vw !important;
          height: 100vh !important;
          min-width: 100vw !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: block !important;
          max-width: none !important;
          background: unset !important;
        }
        .resultados-enterprise {
          min-height: 100vh;
          min-width: 100vw;
          width: 100vw;
          height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden;
        }
        :root {
          --primary: #ffffff;
          --secondary: #f8fafc;
          --accent: #3b82f6;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --border: #e2e8f0;
          --shadow: 0 4px 20px rgba(0,0,0,0.06);
          --shadow-hover: 0 12px 32px rgba(0,0,0,0.12);
          --success: #10b981;
          --danger: #ef4444;
          --warning: #f59e0b;
          --info: #3b82f6;
        }

        .resultados-enterprise {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 0;
        }

        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding: 1.5rem 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: rgba(255,255,255,0.1);
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .main-content {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .filters {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255,255,255,0.1);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .filter-group label {
          color: var(--text-primary);
          font-weight: 600;
          font-size: 0.95rem;
        }

        .filter-input, .filter-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .btn-filter {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .kpi-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
          box-shadow: var(--shadow);
        }

        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
        }

        .kpi-value {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .kpi-success .kpi-value { color: var(--success); }
        .kpi-danger .kpi-value { color: var(--danger); }
        .kpi-info .kpi-value { color: var(--info); }

        .kpi-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        /* Mobile adjustments: stack columns and make tables scrollable */
        @media (max-width: 900px) {
          .content-grid { grid-template-columns: 1fr; }
          .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
          .table-card { padding: 1rem; }
          .filters { padding: 1rem; gap: 1rem; }
        }

        .table-responsive { overflow-x: auto; }

        .table-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }

        .table-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .table-title {
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }

        .btn-secondary {
          background: linear-gradient(135deg, var(--info), #42a5f5);
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          min-width: 600px; /* permite scroll en pantallas estrechas */
        }

        .table th, .table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .table th {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
          font-weight: 600;
        }

        .charts-container {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 2rem;
          box-shadow: var(--shadow);
        }

        .charts-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 2rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }

        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .filters { flex-direction: column; gap: 1rem; }
          .filter-group { justify-content: center; }
          .main-content { padding: 1rem; }
          .header { padding: 1rem; flex-direction: column; gap: 1rem; }
          /* tablas responsive: mostrar filas como tarjetas */
          .table {
            min-width: 0;
          }
          .table thead { display: none; }
          .table tbody tr {
            display: block;
            margin-bottom: 12px;
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 8px;
          }
          .table tbody td {
            display: flex;
            justify-content: space-between;
            padding: 6px 8px;
            border: none;
          }
          .table tbody td::before {
            content: attr(data-label) ": ";
            font-weight: 700;
            color: var(--text-secondary);
            margin-right: 8px;
            flex: 0 0 50%;
            text-align: left;
          }
        }
      `}</style>

      <header className="header">
        <div className="header-left">
          {onBack && (
            <button className="btn-back" onClick={onBack}>
              ← Volver
            </button>
          )}
          <h1 className="page-title">📊 Dashboard Financiero</h1>
        </div>
      </header>

      <main className="main-content">
        {/* Filtros */}
        <div className="filters">
          <div className="filter-group">
            <label>📅 Desde:</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>hasta:</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>📊 Mes:</label>
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {mesesDisponibles.map((mes) => (
                <option key={mes} value={mes}>
                  {mes}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>👤 Cajero:</label>
            <select
              value={cajeroFiltro}
              onChange={(e) => setCajeroFiltro(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              {cajeros.map((cajero) => (
                <option key={cajero.id} value={cajero.id}>
                  {cajero.nombre}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-filter" onClick={fetchDatos}>
            🔍 Filtrar
          </button>
          <button
            className="btn-filter"
            onClick={async () => {
              await generarReportePDF();
            }}
            title="Generar reporte listo para imprimir"
            style={{ marginLeft: 8 }}
          >
            📝 Reporte PDF
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-success">
            <div className="kpi-value">
              L{" "}
              {totalVentas.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">Total Ventas</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">
              L{" "}
              {totalGastos.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="kpi-label">Total Gastos</div>
          </div>
          <div className="kpi-card kpi-info">
            <div className="kpi-value">
              L {balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
            </div>
            <div className="kpi-label">
              {balance >= 0 ? "✅ Ganancia" : "❌ Pérdida"}
            </div>
          </div>
          <div className="kpi-card kpi-success">
            <div className="kpi-value">{facturasCount}</div>
            <div className="kpi-label">Facturas</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-value">{gastosCount}</div>
            <div className="kpi-label">Gastos</div>
          </div>
        </div>

        {/* Tablas */}
        <div className="content-grid">
          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">📋 Facturas Recientes</h3>
                {onVerFacturasEmitidas && (
                  <button
                    className="btn-secondary"
                    onClick={onVerFacturasEmitidas}
                  >
                    Ver todas
                  </button>
                )}
              </div>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cajero</th>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasFiltradas.slice(0, 10).map((f) => (
                        <tr key={f.id}>
                          <td data-label="Fecha">
                            {f.fecha_hora?.slice(0, 10)}
                          </td>
                          <td data-label="Cajero">{f.cajero}</td>
                          <td data-label="Factura">{f.factura}</td>
                          <td data-label="Cliente">{f.cliente}</td>
                          <td
                            data-label="Total"
                            style={{ color: "var(--success)" }}
                          >
                            L {parseFloat(f.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-card">
              <div className="table-header">
                <h3 className="table-title">💸 Gastos</h3>
              </div>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosFiltrados.slice(0, 10).map((g) => (
                        <tr key={g.id}>
                          <td data-label="Fecha">{g.fecha}</td>
                          <td
                            data-label="Monto"
                            style={{ color: "var(--danger)" }}
                          >
                            L {parseFloat(g.monto || 0).toFixed(2)}
                          </td>
                          <td data-label="Motivo">{g.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <div className="charts-container">
          <h3 className="charts-title">📈 Análisis Mensual</h3>
          <div className="charts-grid">
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={ventasMensuales}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={"var(--border)"}
                  />
                  <XAxis dataKey="mes" stroke={"var(--text-secondary)"} />
                  <YAxis stroke={"var(--text-secondary)"} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(26,26,46,0.95)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ventas" fill="url(#ventas)" name="Ventas" />
                  <Bar dataKey="gastos" fill="url(#gastos)" name="Gastos" />
                  <defs>
                    <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={"var(--success)"}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={"var(--success)"}
                        stopOpacity={0.2}
                      />
                    </linearGradient>
                    <linearGradient id="gastos" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={"var(--danger)"}
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor={"var(--danger)"}
                        stopOpacity={0.2}
                      />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={ventasMensuales}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={"var(--border)"}
                  />
                  <XAxis dataKey="mes" stroke={"var(--text-secondary)"} />
                  <YAxis stroke={"var(--text-secondary)"} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(26,26,46,0.95)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke={balance >= 0 ? "var(--success)" : "var(--danger)"}
                    strokeWidth={3}
                    name="Balance Mensual"
                    dot={{
                      fill: balance >= 0 ? "var(--success)" : "var(--danger)",
                      r: 4,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Gráfica de ventas por día */}
          <h3 className="charts-title" style={{ marginTop: 32 }}>
            🗓️ Ventas por Día
          </h3>
          <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={ventasPorDia}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={"var(--border)"} />
                <XAxis dataKey="fecha" stroke={"var(--text-secondary)"} />
                <YAxis stroke={"var(--text-secondary)"} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(26,26,46,0.95)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <Bar dataKey="total" fill="var(--success)" name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
