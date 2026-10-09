// Version Bumper & Release Manager for Pixel Pet Studio
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = packageJson.version || '1.0.0';
const arg = process.argv[2] || 'patch';

let [major, minor, patch] = currentVersion.split('.').map(num => parseInt(num, 10) || 0);

let newVersion;
if (arg === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
} else if (arg === 'minor') {
  minor += 1;
  patch = 0;
  newVersion = `${major}.${minor}.${patch}`;
} else if (arg === 'patch') {
  patch += 1;
  newVersion = `${major}.${minor}.${patch}`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  newVersion = arg;
} else {
  console.log(`Unknown bump argument "${arg}". Usage: node bump-version.js [patch|minor|major|x.y.z]`);
  process.exit(1);
}

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

// Also update src/main.js fallback version if present
const mainJsPath = path.join(__dirname, '../src/main.js');
if (fs.existsSync(mainJsPath)) {
  let mainJs = fs.readFileSync(mainJsPath, 'utf8');
  mainJs = mainJs.replace(/let currentAppVersion = '[^']+';/, `let currentAppVersion = '${newVersion}';`);
  fs.writeFileSync(mainJsPath, mainJs, 'utf8');
}

console.log(`\n===========================================`);
console.log(`  Version updated: ${currentVersion} -> ${newVersion}`);
console.log(`===========================================\n`);
