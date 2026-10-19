import { execFileSync } from 'node:child_process';
import { absolute } from './lib.mjs';
import { serveBuiltApp } from './serve.mjs';

execFileSync(process.execPath, [absolute('scripts/build.mjs')], { cwd: absolute(''), stdio: 'inherit' });
await serveBuiltApp();
