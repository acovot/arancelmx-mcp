#!/usr/bin/env node
// Servidor MCP por stdio (JSON-RPC 2.0, un mensaje por línea).
// Lleva un conteo local por herramienta y día (UTC-6) además del tope de la ruta.
import { realpathSync } from "node:fs";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { HERRAMIENTAS, buscarHerramienta } from "./registro.mjs";
import { TEXTOS } from "./textos.mjs";

const VERSIONES = ["2025-06-18", "2025-03-26", "2024-11-05"];
const INFO = { name: "arancelmx-mcp", version: "0.1.0" };
const AGENTE = `${INFO.name}/${INFO.version}`;

function dia(fecha) {
  return new Date(fecha.getTime() - 6 * 3600_000).toISOString().slice(0, 10);
}

function textoError(texto, extra) {
  return { content: [{ type: "text", text: texto }], isError: true, ...(extra ? { structuredContent: extra } : {}) };
}

export function crearServidor({ fetch = globalThis.fetch, ahora = () => new Date(), env = process.env, herramientas = HERRAMIENTAS } = {}) {
  const conteo = new Map();

  async function llamar(h, args) {
    const valido = h.validar(args);
    if (!valido) return textoError(TEXTOS.ARGUMENTOS_INVALIDOS);
    const clave = `${h.nombre}:${dia(ahora())}`;
    const usadas = conteo.get(clave) ?? 0;
    if (usadas >= h.topeDiario) return textoError(TEXTOS.TOPE_LOCAL);
    conteo.set(clave, usadas + 1);
    let res;
    try {
      const headers = { Accept: "application/json", "User-Agent": AGENTE };
      // Pase opcional de una vista previa protegida: solo como cabecera, nunca en la URL.
      if (env.CONSULTA_FRACCION_PASE) headers["x-vercel-protection-bypass"] = env.CONSULTA_FRACCION_PASE;
      res = await fetch(h.peticion(h.url(env), valido), { headers, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    } catch {
      return textoError(TEXTOS.NO_DISPONIBLE);
    }
    if (res.status >= 300 && res.status < 400) return textoError(`${TEXTOS.PROTEGIDA} (HTTP ${res.status})`);
    const body = await res.json().catch(() => null);
    if (res.status === 429) {
      const espera = res.headers?.get?.("retry-after") ?? "";
      return textoError(`${typeof body?.mensaje === "string" && body.ok === false ? body.mensaje : TEXTOS.NO_DISPONIBLE} (retry-after: ${espera} s)`, body ?? undefined);
    }
    // Solo se le pasa al agente lo que tiene la forma de la ruta; lo demás (una página de
    // acceso, un proxy) vuelve como código HTTP, sin su texto.
    if (!body || typeof body !== "object" || typeof body.ok !== "boolean") {
      return textoError(res.status === 401 || res.status === 403 ? `${TEXTOS.PROTEGIDA} (HTTP ${res.status})` : `${TEXTOS.NO_DISPONIBLE} (HTTP ${res.status})`);
    }
    return { content: [{ type: "text", text: JSON.stringify(body) }], structuredContent: body, isError: !res.ok };
  }

  async function atender(msg) {
    const id = msg?.id;
    const esNotificacion = id === undefined || id === null;
    const ok = (result) => (esNotificacion ? null : { jsonrpc: "2.0", id, result });
    const err = (code, message) => (esNotificacion ? null : { jsonrpc: "2.0", id, error: { code, message } });
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(-32600, "Invalid Request");
    switch (msg.method) {
      case "initialize": {
        const pedida = msg.params?.protocolVersion;
        return ok({
          protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: INFO,
        });
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: herramientas.map((h) => ({ name: h.nombre, description: h.descripcion, inputSchema: h.inputSchema })) });
      case "tools/call": {
        const h = herramientas.includes(buscarHerramienta(msg.params?.name)) ? buscarHerramienta(msg.params.name) : null;
        if (!h) return err(-32602, "Unknown tool");
        return ok(await llamar(h, msg.params?.arguments));
      }
      default:
        return err(-32601, "Method not found");
    }
  }

  return { atender };
}

export function correrStdio(servidor = crearServidor(), entrada = process.stdin, salida = process.stdout) {
  const rl = createInterface({ input: entrada, crlfDelay: Infinity });
  rl.on("line", async (linea) => {
    if (!linea.trim()) return;
    let msg;
    try { msg = JSON.parse(linea); } catch {
      salida.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n");
      return;
    }
    const r = await servidor.atender(msg);
    if (r) salida.write(JSON.stringify(r) + "\n");
  });
  return rl;
}

// npm y npx lo arrancan por un enlace simbólico (node_modules/.bin): se compara la ruta real.
function esPrincipal() {
  try { return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; }
}
if (esPrincipal()) correrStdio();
