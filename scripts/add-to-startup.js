const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('请先运行 npm run dist 打包出 exe');
  process.exit(1);
}

const exes = fs.readdirSync(distDir).filter(
  (f) => f.endsWith('.exe') && !f.toLowerCase().includes('setup')
);
if (!exes.length) {
  console.error('dist/ 下未找到便携版 exe，请先运行 npm run dist');
  process.exit(1);
}

const exeName = exes[0];
const exePath = path.join(distDir, exeName);
const startup = path.join(
  os.homedir(),
  'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);
const shortcutPath = path.join(startup, 'WorkBuddyPointsPet.lnk');

// 用 PowerShell 创建 Windows 快捷方式
const ps = [
  '$WshShell = New-Object -ComObject WScript.Shell;',
  `$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');`,
  `$Shortcut.TargetPath = '${exePath.replace(/'/g, "''")}';`,
  `$Shortcut.WorkingDirectory = '${distDir.replace(/'/g, "''")}';`,
  '$Shortcut.Save();',
].join('\n');

try {
  fs.mkdirSync(startup, { recursive: true });
  execSync('powershell -NoProfile -Command -', { input: ps, encoding: 'utf8' });
  console.log('已添加到开机启动项：');
  console.log('  快捷方式：', shortcutPath);
  console.log('  指向：', exePath);
  console.log('');
  console.log('重启电脑后桌宠会自动出现。');
} catch (e) {
  console.error('添加开机启动项失败：', e.stderr || e.message);
  process.exit(1);
}
