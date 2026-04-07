#!/usr/bin/env node
/**
 * Add MAGIC_API_KEY to repo .env for @21st-dev/magic MCP, then run: node install-global-skills.js
 *
 * The installer writes user-scoped MCP to ~/.claude.json → top-level mcpServers (visible in all projects).
 * Requires ~/.claude.json to exist (open Claude Code once first). After install, restart Claude Code / IDE
 * so the MCP list refreshes. Verify: claude mcp list
 *
 * Usage:
 *   npm run setup:21st                    — interactive prompt (TTY)
 *   node setup-21st.js YOUR_KEY         — non-interactive (avoid shell history on shared machines)
 *   node setup-21st.js --remove         — remove MAGIC_API_KEY line from .env
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const envPath = path.join(__dirname, '.env');
const DOCS = 'https://21st.dev';

function readEnv() {
  if (!fs.existsSync(envPath)) return '';
  return fs.readFileSync(envPath, 'utf8');
}

function getMagicFromFile(content) {
  const m = content.match(/^MAGIC_API_KEY=(.*)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

function looksPlaceholder(v) {
  const t = (v || '').toLowerCase();
  if (!t || t.length < 6) return true;
  return ['your-21st', 'replace-with', 'paste', 'xxx', '...', 'here'].some((p) => t.includes(p));
}

function writeMagicKey(key) {
  const trimmed = key.trim().replace(/^["']|["']$/g, '');
  let c = readEnv();
  if (!c) {
    c = `# CodeRouter .env — see .env.example\nOPENROUTER_API_KEY=\nCLAUDE_MODEL=openrouter/free\n`;
    console.log('⚠️  Created minimal .env — add OPENROUTER_API_KEY before running Claude.');
  }
  const line = `MAGIC_API_KEY=${trimmed}`;
  if (/^MAGIC_API_KEY=/m.test(c)) {
    c = c.replace(/^MAGIC_API_KEY=.*$/m, line);
  } else {
    c = c.replace(/\s*$/, '') + '\n' + line + '\n';
  }
  fs.writeFileSync(envPath, c);
}

function removeMagic() {
  if (!fs.existsSync(envPath)) return;
  let c = readEnv();
  c = c.replace(/^MAGIC_API_KEY=.*\r?\n?/m, '');
  fs.writeFileSync(envPath, c);
  console.log('Removed MAGIC_API_KEY from .env');
}

async function promptLine(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return ans;
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--remove' || arg === '-r') {
    removeMagic();
    console.log('Run: node install-global-skills.js  (to refresh .claude.json)');
    return;
  }

  if (arg && !arg.startsWith('-')) {
    writeMagicKey(arg);
    console.log(`✅ MAGIC_API_KEY saved to .env`);
    console.log('   Next: node install-global-skills.js  (then restart Claude Code so /mcp updates)');
    return;
  }

  const fileContent = readEnv();
  const fromEnv = process.env.MAGIC_API_KEY || '';
  const current = fromEnv || getMagicFromFile(fileContent);
  if (current && !looksPlaceholder(current)) {
    console.log('MAGIC_API_KEY already set in .env or environment.');
    console.log('To refresh MCP config: node install-global-skills.js');
    console.log(`To remove: node setup-21st.js --remove`);
    return;
  }

  if (!process.stdin.isTTY) {
    console.log('Non-interactive: add to .env manually:');
    console.log(`  MAGIC_API_KEY=your_key   (${DOCS})`);
    console.log('Or: node setup-21st.js YOUR_KEY');
    process.exit(0);
  }

  console.log('');
  console.log('━━ @21st-dev/magic MCP ━━');
  console.log(`Get an API key: ${DOCS}`);
  console.log('(Input is visible — paste only in a trusted terminal.)');
  console.log('');

  const key = (await promptLine('Paste MAGIC_API_KEY (Enter to skip): ')).trim();
  if (!key) {
    console.log('Skipped. Add MAGIC_API_KEY to .env later, then: node install-global-skills.js');
    return;
  }

  writeMagicKey(key);
  console.log('✅ Saved to .env');
  console.log('   Next: node install-global-skills.js  (then restart Claude Code so /mcp updates)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
