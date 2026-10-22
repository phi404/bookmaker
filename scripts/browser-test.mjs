import { spawn } from 'node:child_process';
import { absolute, readJson } from './lib.mjs';

const appURL = new URL((await readJson('harness/config.json')).appUrl);
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: absolute('.cache/browsers'), COMPHOLIO_PORT: appURL.port, COMPHOLIO_HOST: appURL.hostname };
const args = process.argv.slice(2);
let server;
try {
  if (!args.includes('--list')) {
    server = spawn(process.execPath, [absolute('scripts/dev.mjs')], { cwd: absolute(''), stdio: ['ignore', 'inherit', 'inherit', 'ipc'], env });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 20000);
      server.once('error', error => { clearTimeout(timer); reject(error); });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Test server exited before ready: ${code}`)); });
      server.once('message', message => { if (message?.type === 'ready') { clearTimeout(timer); resolve(); } });
    });
  }
  const cli = spawn(process.execPath, [absolute('node_modules/@playwright/test/cli.js'), 'test', ...args], { cwd: absolute(''), stdio: 'inherit', env });
  process.exitCode = await new Promise((resolve, reject) => { cli.once('error', reject); cli.once('exit', code => resolve(code ?? 1)); });
} finally {
  if (server?.connected) {
    await new Promise(resolve => { server.once('exit', resolve); server.send({ type: 'shutdown' }); });
  }
}
