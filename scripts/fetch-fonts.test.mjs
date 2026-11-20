import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { prepareFonts } from './fetch-fonts.mjs';

const bytes = new TextEncoder().encode('original font fixture');
const hash = createHash('sha256').update(bytes).digest('hex');
const pageUrl = 'https://m.blog.naver.com/author/post';
const attachment = 'https://download.blog.naver.com/open/fresh/Font%20Bold.ttf';
const source = {
  name: 'FontBold',
  pageUrl,
  fileName: 'Font Bold.ttf',
  sha256: hash,
};
const page = () => new Response(`<a href="${attachment}">font</a>`);
const options = (fetchImpl) => ({ fetchImpl, wait: async () => {} });
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'font-download-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return pathToFileURL(path + '/');
}

test('resolves current attachment links and reuses one source page for two fonts', async (t) => {
  const dir = await directory(t),
    calls = [];
  const other = { ...source, name: 'FontRegular', fileName: 'Font.ttf' };
  await prepareFonts(
    [source, other],
    dir,
    options(async (url) => {
      calls.push(url);
      return url === pageUrl
        ? new Response(
            `<a href="${attachment}"></a><a href="https://download.blog.naver.com/open/current/Font.ttf"></a>`,
          )
        : new Response(bytes);
    }),
  );
  assert.equal(calls.filter((url) => url === pageUrl).length, 1);
  assert.deepEqual(
    new Uint8Array(await readFile(new URL('FontBold.ttf', dir))),
    bytes,
  );
  assert.deepEqual(
    new Uint8Array(await readFile(new URL('FontRegular.ttf', dir))),
    bytes,
  );
});

test('refreshes the source page after a 403 instead of retrying a stale attachment', async (t) => {
  const dir = await directory(t),
    calls = [];
  let pages = 0;
  await prepareFonts(
    [source],
    dir,
    options(async (url) => {
      calls.push(url);
      if (url === pageUrl) {
        pages++;
        return new Response(
          `<a href="https://download.blog.naver.com/open/${pages}/Font%20Bold.ttf"></a>`,
        );
      }
      return url.includes('/1/')
        ? new Response('', { status: 403 })
        : new Response(bytes);
    }),
  );
  assert.equal(pages, 2);
  assert.equal(calls.filter((url) => url.includes('/1/')).length, 1);
  assert.deepEqual(
    new Uint8Array(await readFile(new URL('FontBold.ttf', dir))),
    bytes,
  );
});

test('uses only checksum-valid cached files without network access', async (t) => {
  const dir = await directory(t);
  await writeFile(new URL('FontBold.ttf', dir), bytes);
  await prepareFonts(
    [source],
    dir,
    options(async () => {
      throw new Error('network must not be used');
    }),
  );
  assert.deepEqual(
    new Uint8Array(await readFile(new URL('FontBold.ttf', dir))),
    bytes,
  );
});

test('retries transient network and 503 errors, but stops after three failed attempts', async (t) => {
  const dir = await directory(t);
  const direct = {
    name: 'Direct',
    url: 'https://fonts.example/font.ttf',
    sha256: hash,
  };
  let calls = 0;
  await prepareFonts(
    [direct],
    dir,
    options(async () => {
      calls++;
      if (calls === 1) throw new TypeError('connection reset');
      return calls === 2
        ? new Response('', { status: 503 })
        : new Response(bytes);
    }),
  );
  assert.equal(calls, 3);
  await rm(new URL('Direct.ttf', dir));
  calls = 0;
  await assert.rejects(
    prepareFonts(
      [direct],
      dir,
      options(async () => {
        calls++;
        return new Response('', { status: 403 });
      }),
    ),
    /Direct.*3 attempts.*403/,
  );
  assert.equal(calls, 3);
  assert.deepEqual(await readdir(dir), []);
});

test('replaces corrupt cache only after verification and rejects a changed original', async (t) => {
  const dir = await directory(t);
  await writeFile(new URL('FontBold.ttf', dir), 'corrupt cache');
  await assert.rejects(
    prepareFonts(
      [source],
      dir,
      options(async (url) =>
        url === pageUrl ? page() : new Response('wrong font'),
      ),
    ),
    /checksum mismatch/i,
  );
  assert.deepEqual(await readdir(dir), []);
});

test('rejects missing or non-original attachments without publishing a font file', async (t) => {
  const dir = await directory(t);
  await assert.rejects(
    prepareFonts(
      [source],
      dir,
      options(
        async () =>
          new Response(
            '<a href="https://other.example/Font%20Bold.ttf">font</a>',
          ),
      ),
    ),
    /attachment not found/i,
  );
  assert.deepEqual(await readdir(dir), []);
});
