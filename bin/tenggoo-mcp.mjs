#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const mcpPath = resolve(currentDir, '../src/agent/mcp-server.ts');

const child = spawn(
  process.execPath,
  ['--no-warnings', '--experimental-strip-types', mcpPath],
  { stdio: 'inherit' },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
