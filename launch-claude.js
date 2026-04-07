#!/usr/bin/env node
/**
 * Always start Claude through run-claude.ps1 / run-claude.sh so the OpenRouter
 * proxy and ANTHROPIC_BASE_URL are set. Plain `npx claude` in this repo skips
 * that and reproduces OpenRouter 400 / auth issues.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = __dirname;
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';

let result;
if (isWin) {
  result = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'run-claude.ps1'), ...args],
    { stdio: 'inherit', cwd: root }
  );
} else {
  result = spawnSync('bash', [path.join(root, 'run-claude.sh'), ...args], {
    stdio: 'inherit',
    cwd: root,
  });
}

process.exit(result.status == null ? 1 : result.status);
