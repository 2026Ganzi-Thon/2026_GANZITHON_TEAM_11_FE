import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const sources = JSON.parse(
  await readFile(new URL('./font-sources.json', import.meta.url), 'utf8'),
);
const directory = new URL('../.expo/app-fonts/', import.meta.url);
await mkdir(directory, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
await Promise.all(
  sources.map(async ({ name, url, sha256 }) => {
    const file = new URL(`${name}.ttf`, directory);
    const existing = await readFile(file).catch(() => null);
    if (existing && hash(existing) === sha256) return;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok)
      throw new Error(`Font download failed: ${name} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== sha256)
      throw new Error(`Font checksum mismatch: ${name}`);
    await writeFile(file, bytes);
    console.log(`Prepared font: ${name}`);
  }),
);
