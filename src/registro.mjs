// Registro de herramientas: una entrada por herramienta, cada una con su dominio,
// su tope diario y su esquema. Para sumar otra, se agrega su módulo aquí.
import { consultarFraccion } from "./herramientas/consultar_fraccion.mjs";

export const HERRAMIENTAS = [consultarFraccion];

export function buscarHerramienta(nombre) {
  return HERRAMIENTAS.find((h) => h.nombre === nombre) ?? null;
}
