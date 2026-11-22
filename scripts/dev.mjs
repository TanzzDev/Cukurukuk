// Jalankan server API (3000) dan Vite (5173) bersamaan untuk pengembangan lokal.
import { spawn } from 'node:child_process';

const run = (cmd, args, name) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const tag = (d) => String(d).split('\n').filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', tag);
  p.stderr.on('data', tag);
  p.on('exit', (code) => { console.log(`[${name}] berhenti (${code})`); process.exit(code ?? 0); });
  return p;
};
const children = [run('node', ['server.cjs'], 'api'), run('npx', ['vite'], 'web')];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
