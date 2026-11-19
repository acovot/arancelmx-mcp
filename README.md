# arancelmx-mcp

Consulta una fracción de la TIGIE (IGI, IVA, IEPS, regulaciones y NICO) desde tu asistente, con la fecha de la base oficial.

Servidor MCP por stdio con una herramienta, `consultar_fraccion`. Cada respuesta trae la fecha de la base
(`datos_al`) y el enlace a la ficha de la fracción en [arancelmx.com](https://arancelmx.com).

## Herramienta

**`consultar_fraccion`**: consulta una fracción arancelaria de México (TIGIE/LIGIE): IGI, IVA, IEPS, regulaciones, NICO
y cambio 2026 documentado, con la fecha de la base y el enlace a su ficha. Una fracción por llamada. No clasifica ni
calcula impuestos a pagar.

- Entrada: `consulta`, una fracción de 8 dígitos (con o sin puntos), un NICO de 10 o una descripción corta (hasta 80
  caracteres).
- Salida: JSON con `codigo`, `descripcion`, `igi`, `iva`, `ieps`, `regulaciones`, `nicos`, `cambio2026`, `datos_al`
  y `ficha`. Si la consulta es una descripción, devuelve fracciones candidatas con la descripción de su partida.

Es una consulta orientativa: no es una clasificación arancelaria ni una liquidación. Confirma la fracción con tu agente
aduanal.

## Límites

25 consultas al día por origen, sin costo. El servidor también lleva su propio conteo de 25 por día. Al llegar al
límite, la herramienta responde con un error que dice cuándo volver a intentar.

## Instalación

Requiere Node.js 20 o más reciente.

Claude Desktop, Cursor y otros clientes que leen `mcpServers`:

```json
{
  "mcpServers": {
    "arancelmx": {
      "command": "npx",
      "args": ["-y", "github:acovot/arancelmx-mcp"]
    }
  }
}
```

Claude Code:

```sh
claude mcp add arancelmx -- npx -y github:acovot/arancelmx-mcp
```

Desde el código:

```sh
git clone https://github.com/acovot/arancelmx-mcp.git
cd arancelmx-mcp
npm test
npm start
```

## Configuración opcional

- `CONSULTA_FRACCION_URL`: otra dirección para la consulta (solo `https`). Por defecto,
  `https://arancelmx.com/api/mcp/fraccion`.
- `CONSULTA_FRACCION_PASE`: viaja como cabecera `x-vercel-protection-bypass` para una vista previa protegida; nunca en
  la URL. El servidor no sigue redirecciones.

## Licencia

MIT. Ver [LICENSE](LICENSE).
