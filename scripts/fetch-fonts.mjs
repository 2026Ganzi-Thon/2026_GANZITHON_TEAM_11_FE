import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const retryDelays = [0, 500, 1500];
class DownloadError extends Error {
  constructor(message, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

export async function prepareFonts(
  sources,
  directory,
  { fetchImpl = fetch, wait = delay } = {},
) {
  await mkdir(directory, { recursive: true });
  const pages = new Map();
  async function request(url, pageUrl) {
    const response = await fetchImpl(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(pageUrl ? { Referer: pageUrl } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new DownloadError(
        `HTTP ${response.status}`,
        [403, 408, 425, 429].includes(response.status) ||
          response.status >= 500,
      );
    }
    return response;
  }
  async function attachment(source) {
    if (source.url) return source.url;
    if (!pages.has(source.pageUrl))
      pages.set(source.pageUrl, await (await request(source.pageUrl)).text());
    const links = pages
      .get(source.pageUrl)
      .matchAll(
        /href="(https:\/\/download\.blog\.naver\.com\/open\/[^"<>]+\.ttf)"/g,
      );
    for (const [, raw] of links) {
      const url = raw.replaceAll('&amp;', '&');
      const fileName = decodeURIComponent(
        new URL(url).pathname.split('/').at(-1),
      ).normalize('NFC');
      if (fileName === source.fileName.normalize('NFC')) return url;
    }
    throw new DownloadError(
      `Original attachment not found: ${source.fileName}`,
    );
  }
  // Serialize downloads to avoid unnecessary concurrent requests to the author host.
  for (const source of sources) {
    const file = new URL(`${source.name}.ttf`, directory);
    const existing = await readFile(file).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (existing && hash(existing) === source.sha256) continue;
    if (existing) await rm(file);
    const temporary = new URL(`${source.name}.${process.pid}.tmp`, directory);
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      if (attempt) await wait(retryDelays[attempt]);
      try {
        const url = await attachment(source);
        const response = await request(url, source.pageUrl);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (hash(bytes) !== source.sha256)
          throw new DownloadError(`Font checksum mismatch: ${source.name}`);
        await writeFile(temporary, bytes);
        await rename(temporary, file);
        console.log(`Prepared font: ${source.name}`);
        break;
      } catch (error) {
        // Attachment links may expire; resolve the author's page again on retry.
        pages.delete(source.pageUrl);
        const retryable =
          error instanceof DownloadError
            ? error.retryable
            : error instanceof TypeError ||
              ['AbortError', 'TimeoutError'].includes(error.name);
        if (!retryable || attempt === retryDelays.length - 1)
          throw new Error(
            `Font download failed: ${source.name} after ${attempt + 1} attempts: ${error.message}`,
            { cause: error },
          );
        console.warn(`Retrying font: ${source.name} (${error.message})`);
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const sources = JSON.parse(
    await readFile(new URL('./font-sources.json', import.meta.url), 'utf8'),
  );
  await prepareFonts(sources, new URL('../.expo/app-fonts/', import.meta.url));
}
