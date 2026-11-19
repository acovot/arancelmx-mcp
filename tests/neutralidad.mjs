// Huellas (sha256, 16 hex) de palabras que el paquete público no debe contener: nombres de la casa y de
// otros sitios. Se guardan como huellas para que la prueba no publique los nombres que protege.
// Se regeneran con: node -e 'const c=require("crypto");for(const w of process.argv.slice(1))console.log(c.createHash("sha256").update(w).digest("hex").slice(0,16))' <palabra>
import { createHash } from "node:crypto";

export const HUELLAS_CASA = new Set([
  "23c5bb276c87edba",
  "e8a20d32d0e71cc5",
  "fd07b0411ba7b739",
  "070b84ad169175bc",
  "1ba0c89612e3bfb1",
  "dbf274b4c73607ca",
  "720b56e4551c7139",
  "96bca1b4ef559a41",
  "35908bfa3103af74",
  "5d2b88ab02c46ded",
  "23af4ac5884c26e6",
  "014f0d694c880841",
  "ef4d59af4853a678"
]);
export const HUELLAS_OTROS_SITIOS = new Set([
  "c157ec0030c65ed6",
  "c9dce39f8ea6e3b9",
  "66af6a2d84fe967a",
  "92b17905690e6f1e",
  "bccd4f281f69e44d",
  "462932d8e817aa4b",
  "b275c2a269f2b8ba",
  "8bd2fdd4f405a61d",
  "1855a7f42d8ea8a4",
  "2f728ce2dd3767dd",
  "f552a4a05222dab6",
  "5a43b4ca38102c2a",
  "8ea8ae3c1a4cb399",
  "265fdb771e4dc18f",
  "d229c4e7a987850d",
  "5378e3342e26ebca",
  "19242fb888fb53fa",
  "ac3c0401127819c3"
]);

const huella = (w) => createHash("sha256").update(w).digest("hex").slice(0, 16);

/** Palabras del texto (minúsculas, letras, números y guion) cuya huella está en el conjunto. */
export function palabrasVetadas(texto, huellas) {
  const palabras = new Set(texto.toLowerCase().match(/[a-z0-9áéíóúñü-]+/g) ?? []);
  for (const p of [...palabras]) for (const parte of p.split("-")) palabras.add(parte);
  return [...palabras].filter((p) => huellas.has(huella(p)));
}
