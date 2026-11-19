// Lo que leen los directorios: manifest.json (paquete .mcpb) y server.json (registro oficial de MCP).
// Deben coincidir con package.json y con la herramienta registrada.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { HERRAMIENTAS } from "../src/registro.mjs";

const leer = async (f) => JSON.parse(await readFile(new URL(f, import.meta.url), "utf8"));

test("manifest.json del paquete .mcpb coincide con package.json y arranca el servidor por node", async () => {
  const pkg = await leer("../package.json"), m = await leer("../manifest.json");
  assert.equal(m.manifest_version, "0.3");
  assert.equal(m.name, pkg.name); assert.equal(m.version, pkg.version); assert.equal(m.description, pkg.description);
  assert.equal(m.author.name, "ArancelMX"); assert.equal(m.license, "MIT");
  assert.equal(m.server.type, "node"); assert.equal(m.server.entry_point, "src/servidor.mjs");
  assert.deepEqual(m.server.mcp_config, { command: "node", args: ["${__dirname}/src/servidor.mjs"] });
  assert.deepEqual(m.tools, HERRAMIENTAS.map((h) => ({ name: h.nombre, description: h.descripcion })));
  assert.equal(m.compatibility.runtimes.node, pkg.engines.node);
});

test("server.json del registro oficial nombra el repo, la versión y el paquete .mcpb de la release", async () => {
  const pkg = await leer("../package.json"), s = await leer("../server.json");
  assert.equal(s.name, "io.github.acovot/arancelmx-mcp");
  // El registro admite hasta 100 caracteres: va la descripción aprobada hasta su primera parte, sin palabras nuevas.
  assert.equal(s.description, "Consulta una fracción de la TIGIE (IGI, IVA, IEPS, regulaciones y NICO) desde tu asistente.");
  assert.ok(s.description.length <= 100);
  assert.ok(pkg.description.startsWith(s.description.slice(0, -1) + ","));
  assert.equal(s.version, pkg.version);
  assert.deepEqual(s.repository, { url: "https://github.com/acovot/arancelmx-mcp", source: "github" });
  assert.equal(s.packages.length, 1);
  const p = s.packages[0];
  assert.equal(p.registryType, "mcpb");
  assert.equal(p.identifier, `https://github.com/acovot/arancelmx-mcp/releases/download/v${pkg.version}/arancelmx-mcp-${pkg.version}.mcpb`);
  assert.match(p.fileSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(p.transport, { type: "stdio" });
});
