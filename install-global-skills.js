const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Define .env path first to avoid ReferenceErrors
const envFilePath = path.join(__dirname, '.env');
let apiKey = '';
let selectedModel = 'openrouter/free';

if (fs.existsSync(envFilePath)) {
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  const keyMatch = envContent.match(/^OPENROUTER_API_KEY=(.+)$/m);
  if (keyMatch) apiKey = keyMatch[1].trim();
  
  const modelMatch = envContent.match(/^CLAUDE_MODEL=(.+)$/m);
  if (modelMatch) selectedModel = modelMatch[1].trim();
}

console.log("🚀 Starting global skills and MCP setup...");
console.log("   (Uses .env in this folder — copy install-global-skills.example.env → .env if needed.)");
console.log("");
console.log("   Optional MCP @21st-dev/magic: set MAGIC_API_KEY in .env, or run: npm run setup:21st");
console.log("   (Get a key at https://21st.dev — then run this installer again to write ~/.claude.json)");

// 1. Copy bundled skills to home directory (~/.claude/skills)
const srcSkills = path.join(__dirname, 'bundled-skills', 'skills');
const destSkills = path.join(os.homedir(), '.claude', 'skills');

// Cleanup old nested structure if it exists from previous buggy runs
const oldNestedSkills = path.join(destSkills, 'skills');
if (fs.existsSync(oldNestedSkills)) {
  console.log("🧹 Cleaning up old nested skills folder...");
  try {
    fs.rmSync(oldNestedSkills, { recursive: true, force: true });
  } catch (err) {
    console.warn("⚠️ Could not remove old nested skills folder:", err.message);
  }
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  const basename = path.basename(src);
  if (basename === '.git' || basename === 'node_modules') return; // Skip these to avoid permission/size issues
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    try {
      fs.copyFileSync(src, dest);
    } catch(err) {
      // Ignore copy errors (e.g. read only)
    }
  }
}

if (fs.existsSync(srcSkills)) {
  console.log(`Copying skills from ${srcSkills} to ${destSkills}...`);
  copyRecursiveSync(srcSkills, destSkills);
  console.log("✅ Skills copied successfully!");
} else {
  console.log("⚠️ No bundled-skills folder found in the repository. Skipping.");
}

// 2. Configure MCP properly in .claude.json
const claudeConfigPath = path.join(os.homedir(), '.claude.json');
// Normalize paths to look exactly like Claude's format (e.g. C:/Users/name)
const homedir = os.homedir().replace(/\\/g, '/');

if (fs.existsSync(claudeConfigPath)) {
  console.log(`Configuring user-scoped MCP in ${claudeConfigPath}...`);
  try {
    const configData = fs.readFileSync(claudeConfigPath, 'utf8');
    const config = JSON.parse(configData);

    // Claude Code: user scope = top-level `mcpServers` (all projects). Local scope = `projects["<workspace path>"].mcpServers`.
    // Writing under projects[homedir] does not apply to folders like .../coderouter — those stayed empty.
    if (!config.mcpServers) config.mcpServers = {};

    const userHomeProjectKey =
      Object.keys(config.projects || {}).find((k) => k.toLowerCase() === homedir.toLowerCase()) ||
      homedir;

    // Read 21st-dev/magic API key from env, not hardcoded
    const magicApiKey =
      process.env.MAGIC_API_KEY ||
      (() => {
        const envContent = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8') : '';
        const m = envContent.match(/^MAGIC_API_KEY=(.+)$/m);
        return m ? m[1].trim() : '';
      })();

    const magicServerName = '@21st-dev/magic';

    if (!magicApiKey) {
      console.log('⚠️  MAGIC_API_KEY not set — skipping @21st-dev/magic MCP.');
      console.log('   Add MAGIC_API_KEY=<key from https://21st.dev> to your repo .env, then run this script again.');
      if (config.mcpServers[magicServerName]) {
        delete config.mcpServers[magicServerName];
        console.log('   Removed stale @21st-dev/magic from user mcpServers (no valid key).');
      }
      if (config.projects?.[userHomeProjectKey]?.mcpServers?.[magicServerName]) {
        delete config.projects[userHomeProjectKey].mcpServers[magicServerName];
        console.log('   Removed legacy @21st-dev/magic from projects[homedir].');
      }
    } else {
      const win = process.platform === 'win32';
      // Windows: Claude docs recommend cmd /c for stdio MCP that shells out to npx
      config.mcpServers[magicServerName] = win
        ? {
            command: 'cmd',
            args: ['/c', 'npx', '-y', '@21st-dev/magic@latest'],
            env: { API_KEY: magicApiKey },
          }
        : {
            command: 'npx',
            args: ['-y', '@21st-dev/magic@latest'],
            env: { API_KEY: magicApiKey },
          };
      if (config.projects?.[userHomeProjectKey]?.mcpServers?.[magicServerName]) {
        delete config.projects[userHomeProjectKey].mcpServers[magicServerName];
        console.log('   Migrated: removed duplicate @21st-dev/magic from projects[homedir] (now user-scoped).');
      }
      console.log(
        '✅ MCP @21st-dev/magic configured in ~/.claude.json top-level mcpServers (user scope — all folders).',
      );
    }

    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("❌ Failed to update .claude.json:", e);
  }
} else {
  console.log('⚠️ .claude.json not found — skipping MCP config.');
  console.log('   Run Claude Code once (any folder) so it creates ~/.claude.json, then run: node install-global-skills.js');
}

// 3. Set persistent User-level environment variables (Windows Registry / shell exports)
// This ensures ANY terminal picks up the proxy config — no alias needed for model routing

const isWin = process.platform === 'win32';
const scriptPath = path.join(__dirname, isWin ? 'run-claude.ps1' : 'run-claude.sh');

if (isWin) {
  // 3a. Add OPENROUTER_API_KEY and CLAUDE_MODEL to User environment variables
  //    Pass values via env (avoids shell quoting / injection if key has quotes)
  if (apiKey) {
    try {
      console.log("⚙️ Setting User environment variables...");
      console.log(`   CLAUDE_MODEL → ${selectedModel} (pinned for global launcher)`);
      execSync(
        `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('OPENROUTER_API_KEY', $env:CODEROUTER_OR_KEY, 'User')"`,
        { env: { ...process.env, CODEROUTER_OR_KEY: apiKey } }
      );
      execSync(
        `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('CLAUDE_MODEL', $env:CODEROUTER_OR_MODEL, 'User')"`,
        { env: { ...process.env, CODEROUTER_OR_MODEL: selectedModel } }
      );
      console.log("✅ Global Environment Variables set successfully!");
    } catch (e) {
      console.log(`⚠️ Could not set User environment variables: ${e.message}`);
    }
  }

  // 3b. Create a global batch wrapper at a location in PATH
  // This creates "claude.cmd" in the user's AppData\Local\Microsoft\WindowsApps or a custom bin
  const binDir = path.join(os.homedir(), '.coderouter', 'bin');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  const batchContent = `@echo off
REM CodeRouter Global Launcher - Auto-generated
powershell -ExecutionPolicy Bypass -File "${scriptPath}" %*
`;
  fs.writeFileSync(path.join(binDir, 'claude.cmd'), batchContent);
  fs.writeFileSync(path.join(binDir, 'coderouter.cmd'), batchContent);
  console.log(`✅ Created global launchers: ${path.join(binDir, 'claude.cmd')} and coderouter.cmd`);

  // 3b. Add to PATH if not already there (User-level)
  try {
    const currentPath = execSync('powershell -Command "[Environment]::GetEnvironmentVariable(\'PATH\', \'User\')"', { encoding: 'utf8' }).trim();
    if (!currentPath.includes('.coderouter\\bin')) {
      // Pass merged PATH via env — avoids PowerShell quoting/injection if PATH contains quotes or ';'
      const mergedPath = `${binDir};${currentPath}`;
      execSync(
        'powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable(\'PATH\', $env:CODEROUTER_MERGED_PATH, \'User\')"',
        { encoding: 'utf8', env: { ...process.env, CODEROUTER_MERGED_PATH: mergedPath } }
      );
      console.log(`✅ Added ${binDir} to User PATH`);
    }
  } catch (e) {
    console.log(`⚠️ Could not update PATH automatically: ${e.message}`);
  }

  // 3c. Also inject PowerShell profile alias (for PS terminals)
  const profilePaths = [
    path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
  ];
  
  profilePaths.forEach(psProfile => {
    const psProfileDir = path.dirname(psProfile);
    if (!fs.existsSync(psProfileDir)) fs.mkdirSync(psProfileDir, { recursive: true });
    
    let content = fs.existsSync(psProfile) ? fs.readFileSync(psProfile, 'utf8') : '';
    const psNl = '\r\n';
    const psBlock =
      `# CodeRouter Global Alias${psNl}` +
      `function claude { & "${scriptPath}" @args }${psNl}` +
      `function coderouter { & "${scriptPath}" @args }${psNl}`;

    if (content.includes('# CodeRouter Global Alias')) {
      console.log(`🔄 Updating CodeRouter aliases in ${psProfile}...`);
      content = content.replace(
        /# CodeRouter Global Alias\r?\n(?:function (?:claude|coderouter)[^\r\n]*\r?\n)+/,
        psBlock
      );
      fs.writeFileSync(psProfile, content);
    } else {
      fs.appendFileSync(psProfile, `${psNl}${psBlock}`);
      console.log(`✅ Added PowerShell global 'claude' and 'coderouter' to ${psProfile}`);
    }
  });
} else {
  const unixBlock =
    `# CodeRouter Global Alias\n` +
    `alias claude="${scriptPath}"\n` +
    `alias coderouter="${scriptPath}"\n`;
  const home = os.homedir();
  const candidates = ['.zshrc', '.bashrc', '.bash_profile'];
  let rcPath = candidates.map((f) => path.join(home, f)).find((p) => fs.existsSync(p));
  if (!rcPath) {
    const shell = process.env.SHELL || '';
    const fallback = shell.includes('zsh') ? '.zshrc' : '.bashrc';
    rcPath = path.join(home, fallback);
    if (!fs.existsSync(rcPath)) {
      fs.writeFileSync(rcPath, `# Created by CodeRouter install-global-skills.js\n`);
      console.log(`📝 Created ~/${fallback} (no existing shell rc found)`);
    }
  }
  let content = fs.readFileSync(rcPath, 'utf8');
  if (content.includes('# CodeRouter Global Alias')) {
    const newContent = content.replace(
      /# CodeRouter Global Alias\n(?:alias (?:claude|coderouter)="[^"]+"\n)+/,
      unixBlock
    );
    fs.writeFileSync(rcPath, newContent);
    console.log(`🔄 Updated Unix global 'claude' / 'coderouter' aliases in ${rcPath}`);
  } else {
    fs.appendFileSync(rcPath, `\n${unixBlock}`);
    console.log(`✅ Added Unix global 'claude' and 'coderouter' to ${rcPath}`);
  }
}

console.log("\n🎉 Setup complete! RESTART YOUR TERMINAL, then type 'claude' or 'coderouter' from ANY directory!");
console.log("   The proxy + openrouter/free model will be used automatically.");

