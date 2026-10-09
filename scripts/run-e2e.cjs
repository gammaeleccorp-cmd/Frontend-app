const { spawn } = require('node:child_process');
const path = require('node:path');
const base = 'http://127.0.0.1:5178';
const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { stdio: 'inherit' });
async function run(file) {
  const child = spawn(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, E2E_BASE: base, E2E_SHOTS: path.resolve('test-results', path.basename(file)) } });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  if (code !== 0) throw new Error(`${file} exited ${code}`);
}
(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server failed');
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Preview did not become ready');
  await run('tests/mobile-flow.cjs');
  await run('tests/device-dashboard.e2e.cjs');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());
