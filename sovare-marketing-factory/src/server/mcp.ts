/**
 * Servidor MCP (Streamable HTTP, sin estado) en `/mcp`.
 *
 * Es lo que Cowork, claude.ai, Claude Desktop o Claude Code agregan como
 * conector personalizado. Cada operación de `ops.ts` es una herramienta; el
 * actor es siempre `agent`. Se crea un servidor por pedido: no hay sesión que
 * se pierda si el proceso se reinicia.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { OPS } from '../ops.ts';
import { redact } from '../core/audit.ts';

const MAX = 60_000;

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'sovare-marketing-factory', version: '0.1.0' },
    {
      instructions:
        'Sovare Marketing Factory. Empezá con `status`. Todo lo que gasta o publica pasa por una política de tres niveles: podés operar dentro de lo autorizado y pedir autorizaciones (approval_request), nunca aprobarlas. En modo de prueba nada sale a Meta: decilo así. No declares una campaña publicada si `campaign_get` no muestra effective_status ACTIVE leído de Meta. Ante cualquier problema serio, `pause_all`.',
    }
  );
  for (const o of OPS) {
    server.registerTool(
      `smf_${o.name}`,
      {
        title: o.title,
        description: o.description,
        inputSchema: o.input,
        annotations: { readOnlyHint: !!o.readOnly, destructiveHint: o.name === 'pause_all', openWorldHint: !o.readOnly },
      },
      async (args: Record<string, unknown>) => {
        try {
          const r = await o.run(args as never, 'agent');
          let text = JSON.stringify(redact(r), null, 1);
          if (text.length > MAX) text = `${text.slice(0, MAX)}\n…(recortado: ${text.length} caracteres; pedí menos con filtros)`;
          return { content: [{ type: 'text' as const, text }] };
        } catch (e) {
          const err = e as { message?: string; code?: string; details?: unknown };
          return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message ?? String(e), code: err.code, details: err.details }, null, 1) }] };
        }
      }
    );
  }
  return server;
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse, body: unknown): Promise<void> {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
