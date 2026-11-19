// Herramienta de un solo dominio: consulta una fracción en la ruta pública del sitio.
// No clasifica ni liquida: devuelve lo que la ficha publica y el enlace a ella.
// Descripción fija de la herramienta.
export const consultarFraccion = {
  nombre: "consultar_fraccion",
  dominio: "arancelmx.com",
  topeDiario: 25,
  descripcion: "Consulta una fracción arancelaria de México (TIGIE/LIGIE): IGI, IVA, IEPS, regulaciones, NICO y cambio 2026 documentado, con la fecha de la base y el enlace a su ficha. Una fracción por llamada. No clasifica ni calcula impuestos a pagar.",
  inputSchema: {
    type: "object",
    properties: {
      consulta: { type: "string", minLength: 1, maxLength: 80, description: "Fracción de 8 dígitos (con o sin puntos), NICO de 10, o descripción corta." },
    },
    required: ["consulta"],
    additionalProperties: false,
  },
  url(env = process.env) {
    const u = new URL(env.CONSULTA_FRACCION_URL || "https://arancelmx.com/api/mcp/fraccion");
    if (u.protocol !== "https:") throw new Error("CONSULTA_FRACCION_URL debe ser https");
    return u.href;
  },
  validar(args) {
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    const keys = Object.keys(args);
    if (keys.length !== 1 || keys[0] !== "consulta" || typeof args.consulta !== "string") return null;
    const c = args.consulta.trim();
    return c.length >= 1 && c.length <= 80 ? { consulta: c } : null;
  },
  peticion(base, { consulta }) {
    const u = new URL(base);
    u.searchParams.set("consulta", consulta);
    return u.href;
  },
};
