const fs = require('fs');
const path = require('path');
const os = require('os');

console.log("🚀 Starting global skills and MCP setup...");

// 1. Copy bundled skills to home directory (~/.claude/skills)
const srcSkills = path.join(__dirname, 'bundled-skills');
const destSkills = path.join(os.homedir(), '.claude', 'skills');

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
  console.log(`Configuring global MCP in ${claudeConfigPath}...`);
  try {
    const configData = fs.readFileSync(claudeConfigPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Find or create the global user project key
    const userKey = Object.keys(config.projects || {}).find(k => k.toLowerCase() === homedir.toLowerCase()) || homedir;
    
    if (!config.projects) config.projects = {};
    if (!config.projects[userKey]) config.projects[userKey] = {};
    if (!config.projects[userKey].mcpServers) config.projects[userKey].mcpServers = {};
    
    // Read 21st-dev/magic API key from env, not hardcoded
    const magicApiKey = process.env.MAGIC_API_KEY || 
      (() => {
        const envContent = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8') : '';
        const m = envContent.match(/^MAGIC_API_KEY=(.+)$/m);
        return m ? m[1].trim() : '';
      })();

    if (!magicApiKey) {
      console.log("⚠️  MAGIC_API_KEY not found in .env — skipping @21st-dev/magic MCP. Add MAGIC_API_KEY=your-key to .env and re-run.");
    } else {
      config.projects[userKey].mcpServers['@21st-dev/magic'] = {
        command: "npx",
        args: ["-y", "@21st-dev/magic@latest"],
        env: {
          API_KEY: magicApiKey
        }
      };
    }
    
    fs.writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2));
    console.log("✅ MCP Server @21st-dev/magic configured successfully!");
  } catch (e) {
    console.error("❌ Failed to update .claude.json:", e);
  }
} else {
  console.log("⚠️ .claude.json not found (Claude Code might not be installed or run yet). Skipping MCP config.");
}

// 3. Set persistent User-level environment variables (Windows Registry / shell exports)
// This ensures ANY terminal picks up the proxy config — no alias needed for model routing

const envFilePath = path.join(__dirname, '.env');
let apiKey = '';
let claudeModel = 'openrouter/free';

if (fs.existsSync(envFilePath)) {
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  const keyMatch = envContent.match(/^OPENROUTER_API_KEY=(.+)$/m);
  const modelMatch = envContent.match(/^CLAUDE_MODEL=(.+)$/m);
  if (keyMatch) apiKey = keyMatch[1].trim();
  if (modelMatch) claudeModel = modelMatch[1].trim();
}

const isWin = process.platform === 'win32';
const scriptPath = path.join(__dirname, isWin ? 'run-claude.ps1' : 'run-claude.sh');

if (isWin) {
  // 3a. Create a global batch wrapper at a location in PATH
  // This creates "claude.cmd" in the user's AppData\Local\Microsoft\WindowsApps or a custom bin
  const binDir = path.join(os.homedir(), '.coderouter', 'bin');
  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  const batchContent = `@echo off
REM CodeRouter Global Launcher - Auto-generated
powershell -ExecutionPolicy Bypass -File "${scriptPath}" %*
`;
  fs.writeFileSync(path.join(binDir, 'claude.cmd'), batchContent);
  console.log(`✅ Created global launcher at ${path.join(binDir, 'claude.cmd')}`);

  // 3b. Add to PATH if not already there (User-level)
  const { execSync } = require('child_process');
  try {
    const currentPath = execSync('powershell -Command "[Environment]::GetEnvironmentVariable(\'PATH\', \'User\')"', { encoding: 'utf8' }).trim();
    if (!currentPath.includes('.coderouter\\bin')) {
      execSync(`powershell -Command "[Environment]::SetEnvironmentVariable('PATH', '${binDir};${currentPath}', 'User')"`, { encoding: 'utf8' });
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
    const aliasCode = `\n# CodeRouter Global Alias\nfunction claude { & "${scriptPath}" @args }\n`;
    
    if (!content.includes('CodeRouter Global Alias')) {
      fs.appendFileSync(psProfile, aliasCode);
      console.log(`✅ Added PowerShell global 'claude' alias to ${psProfile}`);
    }
  });
} else {
  const unixAlias = `\n# CodeRouter Global Alias\nalias claude="${scriptPath}"\n`;
  ['.bashrc', '.zshrc', '.bash_profile'].forEach(file => {
    const rcPath = path.join(os.homedir(), file);
    if (fs.existsSync(rcPath)) {
      let content = fs.readFileSync(rcPath, 'utf8');
      if (!content.includes('CodeRouter Global Alias')) {
        fs.appendFileSync(rcPath, unixAlias);
        console.log(`✅ Added Unix global 'claude' alias to ~/${file}`);
      }
    }
  });
}

console.log("\n🎉 Setup complete! RESTART YOUR TERMINAL, then type 'claude' from ANY directory!");
console.log("   The proxy + openrouter/free model will be used automatically.");

