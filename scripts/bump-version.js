const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '../frontend/src/version.js');
const content = fs.readFileSync(versionFile, 'utf8');
const match = content.match(/APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/);

if (!match) { console.error('No se encontró versión'); process.exit(1); }

const [, major, minor, patch] = match;
const newVersion = `${major}.${minor}.${parseInt(patch) + 1}`;
fs.writeFileSync(versionFile, `export const APP_VERSION = "${newVersion}";\n`);
console.log(newVersion);
