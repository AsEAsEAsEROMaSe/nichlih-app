// Запуск MCP-сервера «Нічліг».
//   node dist-mcp/main.js            stdio: для Claude Code, Claude Desktop та інших локальних клієнтів
//   node dist-mcp/main.js --http     HTTP (Streamable HTTP) на 127.0.0.1:8787/mcp
// Змінні: PORT, HOST, NICHLIH_DATA (папка з hotels.json і occupied.json).
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer, type IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { todayISO } from '../lib/format';
import { searchPlaces } from '../lib/geocode';
import type { HotelSources } from '../lib/hotelSource';
import { fetchRoutes } from '../lib/osrm';
import { fetchHotels, parseHotels } from '../lib/overpass';
import { parseZones } from '../lib/zones';
import { createCache, createServer, VERSION, type ServerDeps } from './server';

// Публічні сервери OSM просять назву клієнта; без неї Overpass відповідає 406.
const HEADERS = { 'User-Agent': `nichlih-mcp/${VERSION}` };

const dataDir = process.env.NICHLIH_DATA ?? fileURLToPath(new URL('../public/data/', import.meta.url));
const readJson = (name: string) => JSON.parse(readFileSync(`${dataDir.replace(/\/?$/, '/')}${name}`, 'utf8'));

const hotels = parseHotels(readJson('hotels.json'));
const zones = parseZones(readJson('occupied.json'));

const sources: HotelSources = {
  dataset: async () => hotels,
  zones: async () => zones,
  live: (lines, radiusM) => fetchHotels(lines, radiusM, HEADERS),
};

const deps: ServerDeps = {
  fetchRoutes,
  searchPlaces: (q) => searchPlaces(q, AbortSignal.timeout(15000), HEADERS),
  sources,
  today: () => todayISO(),
  cache: createCache(),
};

// stdout зайнятий протоколом, тому все службове в stderr.
const log = (...a: unknown[]) => console.error('[nichlih-mcp]', ...a);

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
}

if (process.argv.includes('--http')) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  createHttpServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, version: VERSION, hotels: hotels.length }));
      return;
    }
    if (path !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== 'POST') {
      // Режим без сесій: потоку з сервера (GET) і закриття сесії (DELETE) нема.
      res.writeHead(405, { allow: 'POST' }).end();
      return;
    }
    try {
      const body = await readBody(req);
      // Без стану: на кожен запит свій сервер і транспорт, як радить SDK для такого режиму.
      const server = createServer(deps);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      log('request failed:', e instanceof Error ? e.message : e);
      if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'bad request' }));
    }
  }).listen(port, host, () => log(`HTTP on http://${host}:${port}/mcp, hotels: ${hotels.length}, zones: ${zones.length}`));
} else {
  await createServer(deps).connect(new StdioServerTransport());
  log(`stdio ready, hotels: ${hotels.length}, zones: ${zones.length}`);
}
