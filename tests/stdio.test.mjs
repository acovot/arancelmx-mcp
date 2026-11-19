// De punta a punta: el proceso real por stdio contesta initialize y tools/list.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("el proceso por stdio contesta initialize, tools/list y un JSON roto", async () => {
  const p = spawn(process.execPath, [new URL("../src/servidor.mjs", import.meta.url).pathname], { stdio: ["pipe", "pipe", "inherit"] });
  const lineas = [];
  let buf = "";
  const listo = new Promise((resolve) => p.stdout.on("data", (d) => {
    buf += d; const partes = buf.split("\n"); buf = partes.pop(); lineas.push(...partes.filter(Boolean));
    if (lineas.length >= 3) resolve();
  }));
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  p.stdin.write("{roto\n");
  await listo; p.kill();
  const r = lineas.map((l) => JSON.parse(l));
  assert.equal(r.find((x) => x.id === 1).result.serverInfo.name, "arancelmx-mcp");
  assert.equal(r.find((x) => x.id === 2).result.tools[0].name, "consultar_fraccion");
  assert.equal(r.find((x) => x.error)?.error.code, -32700);
});

test("arranca también por un enlace simbólico, como lo instala npm o npx en node_modules/.bin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-bin-"));
  const enlace = join(dir, "arancelmx-mcp");
  await symlink(new URL("../src/servidor.mjs", import.meta.url).pathname, enlace);
  const p = spawn(process.execPath, [enlace], { stdio: ["pipe", "pipe", "inherit"] });
  try {
    const linea = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("el servidor no contestó por el enlace")), 3000);
      p.stdout.on("data", (d) => { clearTimeout(t); resolve(String(d).split("\n")[0]); });
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) + "\n");
    });
    assert.deepEqual(JSON.parse(linea), { jsonrpc: "2.0", id: 1, result: {} });
  } finally { p.kill(); await rm(dir, { recursive: true, force: true }); }
});
