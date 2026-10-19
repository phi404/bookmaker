import { cp, lstat, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { absolute, root } from './lib.mjs';
import { contentSecurityPolicy } from './static-server.mjs';

const target = absolute('dist');
// Verify the resolved target before recursive removal; refuse symlinked build roots.
if (path.relative(root, target) !== 'dist') throw new Error('Unsafe build directory');
const existing = await lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
if (existing?.isSymbolicLink()) throw new Error('Refusing a symlinked build directory');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
execFileSync(process.execPath, [absolute('node_modules/typescript/bin/tsc'), '-p', absolute('tsconfig.build.json')], { cwd: root, stdio: 'inherit' });
await cp(absolute('public'), target, { recursive: true });
const indexPath = path.join(target, 'index.html');
await writeFile(indexPath, (await readFile(indexPath, 'utf8')).replace('{{CONTENT_SECURITY_POLICY}}', contentSecurityPolicy));
await writeFile(path.join(target, '.nojekyll'), '');
console.log('Static application built: dist/');
