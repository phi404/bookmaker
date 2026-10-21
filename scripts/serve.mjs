import { pathToFileURL } from 'node:url';
import { absolute } from './lib.mjs';
import { createStaticServer, normalizeBasePath } from './static-server.mjs';

export async function serveBuiltApp() {
  const port = Number(process.env.BOOKMAKER_PORT ?? 5174), host = process.env.BOOKMAKER_HOST ?? '127.0.0.1';
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid server port');
  const basePath = normalizeBasePath(process.env.BOOKMAKER_BASE_PATH ?? '/');
  const server = await createStaticServer(absolute('dist'), { basePath });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  function shutdown() { server.closeAllConnections(); server.close(() => { if (process.connected) process.disconnect(); }); }
  if (process.send) {
    process.on('message', message => { if (message?.type === 'shutdown') shutdown(); });
    process.on('disconnect', () => { if (server.listening) shutdown(); });
  }
  server.listen(port, host, () => {
    const actualPort = server.address().port;
    console.log(`Folaxis: http://${host}:${actualPort}${basePath}`);
    process.send?.({ type: 'ready', port: actualPort });
  });
  return server;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await serveBuiltApp();
