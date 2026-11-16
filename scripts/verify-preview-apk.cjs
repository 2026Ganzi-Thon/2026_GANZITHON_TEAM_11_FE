const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const apk = process.argv[2];
if (!apk || !fs.existsSync(apk))
  throw new Error('Provide the preview APK path.');
const result = spawnSync('unzip', ['-p', apk], {
  maxBuffer: 512 * 1024 * 1024,
});
if (result.status !== 0) throw new Error('Cannot inspect the preview APK.');
const markers = [
  os.homedir(),
  fs.realpathSync(process.cwd()),
  fs.realpathSync('node_modules'),
  '-----BEGIN PRIVATE KEY-----',
];
if (markers.some((value) => result.stdout.includes(Buffer.from(value))))
  throw new Error('The APK contains a local build path or private key marker.');
console.log('APK local-path and private-key marker check passed.');
