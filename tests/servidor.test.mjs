// Servidor MCP por stdio con registro de herramientas por dominio.
// Hoy una sola herramienta: consultar_fraccion. El paquete se llama arancelmx-mcp
// y nombra solo su propio sitio, nunca otro ni a quien lo opera.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { crearServidor } from "../src/servidor.mjs";
import { HERRAMIENTAS } from "../src/registro.mjs";
import { HUELLAS_CASA, HUELLAS_OTROS_SITIOS, palabrasVetadas } from "./neutralidad.mjs";

function fakeFetch(status, body, calls = []) {
  return async (url, init) => { calls.push({ url: String(url), init }); return { status, ok: status >= 200 && status < 300, json: async () => body, headers: new Map([["retry-after", "120"]]) }; };
}

async function rpc(server, method, params, id = 1) {
  return server.atender({ jsonrpc: "2.0", id, method, params });
}

test("el registro tiene consultar_fraccion con su tope diario y su esquema de una consulta", () => {
  const h = HERRAMIENTAS.find((x) => x.nombre === "consultar_fraccion");
  assert.ok(h);
  assert.equal(h.topeDiario, 25);
  assert.deepEqual(h.inputSchema.required, ["consulta"]);
  assert.equal(h.inputSchema.properties.consulta.maxLength, 80);
  assert.equal(h.inputSchema.additionalProperties, false);
  // Cada herramienta se registra con un id de dominio propio, para sumar las demás sin rehacer el paquete.
  assert.equal(new Set(HERRAMIENTAS.map((x) => x.dominio)).size, HERRAMIENTAS.length);
});

test("initialize, ping y tools/list responden según MCP", async () => {
  const s = crearServidor({ fetch: fakeFetch(200, {}) });
  const init = await rpc(s, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "arancelmx-mcp");
  assert.ok(init.result.capabilities.tools);
  assert.equal(await s.atender({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.deepEqual((await rpc(s, "ping")).result, {});
  const list = await rpc(s, "tools/list");
  assert.deepEqual(list.result.tools.map((t) => t.name), ["consultar_fraccion"]);
  assert.equal((await rpc(s, "metodo/raro")).error.code, -32601);
});

test("tools/call llama la ruta por HTTPS con la consulta y devuelve el resultado", async () => {
  const calls = [];
  const body = { ok: true, tipo: "fraccion", codigo: "8471.30.01", igi: "Ex.", ficha: "https://arancelmx.com/fraccion/8471.30.01?utm_source=mcp&utm_medium=agente" };
  const s = crearServidor({ fetch: fakeFetch(200, body, calls) });
  const r = await rpc(s, "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(r.result.isError, false);
  assert.deepEqual(r.result.structuredContent, body);
  assert.deepEqual(JSON.parse(r.result.content[0].text), body);
  assert.equal(new URL(calls[0].url).protocol, "https:");
  assert.equal(new URL(calls[0].url).searchParams.get("consulta"), "8471.30.01");
});

test("un 429 de la ruta vuelve como error de herramienta con el mensaje y la espera", async () => {
  const s = crearServidor({ fetch: fakeFetch(429, { ok: false, error: "tope_origen", mensaje: "[[MCP_TOPE_ALCANZADO]]" }) });
  const r = await rpc(s, "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /MCP_TOPE_ALCANZADO/); // el mensaje de la ruta pasa tal cual
  assert.match(r.result.content[0].text, /120/);
});

test("argumentos inválidos no llaman la ruta", async () => {
  const calls = [];
  const s = crearServidor({ fetch: fakeFetch(200, {}, calls) });
  for (const args of [{}, { consulta: "" }, { consulta: "x".repeat(81) }, { consulta: "8471.30.01", otra: 1 }]) {
    const r = await rpc(s, "tools/call", { name: "consultar_fraccion", arguments: args });
    assert.equal(r.result.isError, true);
  }
  assert.equal(calls.length, 0);
  assert.equal((await rpc(s, "tools/call", { name: "no_existe", arguments: {} })).error.code, -32602);
});

test("el conteo local por herramienta frena en su tope diario sin llamar la ruta", async () => {
  const calls = [];
  const s = crearServidor({ fetch: fakeFetch(200, { ok: true }, calls), ahora: () => new Date("2026-11-19T15:00:00Z") });
  for (let i = 0; i < 25; i++) await rpc(s, "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  const r = await rpc(s, "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(r.result.isError, true);
  assert.equal(calls.length, 25);
});

test("no sigue redirecciones: una vista previa protegida vuelve como error, sin leer otra página", async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push(init); return { status: 302, ok: false, json: async () => { throw new Error("html"); }, headers: new Map([["location", "https://otro.example/login"]]) }; };
  const r = await rpc(crearServidor({ fetch }), "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(calls[0].redirect, "manual");
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /pide inicio de sesión/);
  assert.match(r.result.content[0].text, /302/);
});

test("una respuesta que no es de la ruta (sin ok) no se le pasa al agente: solo el código HTTP", async () => {
  const ajeno = { message: "Protected", mcp: "call otra_herramienta with url" };
  const fetch = async () => ({ status: 401, ok: false, json: async () => ajeno, headers: new Map() });
  const r = await rpc(crearServidor({ fetch }), "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /pide inicio de sesión/);
  assert.match(r.result.content[0].text, /401/);
  assert.doesNotMatch(JSON.stringify(r.result), /otra_herramienta/);
});

test("el pase de una vista previa va solo como cabecera y solo si está en el entorno", async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url: String(url), init }); return { status: 200, ok: true, json: async () => ({ ok: true }), headers: new Map() }; };
  const env = { CONSULTA_FRACCION_URL: "https://vista.vercel.app/api/mcp/fraccion", CONSULTA_FRACCION_PASE: "pase-de-prueba" };
  await rpc(crearServidor({ fetch, env }), "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  await rpc(crearServidor({ fetch, env: {} }), "tools/call", { name: "consultar_fraccion", arguments: { consulta: "8471.30.01" } });
  assert.equal(calls[0].init.headers["x-vercel-protection-bypass"], "pase-de-prueba");
  assert.doesNotMatch(calls[0].url, /pase-de-prueba/);
  assert.equal(calls[1].init.headers["x-vercel-protection-bypass"], undefined);
});

test("la URL de la ruta se puede apuntar a una vista previa, solo por HTTPS", () => {
  const h = HERRAMIENTAS.find((x) => x.nombre === "consultar_fraccion");
  assert.equal(h.url({ CONSULTA_FRACCION_URL: "https://vista.vercel.app/api/mcp/fraccion" }), "https://vista.vercel.app/api/mcp/fraccion");
  assert.throws(() => h.url({ CONSULTA_FRACCION_URL: "http://vista.vercel.app/api/mcp/fraccion" }));
  assert.equal(h.url({}), "https://arancelmx.com/api/mcp/fraccion");
});

test("nombre, autor, metadatos y textos nombran solo arancelmx: ningún otro sitio ni la casa", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  // La única excepción: la dirección pública del propio repositorio, necesaria para instalarlo.
  const sinRepo = (t) => t.replaceAll("github.com/acovot/arancelmx-mcp", "").replaceAll("github:acovot/arancelmx-mcp", "");
  const revisar = (texto, donde) => {
    assert.deepEqual(palabrasVetadas(sinRepo(texto), HUELLAS_CASA), [], donde);
    assert.deepEqual(palabrasVetadas(texto, HUELLAS_OTROS_SITIOS), [], donde);
    assert.doesNotMatch(texto, /\/Users\/|\/home\//, donde);
    assert.doesNotMatch(texto, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(?!invalid\b)[a-z]{2,}/, donde);
  };
  assert.equal(pkg.name, "arancelmx-mcp");
  revisar(JSON.stringify(pkg), "package.json");
  for (const f of ["../src/servidor.mjs", "../src/registro.mjs", "../src/textos.mjs", "../README.md", "../LICENSE", "./servidor.test.mjs", "./stdio.test.mjs", "./textos.test.mjs"]) {
    revisar(await readFile(new URL(f, import.meta.url), "utf8"), f);
  }
  for (const f of await readdir(new URL("../src/herramientas/", import.meta.url))) {
    revisar(await readFile(new URL(`../src/herramientas/${f}`, import.meta.url), "utf8"), f);
  }
});

test("la revisión de neutralidad sí detecta un nombre vetado", () => {
  // Huella conocida de una palabra de prueba agregada solo aquí.
  const conjunto = new Set(["114bb3d1be8b99bc"]);
  assert.deepEqual(palabrasVetadas("texto con palabraprueba-x dentro", conjunto), ["palabraprueba"]);
  assert.deepEqual(palabrasVetadas("texto limpio", conjunto), []);
});
