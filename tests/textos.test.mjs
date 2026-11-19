// Textos fijos del servidor y de la herramienta, y nombre, autor, descripción y licencia del paquete.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TEXTOS } from "../src/textos.mjs";
import { HERRAMIENTAS } from "../src/registro.mjs";

test("los textos del servidor son los aprobados", () => {
  assert.deepEqual(TEXTOS, {
    ARGUMENTOS_INVALIDOS: "Falta la consulta o trae más de 80 caracteres. Envía solo `consulta`.",
    TOPE_LOCAL: "Esta instalación ya usó sus 25 consultas de hoy. Vuelve mañana.",
    NO_DISPONIBLE: "El servicio no respondió. Intenta más tarde.",
    PROTEGIDA: "La dirección configurada pide inicio de sesión. Revisa `CONSULTA_FRACCION_URL`.",
  });
});

test("la herramienta se describe con los textos aprobados", () => {
  const h = HERRAMIENTAS.find((x) => x.nombre === "consultar_fraccion");
  assert.equal(h.descripcion, "Consulta una fracción arancelaria de México (TIGIE/LIGIE): IGI, IVA, IEPS, regulaciones, NICO y cambio 2026 documentado, con la fecha de la base y el enlace a su ficha. Una fracción por llamada. No clasifica ni calcula impuestos a pagar.");
  assert.equal(h.inputSchema.properties.consulta.description, "Fracción de 8 dígitos (con o sin puntos), NICO de 10, o descripción corta.");
});

test("no queda ningún marcador [[…]] en el código; el paquete lleva el nombre, autor y licencia aprobados", async () => {
  for (const f of ["../src/servidor.mjs", "../src/registro.mjs", "../src/textos.mjs", "../src/herramientas/consultar_fraccion.mjs"]) {
    assert.doesNotMatch(await readFile(new URL(f, import.meta.url), "utf8"), /\[\[|MARCADOR/, f);
  }
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "arancelmx-mcp");
  assert.equal(pkg.author, "ArancelMX");
  assert.equal(pkg.description, "Consulta una fracción de la TIGIE (IGI, IVA, IEPS, regulaciones y NICO) desde tu asistente, con la fecha de la base oficial.");
  assert.equal(pkg.license, "MIT");
  assert.notEqual(pkg.private, true);
  assert.deepEqual(Object.keys(pkg.bin), ["arancelmx-mcp"]);
  const licencia = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
  assert.match(licencia, /^MIT License\n\nCopyright \(c\) 2026 ArancelMX\n/);
  assert.match(licencia, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
