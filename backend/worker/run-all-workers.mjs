import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { ensureEnvLoaded, loadRuntimeConfig } from './runtime-client.mjs';

ensureEnvLoaded();

let config;
try {
  config = loadRuntimeConfig(process.env);
} catch (error) {
  console.error('\nWorker configuration error:');
  console.error(error.message);
  console.error('\nPlease check your worker/.env or backend/.env configuration file.\n');
  process.exit(1);
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const verifyScript = resolve(currentDir, 'verify-worker.mjs');
const poolScript = resolve(currentDir, 'generate-quest-pool.mjs');

console.info('===========================================================');
console.info('  SideQuest T&T — Full-Time Home Server Workers');
console.info(`  Provider : ${config.provider.toUpperCase()} (${config.provider === 'nvidia' ? 'Cloud NVIDIA NIM API' : 'Local Ollama'})`);
console.info(`  Model    : ${config.gemmaModel}`);
console.info(`  API Host : ${config.apiBaseUrl.origin}`);
console.info('===========================================================');

let shuttingDown = false;
const managedChildren = new Map();

function startWorker(name, scriptPath, args = []) {
  if (shuttingDown) return;

  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd: currentDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  managedChildren.set(name, child);

  child.stdout.on('data', (data) => {
    formatLogLines(name, data.toString()).forEach((line) => console.log(line));
  });

  child.stderr.on('data', (data) => {
    formatLogLines(name, data.toString()).forEach((line) => console.error(line));
  });

  child.on('close', async (code, signal) => {
    managedChildren.delete(name);
    if (!shuttingDown) {
      console.warn(
        `[supervisor] ${name} exited (code: ${code}, signal: ${signal}). Restarting in 5s...`,
      );
      await sleep(5000);
      if (!shuttingDown) {
        startWorker(name, scriptPath, args);
      }
    }
  });

  console.info(`[supervisor] Started ${name} (PID: ${child.pid})`);
}

function formatLogLines(prefix, text) {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => `[${prefix}] ${line}`);
}

async function handleShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`\n[supervisor] Received ${signal}; gracefully stopping background workers...`);

  for (const [name, child] of managedChildren.entries()) {
    console.info(`[supervisor] Stopping ${name} (PID: ${child.pid})...`);
    child.kill('SIGTERM');
  }

  const deadline = Date.now() + 10000;
  while (managedChildren.size > 0 && Date.now() < deadline) {
    await sleep(250);
  }

  for (const [name, child] of managedChildren.entries()) {
    console.warn(`[supervisor] Force-killing unresponsive worker ${name}...`);
    child.kill('SIGKILL');
  }

  console.info('[supervisor] All background workers stopped.');
  process.exit(0);
}

process.once('SIGINT', () => handleShutdown('SIGINT'));
process.once('SIGTERM', () => handleShutdown('SIGTERM'));

startWorker('verify', verifyScript);
startWorker('pool-gen', poolScript, ['--schedule']);
